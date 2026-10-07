import { afterEach, describe, expect, it, vi } from "vitest";
import { createHintServer } from "../src/hint.mjs";
import { createRecoveryToolRegistry } from "../src/recovery/tool-registry.mjs";

const request = { goal: "survive", context: { difficulty: "normal", lives: 2, lastDamage: { cause: "hazard", x: 160, y: 640, time: 4.5 } } };
const final = { summary: "Wait, then climb.", goal: "survive", actions: ["wait", "climb"], evidence: [{ id: "threat", fact: "Recent threat: rolling hazard." }], confidence: "high", completed: true };
const servers = [];
async function start(options) { const server = createHintServer(options); await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); servers.push(server); return { server, base: `http://127.0.0.1:${server.address().port}` }; }
afterEach(async () => Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve)))));

describe("Recovery Planner HTTP API", () => {
  it("returns a validated completed envelope and a redacted event", async () => {
    const recoveryModel = { step: vi.fn().mockResolvedValueOnce({ kind: "tool_request", id: "one", name: "evaluate_recovery_plan", args: { actions: ["wait", "climb"] } }).mockResolvedValueOnce({ kind: "final", result: final }), dispose: vi.fn() };
    const { server, base } = await start({ recoveryModel, model: "test-model" });
    const response = await fetch(`${base}/api/recovery-plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "completed", result: final });
    expect(server.getRecoveryEvents()).toHaveLength(1);
    expect(server.getRecoveryEvents()[0]).toMatchObject({ operation: "recovery_plan", status: "completed", provider: "fake", model: "test-model" });
    expect(JSON.stringify(server.getRecoveryEvents()[0])).not.toContain("160");
  });

  it.each([
    ["GET", { }, 405],
    ["POST", { "Content-Type": "text/plain" }, 415],
  ])("enforces HTTP method and content type", async (method, headers, expected) => {
    const { base } = await start({ recoveryModel: { step: vi.fn(), dispose: vi.fn() } });
    const response = await fetch(`${base}/api/recovery-plan`, { method, headers, body: method === "POST" ? JSON.stringify(request) : undefined });
    expect(response.status).toBe(expected);
  });

  it("rejects malformed, oversized, and invalid input before the model starts", async () => {
    const recoveryModel = { step: vi.fn(), dispose: vi.fn() };
    const { base } = await start({ recoveryModel });
    for (const body of ["{", JSON.stringify({ ...request, extra: true }), JSON.stringify({ payload: "x".repeat(2050) })]) {
      const response = await fetch(`${base}/api/recovery-plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ status: "failed", stopReason: "invalid_input", message: "Invalid recovery plan request." });
    }
    expect(recoveryModel.step).not.toHaveBeenCalled();
    expect(recoveryModel.dispose).not.toHaveBeenCalled();
  });

  it("returns stable 422 and 502 responses without provider or payload details", async () => {
    const unknown = { step: vi.fn().mockResolvedValue({ kind: "tool_request", id: "one", name: "take_control", args: {} }), dispose: vi.fn() };
    const first = await start({ recoveryModel: unknown, apiKey: "server-secret" });
    const stopped = await fetch(`${first.base}/api/recovery-plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
    expect(stopped.status).toBe(422);
    const stoppedBody = await stopped.json();
    expect(stoppedBody).toMatchObject({ status: "stopped", stopReason: "unknown_tool", message: "Recovery planning stopped safely." });
    expect(JSON.stringify(stoppedBody)).not.toMatch(/server-secret|take_control|160/);

    const toolFailure = { step: vi.fn().mockResolvedValue({ kind: "tool_request", id: "one", name: "evaluate_recovery_plan", args: { actions: ["wait", "climb"] } }), dispose: vi.fn() };
    const second = await start({ recoveryModel: toolFailure, recoveryRegistry: createRecoveryToolRegistry({ evaluator: () => { throw new Error("private tool detail"); } }) });
    const failed = await fetch(`${second.base}/api/recovery-plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
    expect(failed.status).toBe(502);
    const failedBody = await failed.json();
    expect(failedBody).toMatchObject({ status: "failed", stopReason: "tool_failed", message: "Recovery planning returned an invalid result." });
    expect(JSON.stringify(failedBody)).not.toContain("private tool detail");
  });
});
