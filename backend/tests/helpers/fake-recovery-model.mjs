/** Sequence-based RecoveryModel fake for bounded-flow tests. */
export function createFakeRecoveryModel(script = []) {
  const queue = [...script];
  const requests = [];
  const disposedRunIds = [];
  return {
    requests,
    disposedRunIds,
    async step(request) {
      requests.push(request);
      const next = queue.shift();
      if (next?.kind === "pending") return new Promise((resolve, reject) => request.signal.addEventListener("abort", () => reject(request.signal.reason), { once: true }));
      if (next?.kind === "error") throw next.error;
      return next;
    },
    dispose(runId) { disposedRunIds.push(runId); },
  };
}
