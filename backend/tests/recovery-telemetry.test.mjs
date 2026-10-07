import { describe, expect, it } from "vitest";
import { createRecoveryEvent, createRecoveryEventStore } from "../src/recovery/telemetry.mjs";

const run = { runId: "run-1", goal: "survive", status: "stopped", stopReason: "unknown_tool", stepCount: 1, toolCallCount: 0, providerAttemptCount: 1, startedAtMs: 10 };

describe("recovery telemetry", () => {
  it("emits exactly redacted bounded event fields", () => {
    const event = createRecoveryEvent({ run, provider: "fake", model: "test-model", validationResults: ["unknown_tool", "unknown_tool"], now: () => 35 });
    expect(event).toEqual({ runId: "run-1", operation: "recovery_plan", goal: "survive", status: "stopped", stopReason: "unknown_tool", stepCount: 1, toolCallCount: 0, providerAttemptCount: 1, provider: "fake", model: "test-model", validationResults: ["unknown_tool"], elapsedMs: 25 });
  });

  it("retains only 50 immutable copies", () => {
    const store = createRecoveryEventStore();
    for (let index = 0; index < 52; index += 1) store.record({ ...createRecoveryEvent({ run, now: () => index + 10 }), runId: `run-${index}` });
    const events = store.recent();
    expect(events).toHaveLength(50);
    expect(events[0].runId).toBe("run-2");
    events[0].validationResults.push("changed");
    expect(store.recent()[0].validationResults).not.toContain("changed");
  });
});
