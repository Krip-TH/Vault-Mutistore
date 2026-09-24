import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/errors/apiError.js';
import {
  classifyGeminiError,
  configuredGeminiModel,
  DEFAULT_MODEL,
} from '../src/services/ai/geminiClient.js';

test('GEMINI_MODEL overrides DEFAULT_MODEL and surrounding whitespace is ignored', () => {
  const previous = process.env.GEMINI_MODEL;
  try {
    process.env.GEMINI_MODEL = '  gemini-3.8-flash  ';
    assert.equal(configuredGeminiModel(), 'gemini-3.8-flash');

    delete process.env.GEMINI_MODEL;
    assert.equal(configuredGeminiModel(), DEFAULT_MODEL);

    process.env.GEMINI_MODEL = '   ';
    assert.equal(configuredGeminiModel(), DEFAULT_MODEL);
  } finally {
    if (previous === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = previous;
  }
});

test('Gemini failures are classified without depending on upstream message text', () => {
  assert.equal(classifyGeminiError(Object.assign(new Error('not found'), { status: 404 })).category, 'MODEL_NOT_FOUND');
  assert.equal(classifyGeminiError(Object.assign(new Error('quota'), { status: 429 })).category, 'RATE_LIMIT_OR_QUOTA');
  assert.equal(classifyGeminiError(Object.assign(new Error('busy'), { status: 503 })).category, 'HIGH_DEMAND');

  const timeout = new Error('timed out');
  timeout.name = 'AbortError';
  assert.equal(classifyGeminiError(timeout).category, 'TIMEOUT');
  assert.equal(
    classifyGeminiError(new ApiError(502, 'AI_TOOL_LIMIT', 'Tool loop stopped.')).category,
    'FUNCTION_CALLING',
  );
});
