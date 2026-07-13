// src/server.ts
// Smart Inbox Assistant — entry point
// Receives incoming messages (simulated customer inquiries) via HTTP webhook,
// hands them to the AI module, stores the result and returns it.
// Also serves the dashboard frontend from /public.

import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import { processMessage } from "./ai.js";
import { initStore, addMessage, getAllMessages } from "./store.js";
import type { IncomingMessage } from "./types.js";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());

// Serve the dashboard (static frontend) from the /public folder
app.use(express.static("public"));

// Health check — quickly verify the server is running
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Main trigger endpoint: a new incoming message arrives here
app.post("/api/messages", async (req: Request, res: Response) => {
  const { from, subject, body } = req.body as IncomingMessage;

  // Cheap validation BEFORE any expensive AI call
  if (!body || typeof body !== "string" || body.trim() === "") {
    res.status(400).json({
      error: "Field 'body' is required and must be a non-empty string.",
    });
    return;
  }

  try {
    const incoming: IncomingMessage = {
      body,
      ...(from !== undefined ? { from } : {}),
      ...(subject !== undefined ? { subject } : {}),
    };

    const processed = await processMessage(incoming);
    const stored = await addMessage(incoming, processed);

    res.status(201).json(stored);
  } catch (err) {
    // If AI processing fails, tell the caller honestly — don't fake a result
    console.error("AI processing failed:", err);
    res.status(502).json({
      error: "AI processing failed.",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

// Read endpoint: the dashboard fetches messages from here
app.get("/api/messages", (req: Request, res: Response) => {
  res.json(getAllMessages());
});

// Start: load persisted data first, then begin accepting requests
async function start(): Promise<void> {
  await initStore();
  app.listen(PORT, () => {
    console.log(`Smart Inbox Assistant running on http://localhost:${PORT}`);
  });
}

start();