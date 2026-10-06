import { createServer } from "node:http";
import { API_ERROR_CODES, publicError, validateHintRequest, validateRecoveryRequest } from "@quattro-kong/game-contracts";
import { createGeminiAdapter } from "./coach/gemini-adapter.mjs";
import { createGameStateTool } from "./coach/game-state-tool.mjs";
import { createHintFlow } from "./coach/hint-flow.mjs";
import { createEventStore } from "./coach/telemetry.mjs";
import { createRecoveryGeminiAdapter } from "./recovery/gemini-adapter.mjs";
import { createRecoveryFlow } from "./recovery/recovery-flow.mjs";
import { createRecoveryToolRegistry } from "./recovery/tool-registry.mjs";
import { createRecoveryEventStore } from "./recovery/telemetry.mjs";

const MAX_BODY_BYTES = 2048;

export { validateHintRequest };

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new Error("too-large");
  }
  return JSON.parse(body);
}

function createRequestSignal(request, response) {
  const controller = new AbortController();
  request.once("aborted", () => controller.abort({ kind: "cancelled" }));
  response.once("close", () => {
    if (!response.writableEnded) controller.abort({ kind: "cancelled" });
  });
  return controller.signal;
}

export function createHintServer({
  apiKey = process.env.GEMINI_API_KEY ?? "",
  model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
  coach,
  tool = createGameStateTool(),
  eventSink,
  recoveryModel,
  recoveryRegistry = createRecoveryToolRegistry(),
  recoveryEventSink,
} = {}) {
  const eventStore = createEventStore();
  const recordEvent = (event) => {
    eventStore.record(event);
    eventSink?.(event);
  };
  const resolvedCoach = apiKey ? (coach ?? createGeminiAdapter({ apiKey, model })) : null;
  const flow = resolvedCoach ? createHintFlow({ model: resolvedCoach, tool, eventSink: recordEvent }) : null;
  const recoveryEventStore = createRecoveryEventStore();
  const recordRecoveryEvent = (event) => { recoveryEventStore.record(event); recoveryEventSink?.(event); };
  const resolvedRecoveryModel = recoveryModel ?? (apiKey ? createRecoveryGeminiAdapter({ apiKey, model }) : null);
  const recoveryFlow = resolvedRecoveryModel ? createRecoveryFlow({ model: resolvedRecoveryModel, registry: recoveryRegistry, eventSink: recordRecoveryEvent, provider: recoveryModel ? "fake" : "gemini", modelName: model }) : null;

  const server = createServer(async (request, response) => {
    const recovery = request.url === "/api/recovery-plan";
    if (request.url !== "/api/hint" && !recovery) {
      sendJson(response, 404, publicError(API_ERROR_CODES.NOT_FOUND, "Not found."));
      return;
    }
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, publicError(API_ERROR_CODES.METHOD_NOT_ALLOWED, "Method not allowed."));
      return;
    }
    if (!request.headers["content-type"]?.startsWith("application/json")) {
      sendJson(response, 415, publicError(API_ERROR_CODES.INVALID_REQUEST, "Expected JSON."));
      return;
    }

    let raw;
    try {
      raw = await readBody(request);
    } catch (error) {
      if (recovery) sendJson(response, 400, { status: "failed", stopReason: "invalid_input", message: "Invalid recovery plan request." });
      else sendJson(response, error.message === "too-large" ? 413 : 400, publicError(API_ERROR_CODES.INVALID_REQUEST, "Invalid request."));
      return;
    }
    const context = recovery ? validateRecoveryRequest(raw) : validateHintRequest(raw);
    if (!context) {
      if (recovery) sendJson(response, 400, { status: "failed", stopReason: "invalid_input", message: "Invalid recovery plan request." });
      else sendJson(response, 400, publicError(API_ERROR_CODES.INVALID_REQUEST, "Invalid game state."));
      return;
    }
    if (recovery) {
      if (!recoveryFlow) { sendJson(response, 503, { status: "failed", stopReason: "provider_failed", message: "Recovery planning is unavailable right now." }); return; }
      const result = await recoveryFlow.run(context, { signal: createRequestSignal(request, response) });
      sendJson(response, result.status, result.body);
      return;
    }
    if (!flow) {
      sendJson(response, 503, publicError(API_ERROR_CODES.COACH_UNAVAILABLE, "AI coach is not configured."));
      return;
    }

    const result = await flow.run(context, { signal: createRequestSignal(request, response) });
    sendJson(response, result.status, result.body);
  });
  server.getCoachEvents = () => eventStore.recent();
  server.getRecoveryEvents = () => recoveryEventStore.recent();
  return server;
}
