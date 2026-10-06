export const RECOVERY_LIMITS = Object.freeze({
  maxSteps: 3,
  maxToolCalls: 2,
  maxProviderAttempts: 5,
  maxAttemptsPerStep: 2,
  runDeadlineMs: 35_000,
  providerAttemptMs: 12_000,
  toolTimeoutMs: 250,
  maxToolResultBytes: 4096,
  maxEvents: 50,
});
