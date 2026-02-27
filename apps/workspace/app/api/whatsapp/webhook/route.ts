import { NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@workspace/lib/whatsapp";

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

/**
 * GET: Verification endpoint for WhatsApp Cloud API webhook
 * Meta will call this once when you configure the webhook.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (!VERIFY_TOKEN) {
    console.error("WHATSAPP_WEBHOOK_VERIFY_TOKEN is not configured");
  }

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST: Receive incoming WhatsApp messages and send a reply
 * This uses your existing sendWhatsAppMessage helper and token handling.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log(
      "Incoming WhatsApp webhook payload:",
      JSON.stringify(body, null, 2)
    );

    // Basic validation – ignore non-WhatsApp business events
    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        const value = change.value || {};
        const messages = value.messages || [];

        for (const message of messages) {
          const from = message.from;
          const msgBody = message.text?.body || "";

          if (!from || !msgBody) {
            continue;
          }

          console.log("Processing incoming message from:", from, msgBody);

          try {
            // Simple auto‑reply – customize as needed
            await sendWhatsAppMessage(
              from,
              `Thanks for your message! We received: "${msgBody}"`
            );
          } catch (err) {
            console.error("Failed to send WhatsApp auto-reply:", err);
          }
        }
      }
    }

    // Always return 200 so Meta treats the webhook as delivered
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("Error handling WhatsApp webhook:", err);
    return NextResponse.json(
      { error: "Error handling WhatsApp webhook" },
      { status: 500 }
    );
  }
}

