// src/mailWatcher.ts
// Optional real-world trigger: watches an IMAP mailbox (e.g. Gmail)
// and forwards every new unseen email to the webhook endpoint —
// exactly like an external source (n8n, contact form) would.
//
// Enabled only when IMAP_* variables are present in .env.
// Processed emails are marked as \Seen so they are never handled twice.

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

const POLL_INTERVAL_MS = 30_000; // check for new mail every 30 seconds

interface MailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

// Read config from env; return null if the feature is not configured
function getMailConfig(): MailConfig | null {
  const { IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASSWORD } = process.env;
  if (!IMAP_HOST || !IMAP_USER || !IMAP_PASSWORD) return null;

  return {
    host: IMAP_HOST,
    port: Number(IMAP_PORT ?? 993),
    user: IMAP_USER,
    password: IMAP_PASSWORD,
  };
}

// Forward one email to the webhook — same path as any other source.
// Includes the webhook token when configured (production).
async function forwardToWebhook(
  apiUrl: string,
  from: string | undefined,
  subject: string | undefined,
  body: string
): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.WEBHOOK_TOKEN) {
    headers["x-webhook-token"] = process.env.WEBHOOK_TOKEN;
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ from, subject, body }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Webhook responded ${res.status}: ${text}`);
  }
}

// One polling round: connect, fetch unseen emails, forward them, mark seen.
// A fresh connection per round is simpler and more robust than keeping
// a long-lived connection alive (no reconnect logic needed).
async function checkOnce(config: MailConfig, apiUrl: string): Promise<void> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: config.user, pass: config.password },
    logger: false, // imapflow's own logging is very noisy
  });

  await client.connect();

  try {
    // Lock the mailbox for the duration of our work
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Find all unseen messages
      const unseen = await client.search({ seen: false });

      if (unseen && unseen.length > 0) {
        console.log(`MailWatcher: found ${unseen.length} new email(s)`);

        for (const uid of unseen) {
          // Download the full raw message and parse it
          const message = await client.fetchOne(String(uid), { source: true });
          if (!message || !message.source) continue;

          const parsed = await simpleParser(message.source);

          const from = parsed.from?.value?.[0]?.address;
          const subject = parsed.subject ?? undefined;
          // Prefer plain text; fall back to HTML stripped by mailparser
          const body = (parsed.text ?? parsed.html ?? "").toString().trim();

          if (body === "") {
            console.log(`MailWatcher: skipping empty email (uid ${uid})`);
            await client.messageFlagsAdd(String(uid), ["\\Seen"]);
            continue;
          }

          try {
            await forwardToWebhook(apiUrl, from, subject, body);
            console.log(
              `MailWatcher: processed email from ${from ?? "unknown"} — "${subject ?? "(no subject)"}"`
            );
            // Mark as seen ONLY after successful processing —
            // if the webhook fails, we'll retry on the next round
            await client.messageFlagsAdd(String(uid), ["\\Seen"]);
          } catch (err) {
            console.error(`MailWatcher: failed to process uid ${uid}:`, err);
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// Public entry point: start the polling loop (fire-and-forget)
export function startMailWatcher(apiUrl: string): void {
  const config = getMailConfig();

  if (!config) {
    console.log(
      "MailWatcher: IMAP not configured (no IMAP_* vars in .env) — email trigger disabled."
    );
    return;
  }

  console.log(
    `MailWatcher: watching ${config.user} (checking every ${POLL_INTERVAL_MS / 1000}s)`
  );

  const run = async (): Promise<void> => {
    try {
      await checkOnce(config, apiUrl);
    } catch (err) {
      // Network/auth errors must not kill the server — log and retry next round
      console.error("MailWatcher: polling round failed:", err);
    }
  };

  run(); // first check immediately on startup
  setInterval(run, POLL_INTERVAL_MS);
}