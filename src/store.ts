// src/store.ts
// Message storage: in-memory for fast reads, persisted to a JSON file
// so data survives server restarts.
// The rest of the app only knows add() and getAll() — if this is ever
// replaced by a real database, no other file needs to change.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ProcessedMessage, StoredMessage } from "./types.js";

const DATA_DIR = path.resolve("data");
const DATA_FILE = path.join(DATA_DIR, "messages.json");

// In-memory copy — the single source of truth while the server runs
let messages: StoredMessage[] = [];

// Load persisted messages on server start.
// If the file doesn't exist yet (first run), start with an empty list.
export async function initStore(): Promise<void> {
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    messages = JSON.parse(raw) as StoredMessage[];
    console.log(`Store: loaded ${messages.length} message(s) from ${DATA_FILE}`);
  } catch {
    messages = [];
    console.log("Store: no existing data file, starting empty.");
  }
}

// Persist the current state to disk.
// Called after every change — fine for a demo; a real high-traffic
// system would use a database instead.
async function persist(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(messages, null, 2), "utf-8");
}

// Add a newly processed message to the store
export async function addMessage(
  original: IncomingMessage,
  processed: ProcessedMessage
): Promise<StoredMessage> {
  const record: StoredMessage = {
    id: randomUUID(),
    receivedAt: new Date().toISOString(),
    original: {
      from: original.from ?? null,
      subject: original.subject ?? null,
      body: original.body,
    },
    processed,
  };

  // Newest first — that's the order a dashboard wants
  messages.unshift(record);
  await persist();
  return record;
}

// Return all stored messages (newest first)
export function getAllMessages(): StoredMessage[] {
  return messages;
}