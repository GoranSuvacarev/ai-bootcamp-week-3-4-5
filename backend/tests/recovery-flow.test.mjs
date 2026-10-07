import { describe, expect, it, vi } from "vitest";
import { createRecoveryFlow } from "../src/recovery/recovery-flow.mjs";
import { createRecoveryToolRegistry } from "../src/recovery/tool-registry.mjs";
import { createFakeRecoveryModel } from "./helpers/fake-recovery-model.mjs";

const request = { goal: "survive", context: { difficulty: "normal", lives: 2, lastDamage: { cause: "hazard", x: 160, y: 640, time: 4.5 } } };
const final = { summary: "Wait for the hazard, then climb.", goal: "survive", actions: ["wait", "climb"], evidence: [{ id: "threat", fact: "Recent threat: rolling hazard." }], confidence: "high", completed: true };

describe("bounded recovery planner", () => {
  it("rejects invalid input before creating provider or tool work", async () => {
    const model = { step: vi.fn(), dispose: vi.fn() };
    const evaluator = vi.fn();
    const result = await createRecoveryFlow({ model, registry: createRecoveryToolRegistry({ evaluator }) }).run({ ...request, extra: true });
    expect(result).toEqual({ status: 400, body: { status: "failed", stopReason: "invalid_input", message: "Invalid recovery plan request." } });
    expect(model.step).not.toHaveBeenCalled();
    expect(model.dispose).not.toHaveBeenCalled();
    expect(evaluator).not.toHaveBeenCalled();
  });

  it("completes a grounded plan after exactly one evaluation", async () => {
    const model = { step: vi.fn().mockResolvedValueOnce({ kind: "tool_request", id: "one", name: "evaluate_recovery_plan", args: { actions: ["wait", "climb"] } }).mockResolvedValueOnce({ kind: "final", result: final }), dispose: vi.fn() };
    const result = await createRecoveryFlow({ model, provider: "fake" }).run(request);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ status: "completed", result: final });
    expect(model.step).toHaveBeenCalledTimes(2);
    expect(model.step.mock.calls[1][0].history).toHaveLength(1);
    expect(model.dispose).toHaveBeenCalledOnce();
  });

  it("rejects an unknown tool without evaluating anything", async () => {
    const model = { step: vi.fn().mockResolvedValue({ kind: "tool_request", id: "one", name: "take_control", args: {} }), dispose: vi.fn() };
    const evaluator = vi.fn();
    const result = await createRecoveryFlow({ model, registry: createRecoveryToolRegistry({ evaluator }) }).run(request);
    expect(result).toMatchObject({ status: 422, body: { status: "stopped", stopReason: "unknown_tool" } });
    expect(evaluator).not.toHaveBeenCalled();
  });

  it("allows one distinct revision after a non-viable proposal", async () => {
    const model = { step: vi.fn()
      .mockResolvedValueOnce({ kind: "tool_request", id: "one", name: "evaluate_recovery_plan", args: { actions: ["jump", "climb"] } })
      .mockResolvedValueOnce({ kind: "tool_request", id: "two", name: "evaluate_recovery_plan", args: { actions: ["wait", "climb"] } })
      .mockResolvedValueOnce({ kind: "final", result: final }), dispose: vi.fn() };
    const result = await createRecoveryFlow({ model }).run(request);
    expect(result.status).toBe(200);
    expect(model.step).toHaveBeenCalledTimes(3);
  });

  it.each([
    [{ kind: "tool_request", id: "one", name: "evaluate_recovery_plan", args: { actions: ["wait"] } }, "invalid_tool_arguments"],
    [{ kind: "final", result: final }, "invalid_final_result"],
    [{ kind: "refusal" }, "provider_refusal"],
    [{ kind: "invalid" }, "invalid_model_proposal"],
  ])("stops invalid first decisions safely (%s)", async (decision, stopReason) => {
    const model = { step: vi.fn().mockResolvedValue(decision), dispose: vi.fn() };
    const result = await createRecoveryFlow({ model }).run(request);
    expect(result).toMatchObject({ status: 422, body: { status: "stopped", stopReason } });
  });

  it("rejects repeated candidates and ungrounded final evidence without another tool execution", async () => {
    const events = [];
    const repeat = { step: vi.fn()
      .mockResolvedValueOnce({ kind: "tool_request", id: "one", name: "evaluate_recovery_plan", args: { actions: ["wait", "climb"] } })
      .mockResolvedValueOnce({ kind: "tool_request", id: "two", name: "evaluate_recovery_plan", args: { actions: ["wait", "climb"] } }), dispose: vi.fn() };
    const repeated = await createRecoveryFlow({ model: repeat, eventSink: (event) => events.push(event) }).run(request);
    expect(repeated).toMatchObject({ status: 422, body: { stopReason: "repeated_action" } });
    expect(events[0]).toMatchObject({ toolCallCount: 1, stepCount: 2 });

    const altered = { ...final, evidence: [{ id: "threat", fact: "Invented evidence." }] };
    const model = { step: vi.fn().mockResolvedValueOnce({ kind: "tool_request", id: "one", name: "evaluate_recovery_plan", args: { actions: ["wait", "climb"] } }).mockResolvedValueOnce({ kind: "final", result: altered }), dispose: vi.fn() };
    await expect(createRecoveryFlow({ model }).run(request)).resolves.toMatchObject({ status: 422, body: { stopReason: "invalid_final_result" } });
  });

  it("uses injected limits and retries only a transient provider failure", async () => {
    const transient = Object.assign(new Error("temporary"), { status: 503 });
    const retry = { step: vi.fn().mockRejectedValueOnce(transient).mockResolvedValueOnce({ kind: "tool_request", id: "one", name: "evaluate_recovery_plan", args: { actions: ["wait", "climb"] } }).mockResolvedValueOnce({ kind: "final", result: final }), dispose: vi.fn() };
    await expect(createRecoveryFlow({ model: retry }).run(request)).resolves.toMatchObject({ status: 200 });
    expect(retry.step).toHaveBeenCalledTimes(3);

    const limited = { step: vi.fn().mockResolvedValue({ kind: "tool_request", id: "one", name: "evaluate_recovery_plan", args: { actions: ["wait", "climb"] } }), dispose: vi.fn() };
    await expect(createRecoveryFlow({ model: limited, limits: { maxSteps: 1 } }).run(request)).resolves.toMatchObject({ status: 422, body: { stopReason: "step_limit" } });
    expect(limited.step).toHaveBeenCalledOnce();
  });

  it("cancels a pending provider without starting another call", async () => {
    const controller = new AbortController();
    const model = createFakeRecoveryModel([{ kind: "pending" }]);
    const pending = createRecoveryFlow({ model }).run(request, { signal: controller.signal });
    controller.abort({ kind: "cancelled" });
    await expect(pending).resolves.toMatchObject({ status: 499, body: { stopReason: "cancelled" } });
    expect(model.requests).toHaveLength(1);
    expect(model.abortReasons).toEqual([{ kind: "cancelled" }]);
  });

  it("records fake requests and dispose calls for scripted model decisions", async () => {
    const model = createFakeRecoveryModel([
      { kind: "tool_request", id: "one", name: "evaluate_recovery_plan", args: { actions: ["wait", "climb"] } },
      { kind: "final", result: final },
    ]);
    await expect(createRecoveryFlow({ model, provider: "fake" }).run(request)).resolves.toMatchObject({ status: 200 });
    expect(model.requests).toHaveLength(2);
    expect(model.disposedRunIds).toHaveLength(1);
  });

  it("classifies permanent failure, provider-attempt exhaustion, and deadline without extra calls", async () => {
    const permanent = { step: vi.fn().mockRejectedValue(Object.assign(new Error("denied"), { status: 401 })), dispose: vi.fn() };
    await expect(createRecoveryFlow({ model: permanent }).run(request)).resolves.toMatchObject({ status: 503, body: { stopReason: "provider_failed" } });
    expect(permanent.step).toHaveBeenCalledOnce();

    const transient = Object.assign(new Error("temporary"), { status: 503 });
    const exhausted = { step: vi.fn().mockRejectedValue(transient), dispose: vi.fn() };
    await expect(createRecoveryFlow({ model: exhausted, limits: { maxProviderAttempts: 2 } }).run(request)).resolves.toMatchObject({ status: 422, body: { stopReason: "provider_attempt_limit" } });
    expect(exhausted.step).toHaveBeenCalledTimes(2);

    const deadline = { step: vi.fn().mockImplementation(({ signal }) => new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }))), dispose: vi.fn() };
    await expect(createRecoveryFlow({ model: deadline, limits: { runDeadlineMs: 1, providerAttemptMs: 50 } }).run(request)).resolves.toMatchObject({ status: 503, body: { stopReason: "deadline" } });
    expect(deadline.step).toHaveBeenCalledOnce();
  });

  it.each([
    [{ ...final, goal: "advance" }],
    [{ ...final, actions: ["wait", "avoid"] }],
    [{ ...final, evidence: [{ id: "threat", fact: "Recent threat: rolling hazard." }, { id: "threat", fact: "Recent threat: rolling hazard." }] }],
    [{ ...final, confidence: "certain" }],
    [{ ...final, completed: false }],
  ])("rejects a structurally or semantically invalid final result", async (invalidFinal) => {
    const model = { step: vi.fn()
      .mockResolvedValueOnce({ kind: "tool_request", id: "one", name: "evaluate_recovery_plan", args: { actions: ["wait", "climb"] } })
      .mockResolvedValueOnce({ kind: "final", result: invalidFinal }), dispose: vi.fn() };
    await expect(createRecoveryFlow({ model }).run(request)).resolves.toMatchObject({ status: 422, body: { stopReason: "invalid_final_result" } });
  });

  it("bounds provider timeout and a third tool proposal", async () => {
    const timeoutModel = { step: vi.fn(() => new Promise(() => {})), dispose: vi.fn() };
    await expect(createRecoveryFlow({ model: timeoutModel, limits: { providerAttemptMs: 1, runDeadlineMs: 50 } }).run(request)).resolves.toMatchObject({ status: 503, body: { stopReason: "provider_failed" } });
    expect(timeoutModel.step).toHaveBeenCalledOnce();

    const events = [];
    const thirdTool = { step: vi.fn()
      .mockResolvedValueOnce({ kind: "tool_request", id: "one", name: "evaluate_recovery_plan", args: { actions: ["jump", "climb"] } })
      .mockResolvedValueOnce({ kind: "tool_request", id: "two", name: "evaluate_recovery_plan", args: { actions: ["jump", "move_left"] } })
      .mockResolvedValueOnce({ kind: "tool_request", id: "three", name: "evaluate_recovery_plan", args: { actions: ["wait", "climb"] } }), dispose: vi.fn() };
    await expect(createRecoveryFlow({ model: thirdTool, eventSink: (event) => events.push(event) }).run(request)).resolves.toMatchObject({ status: 422, body: { stopReason: "step_limit" } });
    expect(thirdTool.step).toHaveBeenCalledTimes(3);
    expect(events[0]).toMatchObject({ stepCount: 3, toolCallCount: 2, providerAttemptCount: 3 });
  });
});
