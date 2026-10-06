import {
  validateModelDecision, validateRecoveryPlanResult, validateRecoveryRequest,
} from "@quattro-kong/game-contracts";
import { isTransientProviderError } from "../coach/telemetry.mjs";
import { RECOVERY_LIMITS } from "./limits.mjs";
import { createRecoveryRun, startRun, beginStep, beginProviderAttempt, beginToolCall, addEvaluation, canonicalActionKey, finishRun } from "./run-state.mjs";
import { normalizeRecoveryContext } from "./plan-evaluator.mjs";
import { createRecoveryToolRegistry } from "./tool-registry.mjs";
import { createRecoveryEvent } from "./telemetry.mjs";

const STOP_MESSAGE = "Recovery planning stopped safely.";
const INVALID_RESULT_MESSAGE = "Recovery planning returned an invalid result.";
const UNAVAILABLE_MESSAGE = "Recovery planning is unavailable right now.";
const CANCELLED_MESSAGE = "Recovery planning was cancelled.";
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function linkedSignal(parent, milliseconds) {
  const controller = new AbortController();
  const parentAbort = () => controller.abort(parent.reason ?? { kind: "cancelled" });
  if (parent?.aborted) parentAbort(); else parent?.addEventListener("abort", parentAbort, { once: true });
  const timer = setTimeout(() => controller.abort({ kind: "attempt_timeout" }), milliseconds);
  return { signal: controller.signal, dispose: () => { clearTimeout(timer); parent?.removeEventListener("abort", parentAbort); } };
}

function runSignal(parent, milliseconds) {
  const controller = new AbortController();
  const abort = () => controller.abort(parent?.reason ?? { kind: "cancelled" });
  if (parent?.aborted) abort(); else parent?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort({ kind: "deadline" }), milliseconds);
  return { signal: controller.signal, dispose: () => { clearTimeout(timer); parent?.removeEventListener("abort", abort); } };
}

function abortedReason(signal) {
  return signal?.reason?.kind === "deadline" ? "deadline" : "cancelled";
}

function awaitAbortable(promise, signal) {
  if (signal?.aborted) return Promise.reject(signal.reason ?? new Error("aborted"));
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new Error("aborted"));
    signal?.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal?.removeEventListener("abort", abort));
  });
}

function publicResponse(run) {
  if (run.status === "completed") return { status: 200, body: { runId: run.runId, status: "completed", stopReason: "completed", result: run.result } };
  const stopReason = run.stopReason;
  const status = run.status === "stopped" ? 422 : stopReason === "cancelled" ? 499 : ["invalid_tool_result", "tool_failed"].includes(stopReason) ? 502 : stopReason === "invalid_input" ? 400 : 503;
  const message = stopReason === "cancelled" ? CANCELLED_MESSAGE : ["invalid_tool_result", "tool_failed"].includes(stopReason) ? INVALID_RESULT_MESSAGE : stopReason === "invalid_input" ? "Invalid recovery plan request." : run.status === "stopped" ? STOP_MESSAGE : UNAVAILABLE_MESSAGE;
  return { status, body: { runId: run.runId, status: run.status, stopReason, message } };
}

export function createRecoveryFlow({ model, registry = createRecoveryToolRegistry(), eventSink = () => {}, provider = "gemini", modelName = "", now = Date.now, limits = RECOVERY_LIMITS } = {}) {
  if (!model?.step) throw new Error("Recovery model must implement step().");
  return Object.freeze({
    async run(rawRequest, { signal: parentSignal } = {}) {
      const request = validateRecoveryRequest(rawRequest);
      if (!request) return { status: 400, body: { status: "failed", stopReason: "invalid_input", message: "Invalid recovery plan request." } };
      const context = normalizeRecoveryContext(request);
      const run = createRecoveryRun({ goal: request.goal, context, now, deadlineMs: limits.runDeadlineMs });
      const validations = [];
      const deadline = runSignal(parentSignal, limits.runDeadlineMs);
      startRun(run);
      const finish = (status, reason) => { finishRun(run, status, reason); return publicResponse(run); };
      const callModel = async (history) => {
        let lastError;
        while (true) {
          if (deadline.signal.aborted) throw deadline.signal.reason;
          if (!beginProviderAttempt(run)) return { limit: "provider_attempt_limit" };
          const attempt = linkedSignal(deadline.signal, limits.providerAttemptMs);
          try {
            return { decision: await awaitAbortable(model.step({ runId: run.runId, goal: run.goal, context: run.context, history: history.map((entry) => ({ proposal: { actions: [...entry.proposal.actions] }, evaluation: entry.evaluation })), availableTools: [{ name: "evaluate_recovery_plan" }], signal: attempt.signal }), attempt.signal) };
          } catch (error) {
            lastError = error;
            if (deadline.signal.aborted) throw deadline.signal.reason;
            if (attempt.signal.aborted) throw { kind: "provider_timeout" };
            if (!isTransientProviderError(error)) throw error;
            if (run.providerAttemptCount >= limits.maxProviderAttempts) return { limit: "provider_attempt_limit" };
            if (run.attemptsInCurrentStep >= limits.maxAttemptsPerStep) throw error;
          } finally { attempt.dispose(); }
        }
      };
      const history = [];
      try {
        while (run.status === "running") {
          if (deadline.signal.aborted) return finish("failed", abortedReason(deadline.signal));
          if (!beginStep(run)) return finish("stopped", "step_limit");
          let answer;
          try { answer = await callModel(history); }
          catch (error) {
            if (deadline.signal.aborted) return finish("failed", abortedReason(deadline.signal));
            return finish("failed", error?.kind === "provider_timeout" ? "provider_failed" : "provider_failed");
          }
          if (answer.limit) return finish("stopped", answer.limit);
          const decision = validateModelDecision(answer.decision);
          if (!decision) { validations.push("invalid_model_proposal"); return finish("stopped", "invalid_model_proposal"); }
          if (decision.kind === "refusal") return finish("stopped", "provider_refusal");
          if (decision.kind === "final") {
            const result = validateRecoveryPlanResult(decision.result);
            const latest = history.at(-1)?.evaluation;
            if (!result || !latest?.viable || !result.completed || result.goal !== run.goal || !equal(result.actions, latest.candidate) || !result.evidence.every((item) => latest.evidence.some((source) => source.id === item.id && source.fact === item.fact))) {
              validations.push("invalid_final_result"); return finish("stopped", "invalid_final_result");
            }
            run.result = result;
            return finish("completed", "completed");
          }
          if (run.stepCount === 3) return finish("stopped", "step_limit");
          const checked = registry.validate(decision.name, decision.args);
          if (checked.error) { validations.push(checked.error); return finish("stopped", checked.error); }
          const actionKey = canonicalActionKey(decision.name, checked.args, run.context.stateVersion);
          if (run.actionKeys.includes(actionKey)) return finish("stopped", "repeated_action");
          if (!beginToolCall(run, actionKey)) return finish("stopped", "tool_call_limit");
          const tool = await registry.execute(run.context, checked.args);
          if (tool.error) { validations.push(tool.error); return finish("failed", tool.error); }
          if (!addEvaluation(run, tool.evaluation)) return finish("stopped", "tool_call_limit");
          history.push({ proposal: checked.args, evaluation: tool.evaluation });
        }
      } finally {
        deadline.dispose();
        model.dispose?.(run.runId);
        if (run.status === "running") finishRun(run, "failed", deadline.signal.aborted ? abortedReason(deadline.signal) : "provider_failed");
        eventSink(createRecoveryEvent({ run, provider, model: modelName, validationResults: validations, now }));
      }
      return publicResponse(run);
    },
  });
}
