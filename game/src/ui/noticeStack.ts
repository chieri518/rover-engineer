// The HUD's notice stack rule (no DOM): one copy of a sentence at a time. A notice with the same words as a
// standing warning is not posted, a standing warning absorbs a notice already showing its words, and a
// repeated notice replaces the earlier copy instead of stacking a second (Mars: the dusk notice for a rover
// without lights is the standing no-lights warning's own sentence).

/** Whether a new notice adds anything: not when a standing warning already says the same words. */
export function noticeNeeded(message: string, standing: readonly string[]): boolean {
  return !standing.includes(message);
}

/**
 * Indexes (oldest first) of the live notices to remove: those a standing warning now says, and, when a
 * notice is about to be posted (`incoming`), its earlier copies.
 */
export function staleNotices(live: readonly string[], standing: readonly string[], incoming?: string): number[] {
  const out: number[] = [];
  live.forEach((m, i) => {
    if (standing.includes(m) || m === incoming) out.push(i);
  });
  return out;
}
