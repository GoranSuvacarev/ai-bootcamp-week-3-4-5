import { randomUUID } from "node:crypto";
import { RECOVERY_LIMITS } from "./limits.mjs";

const terminal = new Set(["completed", "stopped", "failed"]);

export function canonicalActionKey(name, args, stateVersion) {
  return `${name}:${JSON.stringify(args.actions)}:${stateVersion}`;
}

export function createRecoveryRun({ goal, context, now = Date.now, runId = `run-${randomUUID()}`, deadlineMs = RECOVERY_LIMITS.runDeadlineMs }) {
  const startedAtMs = now();
  const run = {
    runId, status: "created", goal, context: Object.freeze({ ...context }), stepCount: 0, toolCallCount: 0,
    providerAttemptCount: 0, attemptsInCurrentStep: 0, startedAtMs, deadlineAtMs: startedAtMs + deadlineMs,
    actionKeys: [], evaluations: [], stopReason: undefined,
  };
  return run;
}

export function isTerminal(run) { return terminal.has(run.status); }
export function startRun(run) { if (run.status !== "created") return false; run.status = "running"; return true; }
export function canStartWork(run, now = Date.now) { return run.status === "running" && now() < run.deadlineAtMs; }
export function beginStep(run) {
  if (isTerminal(run) || run.stepCount >= RECOVERY_LIMITS.maxSteps) return false;
  run.stepCount += 1; run.attemptsInCurrentStep = 0; return true;
}
export function beginProviderAttempt(run) {
  if (isTerminal(run) || run.providerAttemptCount >= RECOVERY_LIMITS.maxProviderAttempts || run.attemptsInCurrentStep >= RECOVERY_LIMITS.maxAttemptsPerStep) return false;
  run.providerAttemptCount += 1; run.attemptsInCurrentStep += 1; return true;
}
export function beginToolCall(run, key) {
  if (isTerminal(run) || run.toolCallCount >= RECOVERY_LIMITS.maxToolCalls || run.actionKeys.includes(key)) return false;
  run.actionKeys.push(key); run.toolCallCount += 1; return true;
}
export function addEvaluation(run, evaluation) { if (isTerminal(run) || run.evaluations.length >= RECOVERY_LIMITS.maxToolCalls) return false; run.evaluations.push(evaluation); return true; }
export function finishRun(run, status, stopReason) { if (isTerminal(run)) return false; run.status = status; run.stopReason = stopReason; return true; }
