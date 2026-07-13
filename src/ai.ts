// src/ai.ts
// The AI processing module: takes a raw incoming message,
// asks Claude to summarize / categorize / extract data,
// and returns a validated, typed result.

import Anthropic from "@anthropic-ai/sdk";
import type { IncomingMessage, ProcessedMessage, Category, Priority } from "./types.js";
import { CATEGORIES, PRIORITIES } from "./types.js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// The system prompt is the "job description" for the AI.
// Key principles:
// 1. Respond with pure JSON only — no markdown, no commentary.
// 2. Never invent data: anything not present in the message is "unknown".
// 3. Categories and priorities come from a fixed list.
const SYSTEM_PROMPT = `You are an inbox triage assistant for a business.
You will receive one incoming customer message. Analyze it and respond with ONLY a valid JSON object — no markdown fences, no explanations, no text before or after.

The JSON object must have exactly these fields:
{
  "summary": "1-2 sentence summary of what the message is about",
  "category": one of: "Order" | "Complaint" | "General Question" | "Spam",
  "priority": one of: "High" | "Medium" | "Low",
  "sender_name": "sender's name as written in the message",
  "contact": "ALL contact details found in the message (email and/or phone), comma-separated",
  "topic": "the product or subject the message is about"
}

Rules:
- NEVER invent information. If a piece of information is not present in the message, use exactly the string "unknown".
- Priority guide: "High" = urgent issues, angry customers, money at stake; "Medium" = normal business requests; "Low" = casual questions, newsletters, spam.
- If the message is clearly unsolicited advertising or nonsense, category is "Spam" and priority is "Low".
- The summary must be in English, even if the message is in another language.`;

// Type guards: never trust AI output blindly — validate at runtime.
function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

function isPriority(value: unknown): value is Priority {
  return typeof value === "string" && (PRIORITIES as readonly string[]).includes(value);
}

// AI sometimes wraps JSON in markdown fences despite instructions.
// Strip them defensively instead of failing.
function stripJsonFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export async function processMessage(
  message: IncomingMessage
): Promise<ProcessedMessage> {
  // Give the AI the same context a human triager would have
  const userContent = `From: ${message.from ?? "unknown"}
Subject: ${message.subject ?? "unknown"}

Message:
${message.body}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  // The SDK returns an array of content blocks; we expect one text block
  const block = response.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Unexpected response format from AI (no text block).");
  }

  // Parse defensively: strip possible markdown fences first
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(block.text));
  } catch {
    throw new Error(`AI did not return valid JSON. Raw output: ${block.text}`);
  }

  // Validate the shape — never let malformed AI output into the system
  const p = parsed as Record<string, unknown>;

  if (!isCategory(p.category)) {
    throw new Error(`AI returned invalid category: ${String(p.category)}`);
  }
  if (!isPriority(p.priority)) {
    throw new Error(`AI returned invalid priority: ${String(p.priority)}`);
  }

  return {
    summary: typeof p.summary === "string" ? p.summary : "unknown",
    category: p.category,
    priority: p.priority,
    sender_name: typeof p.sender_name === "string" ? p.sender_name : "unknown",
    contact: typeof p.contact === "string" ? p.contact : "unknown",
    topic: typeof p.topic === "string" ? p.topic : "unknown",
  };
}