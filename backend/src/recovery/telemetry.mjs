import { RECOVERY_LIMITS } from "./limits.mjs";

export function createRecoveryEvent({ run, provider = "gemini", model = "", validationResults = [], now = Date.now }) {
  return Object.freeze({
    runId: run.runId, operation: "recovery_plan", goal: run.goal, status: run.status, stopReason: run.stopReason,
    stepCount: run.stepCount, toolCallCount: run.toolCallCount, provider: provider === "fake" ? "fake" : "gemini", model,
    providerAttemptCount: run.providerAttemptCount, validationResults: [...new Set(validationResults)].slice(0, 12),
    elapsedMs: Math.max(0, now() - run.startedAtMs),
  });
}

export function createRecoveryEventStore(limit = RECOVERY_LIMITS.maxEvents) {
  const events = [];
  return Object.freeze({
    record(event) { events.push(Object.freeze({ ...event, validationResults: Object.freeze([...event.validationResults]) })); if (events.length > limit) events.shift(); },
    recent() { return events.map((event) => ({ ...event, validationResults: [...event.validationResults] })); },
  });
}
