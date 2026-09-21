import type { NextFunction, Request, Response } from 'express';

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;

interface Hit {
  count: number;
  resetAt: number;
}

const hits = new Map<string, Hit>();

function clientKey(request: Request): string {
  return request.ip || request.socket.remoteAddress || 'unknown';
}

/** Simple in-memory per-IP rate limit for /api/ai/* so a runaway client loop cannot burn through the AI quota. */
export function aiRateLimit(request: Request, response: Response, next: NextFunction): void {
  const now = Date.now();
  const key = clientKey(request);
  const hit = hits.get(key);

  if (!hit || hit.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (hit.count >= MAX_REQUESTS_PER_WINDOW) {
    response.status(429).json({
      error: { code: 'AI_RATE_LIMITED', message: 'Too many AI requests. Please wait a moment and try again.' },
    });
    return;
  }

  hit.count += 1;
  next();
}
