import { FunctionCallingConfigMode, GoogleGenAI, Type } from '@google/genai';
import type { Content, FunctionCall, FunctionDeclaration, GenerateContentConfig, Part, Schema } from '@google/genai';
import { ApiError } from '../../errors/apiError.js';
import { logAiTiming } from './timing.js';

export { Type };
export type { Schema };

export const DEFAULT_MODEL = 'gemini-3.6-flash';
// Tool chat may need more than one model call, so this is enforced as one total request
// deadline rather than a fresh timeout for every function-calling iteration.
const DEFAULT_TIMEOUT_MS = 60_000;

let client: GoogleGenAI | null | undefined;

/** Lazily builds the Gemini client from the environment; missing config yields `null`, not a thrown error. */
function getClient(): GoogleGenAI | null {
  if (client === undefined) {
    const apiKey = process.env.GEMINI_API_KEY;
    client = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }
  return client;
}

export function isAiConfigured(): boolean {
  return getClient() !== null;
}

function requireClient(): GoogleGenAI {
  const instance = getClient();
  if (!instance) {
    throw new ApiError(503, 'AI_NOT_CONFIGURED', 'The AI assistant is not configured on this server.');
  }
  return instance;
}

export function configuredGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

export type GeminiErrorCategory =
  | 'MODEL_NOT_FOUND'
  | 'RATE_LIMIT_OR_QUOTA'
  | 'HIGH_DEMAND'
  | 'TIMEOUT'
  | 'FUNCTION_CALLING'
  | 'UPSTREAM_ERROR';

export interface GeminiErrorDiagnostic {
  category: GeminiErrorCategory;
  status: number | null;
  code: string;
  errorName: string;
}

function upstreamStatusOf(error: unknown): number | null {
  const candidate = error as { status?: unknown; statusCode?: unknown } | null;
  if (typeof candidate?.status === 'number') return candidate.status;
  return typeof candidate?.statusCode === 'number' ? candidate.statusCode : null;
}

export function classifyGeminiError(error: unknown): GeminiErrorDiagnostic {
  const status = upstreamStatusOf(error);
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  const code = error instanceof ApiError ? error.code : 'AI_REQUEST_FAILED';
  if ((error instanceof Error && error.name === 'AbortError') || code === 'AI_TIMEOUT') {
    return { category: 'TIMEOUT', status, code: 'AI_TIMEOUT', errorName };
  }
  if (code === 'AI_TOOL_LIMIT' || code === 'UNKNOWN_AI_TOOL') {
    return { category: 'FUNCTION_CALLING', status, code, errorName };
  }
  if (status === 404) return { category: 'MODEL_NOT_FOUND', status, code: 'AI_MODEL_NOT_FOUND', errorName };
  if (status === 429) return { category: 'RATE_LIMIT_OR_QUOTA', status, code: 'AI_QUOTA_EXCEEDED', errorName };
  if (status === 503) return { category: 'HIGH_DEMAND', status, code: 'AI_HIGH_DEMAND', errorName };
  return { category: 'UPSTREAM_ERROR', status, code, errorName };
}

function logGeminiError(error: unknown, operation: string, requestId?: string): void {
  const diagnostic = classifyGeminiError(error);
  console.error('[VAULT AI] Gemini request failed', {
    model: configuredGeminiModel(),
    operation,
    request_id: requestId ?? null,
    category: diagnostic.category,
    upstream_status: diagnostic.status,
    code: diagnostic.code,
    error_name: diagnostic.errorName,
  });
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const diagnostic = classifyGeminiError(error);
  if (diagnostic.category === 'TIMEOUT') {
    return new ApiError(504, 'AI_TIMEOUT', 'The AI assistant took too long to respond.', { cause: error });
  }
  // The Gemini SDK throws its own "ApiError" (unrelated to ours) carrying the upstream HTTP status.
  // A 429 here means Google's own quota/rate limit was hit, not our app's — worth its own code so it
  // is never confused with a generic failure or with our own outbound rate limiter (aiRateLimit.ts).
  if (diagnostic.category === 'MODEL_NOT_FOUND') {
    return new ApiError(
      503,
      'AI_MODEL_NOT_FOUND',
      'The configured AI model is temporarily unavailable.',
      { cause: error },
    );
  }
  if (diagnostic.category === 'RATE_LIMIT_OR_QUOTA') {
    return new ApiError(
      503,
      'AI_QUOTA_EXCEEDED',
      'The AI assistant has reached its usage limit for now. Please try again later.',
      { cause: error },
    );
  }
  if (diagnostic.category === 'HIGH_DEMAND') {
    return new ApiError(
      503,
      'AI_HIGH_DEMAND',
      'The AI assistant is temporarily busy. Please try again later.',
      { cause: error },
    );
  }
  return new ApiError(502, 'AI_REQUEST_FAILED', 'The AI assistant is temporarily unavailable.', { cause: error });
}

/** Shared call path for every Gemini request: applies the timeout, unwraps the response text, and normalizes errors. */
async function callModel(
  contents: string | Content[],
  config: Omit<GenerateContentConfig, 'abortSignal'>,
  timeoutMs: number,
): Promise<string> {
  const instance = requireClient();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await instance.models.generateContent({
      model: configuredGeminiModel(),
      contents,
      config: { ...config, abortSignal: controller.signal },
    });
    const text = response.text;
    if (!text) throw new ApiError(502, 'AI_EMPTY_RESPONSE', 'The AI assistant returned an empty response.');
    return text;
  } catch (error) {
    logGeminiError(error, 'generate_content');
    throw toApiError(error);
  } finally {
    clearTimeout(timer);
  }
}

export interface GenerateJsonOptions {
  prompt: string;
  responseSchema: Schema;
  systemInstruction?: string;
  timeoutMs?: number;
}

/** Requests a JSON-shaped completion. Returns the *parsed* payload — callers must still validate its shape. */
export async function generateJson({
  prompt, responseSchema, systemInstruction, timeoutMs = DEFAULT_TIMEOUT_MS,
}: GenerateJsonOptions): Promise<unknown> {
  const text = await callModel(prompt, { responseMimeType: 'application/json', responseSchema, systemInstruction }, timeoutMs);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ApiError(502, 'AI_INVALID_JSON', 'The AI assistant returned an invalid response.', { cause: error });
  }
}

export interface GenerateTextOptions {
  prompt: string;
  systemInstruction?: string;
  timeoutMs?: number;
}

/** Requests a single-turn plain-text completion (e.g. product descriptions). */
export async function generateText({
  prompt, systemInstruction, timeoutMs = DEFAULT_TIMEOUT_MS,
}: GenerateTextOptions): Promise<string> {
  return callModel(prompt, { systemInstruction }, timeoutMs);
}

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface GenerateChatReplyOptions {
  turns: ChatTurn[];
  systemInstruction?: string;
  timeoutMs?: number;
}

/** Requests a plain-text completion for a multi-turn conversation. */
export async function generateChatReply({
  turns, systemInstruction, timeoutMs = DEFAULT_TIMEOUT_MS,
}: GenerateChatReplyOptions): Promise<string> {
  const contents: Content[] = turns.map(turn => ({ role: turn.role, parts: [{ text: turn.text }] }));
  return callModel(contents, { systemInstruction }, timeoutMs);
}

export interface GenerateToolChatReplyOptions extends GenerateChatReplyOptions {
  tools: FunctionDeclaration[];
  executeTool: (call: FunctionCall) => Promise<Record<string, unknown>>;
  maxIterations?: number;
  requestId?: string;
  modelRequest?: (request: ToolModelRequest) => Promise<ToolModelResponse>;
  renderToolFallback?: (results: ExecutedToolResult[]) => string;
}

export interface ToolModelRequest {
  contents: Content[];
  systemInstruction?: string;
  tools: FunctionDeclaration[];
  toolsEnabled: boolean;
  abortSignal: AbortSignal;
}

export interface ToolModelResponse {
  functionCalls: FunctionCall[];
  content?: Content;
  text?: string;
}

export interface ExecutedToolResult {
  call: FunctionCall;
  result: Record<string, unknown>;
}

function timeoutError(): ApiError {
  return new ApiError(504, 'AI_TIMEOUT', 'The AI assistant took too long to respond.');
}

async function withinDeadline<T>(promise: Promise<T>, deadline: number): Promise<T> {
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) throw timeoutError();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(timeoutError()), remainingMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function toolStage(calls: FunctionCall[]): 'product_context' | 'order_database_context' {
  return calls.every(call => (
    call.name === 'search_products' || call.name === 'get_product_details' || call.name === 'get_best_sellers'
  )) ? 'product_context' : 'order_database_context';
}

async function requestToolModel({
  contents, systemInstruction, tools, toolsEnabled, abortSignal,
}: ToolModelRequest): Promise<ToolModelResponse> {
  const response = await requireClient().models.generateContent({
    model: configuredGeminiModel(), contents,
    config: {
      systemInstruction,
      tools: toolsEnabled ? [{ functionDeclarations: tools }] : undefined,
      toolConfig: {
        functionCallingConfig: {
          mode: toolsEnabled ? FunctionCallingConfigMode.AUTO : FunctionCallingConfigMode.NONE,
        },
      },
      abortSignal,
    },
  });
  const functionCalls = response.functionCalls ?? [];
  // The SDK's text getter warns when FunctionCall parts are present, so only read it
  // for a response that is actually expected to contain natural-language text.
  const text = functionCalls.length ? undefined : response.text?.trim();
  return { functionCalls, content: response.candidates?.[0]?.content, text };
}

function functionResponse(call: FunctionCall, result: Record<string, unknown>): Part {
  const response = 'error' in result ? result : { output: result };
  return { functionResponse: { id: call.id, name: call.name, response } } as Part;
}

/** Runs a bounded Gemini function-calling loop. Tool execution remains entirely in VAULT. */
export async function generateToolChatReply({
  turns, systemInstruction, tools, executeTool, timeoutMs = DEFAULT_TIMEOUT_MS, maxIterations = 2, requestId,
  modelRequest = requestToolModel, renderToolFallback,
}: GenerateToolChatReplyOptions): Promise<string> {
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  const toolResultCache = new Map<string, Record<string, unknown>>();
  const executedResults: ExecutedToolResult[] = [];
  const contents: Content[] = turns.map(turn => ({ role: turn.role, parts: [{ text: turn.text }] }));
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) throw timeoutError();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remainingMs);
    try {
      const requestStartedAt = Date.now();
      logAiTiming(requestId, 'gemini_request_start', startedAt, {
        iteration: iteration + 1,
        remaining_ms: remainingMs,
        context_bytes: Buffer.byteLength(JSON.stringify(contents)),
        system_prompt_chars: systemInstruction?.length ?? 0,
        tool_schema_bytes: iteration === 0 ? Buffer.byteLength(JSON.stringify(tools)) : 0,
        tools_enabled: iteration === 0,
      });
      const response = await modelRequest({
        contents, systemInstruction, tools,
        toolsEnabled: iteration === 0,
        abortSignal: controller.signal,
      });
      const calls = response.functionCalls;
      const responseText = response.text;
      logAiTiming(requestId, 'gemini_response_received', startedAt, {
        iteration: iteration + 1,
        gemini_ms: Date.now() - requestStartedAt,
        function_call_count: calls.length,
        response_chars: responseText?.length ?? 0,
        tools_requested: calls.map(call => call.name ?? 'unknown').join(','),
      });
      if (!calls.length) {
        if (!responseText) throw new ApiError(502, 'AI_EMPTY_RESPONSE', 'The AI assistant returned an empty response.');
        return responseText;
      }
      if (iteration > 0) {
        logAiTiming(requestId, 'disabled_tool_call_rejected', startedAt, {
          tools_requested: calls.map(call => call.name ?? 'unknown').join(','),
        });
        const fallback = renderToolFallback?.(executedResults).trim();
        if (fallback) return fallback;
        return 'ขออภัยค่ะ ระบบพบข้อมูลแล้วแต่ไม่สามารถเรียบเรียงคำตอบได้ กรุณาลองถามอีกครั้งค่ะ';
      }
      const modelContent = response.content;
      contents.push(modelContent ?? { role: 'model', parts: calls.map(call => ({ functionCall: call } as Part)) });
      const contextStage = toolStage(calls);
      const toolStartedAt = Date.now();
      logAiTiming(requestId, `${contextStage}_loading`, startedAt, {
        iteration: iteration + 1,
        tool_count: calls.length,
      });
      const results = await withinDeadline(Promise.all(calls.map(async call => {
        const cacheKey = `${call.name}:${JSON.stringify(call.args ?? {})}`;
        const cachedResult = toolResultCache.get(cacheKey);
        if (cachedResult) {
          executedResults.push({ call, result: cachedResult });
          return functionResponse(call, cachedResult);
        }
        let toolResult: Record<string, unknown>;
        try {
          toolResult = await executeTool(call);
        } catch (error) {
          toolResult = error instanceof ApiError
            ? { error: { code: error.code, message: error.message } }
            : { error: { code: 'DATA_UNAVAILABLE', message: 'The requested VAULT data could not be retrieved.' } };
        }
        toolResultCache.set(cacheKey, toolResult);
        executedResults.push({ call, result: toolResult });
        return functionResponse(call, toolResult);
      })), deadline);
      logAiTiming(requestId, `${contextStage}_loaded`, startedAt, {
        iteration: iteration + 1,
        tool_ms: Date.now() - toolStartedAt,
        result_bytes: Buffer.byteLength(JSON.stringify(results)),
      });
      contents.push({ role: 'user', parts: results });
    } catch (error) {
      const diagnostic = classifyGeminiError(error);
      logAiTiming(requestId, 'ai_iteration_failed', startedAt, {
        iteration: iteration + 1,
        error_name: diagnostic.errorName,
        error_category: diagnostic.category,
        error_code: diagnostic.code,
        upstream_status: diagnostic.status,
      });
      logGeminiError(error, 'tool_chat', requestId);
      if (iteration > 0 && executedResults.length) {
        const fallback = renderToolFallback?.(executedResults).trim();
        if (fallback) {
          logAiTiming(requestId, 'tool_grounded_fallback_returned', startedAt, {
            tool_result_count: executedResults.length,
          });
          return fallback;
        }
      }
      throw toApiError(error);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new ApiError(502, 'AI_TOOL_LIMIT', 'The AI assistant could not complete the request safely.');
}
