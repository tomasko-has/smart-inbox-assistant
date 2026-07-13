// src/seed.ts
// Trigger simulation: sends a batch of realistic sample messages
// to the webhook endpoint, one by one, with a short pause between them.
//
// Run it (with the server already running) via:
//   npm run seed
//
// Watch the dashboard while it runs — messages appear automatically.

const API_URL = process.env.API_URL ?? "http://localhost:3000/api/messages";

interface SampleMessage {
  from?: string;
  subject?: string;
  body: string;
}

const SAMPLE_MESSAGES: SampleMessage[] = [
  {
    from: "anna.kowalski@gmail.com",
    subject: "Wrong size delivered",
    body: "Hello, I received my order #88231 today but the shoes are size 38 instead of 39. I need the correct size before my sister's wedding on Saturday! Please help. Anna Kowalski",
  },
  {
    from: "mike.t@outlook.com",
    subject: "Question about bulk pricing",
    body: "Hi, I run a small office (15 people) and I'm interested in ordering ergonomic chairs for the whole team. Do you offer volume discounts? Best, Mike Thompson, +44 7911 123456",
  },
  {
    body: "hey do u have this in blue??",
  },
  {
    from: "noreply@win-big-casino.biz",
    subject: "YOU ARE OUR LUCKY WINNER!!!",
    body: "Dear friend! You have been selected to receive $5000 in FREE casino credits! Click here immediately to claim your prize before it expires!!!",
  },
  {
    from: "sarah.jensen@nordicdesign.dk",
    subject: "Order #55402 — invoice needed",
    body: "Good morning, could you please send me the invoice for order #55402? Our accounting department needs it for Q3 processing. Thank you, Sarah Jensen, Nordic Design ApS",
  },
  {
    from: "d.martinez@yahoo.com",
    subject: "REFUND NOT RECEIVED - 3 WEEKS",
    body: "This is the THIRD time I am writing. I returned the coffee machine three weeks ago and still no refund of $249. If I don't hear back within 48 hours I am contacting my bank and leaving reviews everywhere. Daniel Martinez, 555-0177",
  },
];

// Small helper: wait N milliseconds
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendMessage(message: SampleMessage): Promise<void> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`  ✗ Failed (${res.status}): ${text}`);
    return;
  }

  const stored = (await res.json()) as {
    processed: { category: string; priority: string };
  };
  console.log(
    `  ✓ Processed → ${stored.processed.category} / ${stored.processed.priority}`
  );
}

async function main(): Promise<void> {
  console.log(`Seeding ${SAMPLE_MESSAGES.length} messages to ${API_URL}\n`);

  for (const [i, message] of SAMPLE_MESSAGES.entries()) {
    console.log(`[${i + 1}/${SAMPLE_MESSAGES.length}] ${message.subject ?? "(no subject)"}`);
    await sendMessage(message);
    // Pause between messages so you can watch them appear on the dashboard
    await sleep(1500);
  }

  console.log("\nDone. Check the dashboard: http://localhost:3000");
}

main();