export interface AiTimingDetails {
  [key: string]: string | number | boolean | null | undefined;
}

/** Development-only structured timing output. Never include prompts, tool results, or credentials. */
export function logAiTiming(
  requestId: string | undefined,
  stage: string,
  startedAt: number,
  details: AiTimingDetails = {},
): void {
  if (process.env.NODE_ENV === 'production') return;
  console.info('[AI timing]', {
    request_id: requestId ?? 'untracked',
    stage,
    elapsed_ms: Date.now() - startedAt,
    ...details,
  });
}
