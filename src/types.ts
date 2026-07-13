// src/types.ts
// Shared types for the whole application.
// One source of truth: the server, the AI module and (later) the dashboard
// all speak the same language.

// What arrives from the outside world (webhook payload)
export interface IncomingMessage {
    from?: string; // sender's email address, if the source knows it
    subject?: string; // email subject / form topic, if available
    body: string; // the message text itself — the only required field
  }
  
  // Allowed values — union types instead of plain strings.
  // A typo like "Orders" simply won't compile / won't validate.
  export const CATEGORIES = [
    "Order",
    "Complaint",
    "General Question",
    "Spam",
  ] as const;
  export type Category = (typeof CATEGORIES)[number];
  
  export const PRIORITIES = ["High", "Medium", "Low"] as const;
  export type Priority = (typeof PRIORITIES)[number];
  
  // What the AI returns after processing a message
  export interface ProcessedMessage {
    summary: string; // 1-2 sentence summary of the message
    category: Category;
    priority: Priority;
    sender_name: string; // "unknown" if not present in the message
    contact: string; // email/phone found in the message, "unknown" if none
    topic: string; // product/subject the message is about, "unknown" if unclear
  }
  
  // A complete record as stored in the system:
  // the original message + AI analysis + metadata
  export interface StoredMessage {
    id: string; // unique identifier
    receivedAt: string; // ISO timestamp of when the message arrived
    original: {
      from: string | null;
      subject: string | null;
      body: string;
    };
    processed: ProcessedMessage;
  }