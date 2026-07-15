// src/rateLimit.ts
// Daily cap on AI processing: a simple counter that resets at midnight (UTC).
// Protects against runaway costs — whether from bots, a leaked token,
// or our own buggy script in a loop.
//
// The limit is configurable via env (DAILY_MESSAGE_LIMIT), defaults to 100.

const DEFAULT_DAILY_LIMIT = 100;

let currentDay = todayKey();
let count = 0;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // e.g. "2026-07-14"
}

function getLimit(): number {
  const fromEnv = Number(process.env.DAILY_MESSAGE_LIMIT);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_DAILY_LIMIT;
}

// Reset the counter when the day changes
function rollOverIfNeeded(): void {
  const today = todayKey();
  if (today !== currentDay) {
    currentDay = today;
    count = 0;
  }
}

// Check whether another message may be processed today.
// Returns an object so the caller can report numbers to the client.
export function checkDailyLimit(): {
  allowed: boolean;
  used: number;
  limit: number;
} {
  rollOverIfNeeded();
  const limit = getLimit();
  return { allowed: count < limit, used: count, limit };
}

// Record one processed message (call only after deciding to process)
export function recordProcessedMessage(): void {
  rollOverIfNeeded();
  count++;
}