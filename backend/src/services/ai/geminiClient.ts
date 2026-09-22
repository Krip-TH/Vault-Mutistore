import { GoogleGenAI, Type } from '@google/genai';
import type { Content, FunctionCall, FunctionDeclaration, GenerateContentConfig, Part, Schema } from '@google/genai';
import { ApiError } from '../../errors/apiError.js';

export { Type };
export type { Schema };

const DEFAULT_MODEL = 'gemini-2.5-flash';
// Observed latency varies noticeably by Google Cloud project/key (some respond in ~2-3s,
// others consistently take 10-13s even for small prompts) — 25s gives real, slower accounts
// enough headroom while still failing fast rather than hanging indefinitely.
const DEFAULT_TIMEOUT_MS = 25_000;

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

function modelName(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error && error.name === 'AbortError') {
    return new ApiError(504, 'AI_TIMEOUT', 'The AI assistant took too long to respond.', { cause: error });
  }
  // The Gemini SDK throws its own "ApiError" (unrelated to ours) carrying the upstream HTTP status.
  // A 429 here means Google's own quota/rate limit was hit, not our app's — worth its own code so it
  // is never confused with a generic failure or with our own outbound rate limiter (aiRateLimit.ts).
  const upstreamStatus = (error as { status?: unknown } | null)?.status;
  if (upstreamStatus === 429) {
    return new ApiError(
      503,
      'AI_QUOTA_EXCEEDED',
      'The AI assistant has reached its usage limit for now. Please try again later.',
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
      model: modelName(),
      contents,
      config: { ...config, abortSignal: controller.signal },
    });
    const text = response.text;
    if (!text) throw new ApiError(502, 'AI_EMPTY_RESPONSE', 'The AI assistant returned an empty response.');
    return text;
  } catch (error) {
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
}

/** Runs a bounded Gemini function-calling loop. Tool execution remains entirely in VAULT. */
export async function generateToolChatReply({
  turns, systemInstruction, tools, executeTool, timeoutMs = DEFAULT_TIMEOUT_MS, maxIterations = 4,
}: GenerateToolChatReplyOptions): Promise<string> {
  const instance = requireClient();
  const contents: Content[] = turns.map(turn => ({ role: turn.role, parts: [{ text: turn.text }] }));
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await instance.models.generateContent({
        model: modelName(), contents,
        config: { systemInstruction, tools: [{ functionDeclarations: tools }], abortSignal: controller.signal },
      });
      const calls = response.functionCalls ?? [];
      if (!calls.length) {
        const text = response.text?.trim();
        if (!text) throw new ApiError(502, 'AI_EMPTY_RESPONSE', 'The AI assistant returned an empty response.');
        return text;
      }
      const modelContent = response.candidates?.[0]?.content;
      contents.push(modelContent ?? { role: 'model', parts: calls.map(call => ({ functionCall: call } as Part)) });
      const results = await Promise.all(calls.map(async call => {
        let toolResult: Record<string, unknown>;
        try {
          toolResult = await executeTool(call);
        } catch (error) {
          toolResult = error instanceof ApiError
            ? { error: { code: error.code, message: error.message } }
            : { error: { code: 'DATA_UNAVAILABLE', message: 'The requested VAULT data could not be retrieved.' } };
        }
        return { functionResponse: { id: call.id, name: call.name, response: toolResult } } as Part;
      }));
      contents.push({ role: 'user', parts: results });
    } catch (error) {
      throw toApiError(error);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new ApiError(502, 'AI_TOOL_LIMIT', 'The AI assistant could not complete the request safely.');
}
