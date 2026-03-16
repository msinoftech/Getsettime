/**
 * WhatsApp Webhook Handler
 * 
 * SETUP INSTRUCTIONS:
 * 
 * 1. Set up environment variable:
 *    Add to your .env file:
 *    WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_secret_token_here
 * 
 * 2. Configure webhook in Meta Business Manager:
 *    - Go to Meta Business Manager > WhatsApp > Configuration > Webhooks
 *    - Click "Edit" on your webhook
 *    - Callback URL: https://yourdomain.com/api/whatsapp/webhook
 *    - Verify Token: (use the same value as WHATSAPP_WEBHOOK_VERIFY_TOKEN)
 *    - Subscribe to: messages
 *    - Click "Verify and Save"
 * 
 * 3. Meta will call GET /api/whatsapp/webhook to verify
 *    - If successful, you'll see "✅ Webhook verification successful!" in logs
 *    - If failed, check the error message in logs to see what's wrong
 * 
 * 4. Once verified, Meta will send POST requests to this endpoint
 *    when users send messages to your WhatsApp Business number
 */

import { NextResponse } from "next/server";
import {
  sendWhatsAppMessage,
  sendWhatsAppReply,
  sendWhatsAppList,
  sendWhatsAppButtons,
} from "@workspace/lib/whatsapp";

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

/**
 * Helper function to detect if a message is a phone number
 * Checks for patterns like: +1234567890, 1234567890, (123) 456-7890, etc.
 */
function isPhoneNumber(text: string): boolean {
  // Remove all spaces, dashes, parentheses, and plus signs for validation
  const cleaned = text.replace(/[\s\-\(\)\+]/g, "");
  
  // Check if it's all digits and has at least 10 digits (minimum for phone number)
  // and at most 15 digits (international max)
  if (!/^\d+$/.test(cleaned)) {
    return false;
  }
  
  const digitCount = cleaned.length;
  
  // Phone numbers should be between 10 and 15 digits
  // Also check if the original text has phone-like formatting
  return digitCount >= 10 && digitCount <= 15 && 
         (text.includes("+") || text.includes("-") || text.includes("(") || 
          text.includes(")") || digitCount >= 10);
}

/**
 * GET: Verification endpoint for WhatsApp Cloud API webhook
 * Meta will call this once when you configure the webhook.
 * 
 * How it works:
 * 1. Meta sends: ?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=RANDOM_STRING
 * 2. You verify the token matches your WHATSAPP_WEBHOOK_VERIFY_TOKEN
 * 3. You return the challenge string to complete verification
 */
export async function GET(req: Request) {
  // Get the full URL for debugging
  const url = new URL(req.url);
  
  // Log the full URL to see what we're receiving
  console.log("Full webhook URL:", url.toString());
  console.log("URL search params:", url.search);
  
  const { searchParams } = url;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Log all incoming parameters for debugging
  console.log("Webhook verification request:", {
    url: url.toString(),
    search: url.search,
    mode,
    tokenReceived: token ? "***" + token.slice(-4) : "missing",
    challenge: challenge ? "present" : "missing",
    verifyTokenConfigured: VERIFY_TOKEN ? "yes" : "no",
    allParams: Object.fromEntries(searchParams.entries())
  });
  
  // If this is a browser request (no parameters), return a helpful message
  if (!mode && !token && !challenge) {
    console.log("⚠️ Browser or direct access detected (no webhook parameters)");
    return NextResponse.json(
      {
        message: "WhatsApp Webhook Endpoint",
        instructions: "This endpoint is for WhatsApp webhook verification. Meta will call this with query parameters: hub.mode, hub.verify_token, and hub.challenge",
        status: "waiting_for_verification"
      },
      { status: 200 }
    );
  }

  // Check if verify token is configured
  if (!VERIFY_TOKEN) {
    console.error("❌ WHATSAPP_WEBHOOK_VERIFY_TOKEN is not configured in environment variables");
    return NextResponse.json(
      { 
        error: "Webhook verify token not configured",
        message: "Please set WHATSAPP_WEBHOOK_VERIFY_TOKEN in your .env file"
      },
      { status: 500 }
    );
  }

  // Verify all required parameters
  if (mode !== "subscribe") {
    console.error("❌ Invalid mode:", mode, "(expected: 'subscribe')");
    return NextResponse.json(
      { 
        error: "Invalid mode",
        received: mode,
        expected: "subscribe"
      },
      { status: 403 }
    );
  }

  if (!token) {
    console.error("❌ Missing hub.verify_token parameter");
    return NextResponse.json(
      { error: "Missing verify token" },
      { status: 403 }
    );
  }

  if (token !== VERIFY_TOKEN) {
    console.error("❌ Token mismatch:", {
      received: "***" + token.slice(-4),
      expected: "***" + VERIFY_TOKEN.slice(-4)
    });
    return NextResponse.json(
      { 
        error: "Token mismatch",
        message: "The verify token does not match WHATSAPP_WEBHOOK_VERIFY_TOKEN"
      },
      { status: 403 }
    );
  }

  if (!challenge) {
    console.error("❌ Missing hub.challenge parameter");
    return NextResponse.json(
      { error: "Missing challenge" },
      { status: 403 }
    );
  }

  // All checks passed - return challenge to complete verification
  console.log("✅ Webhook verification successful!");
  return new Response(challenge, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
}

/**
 * POST: Receive incoming WhatsApp messages and handle them
 * Supports:
 * - Message status updates (sent, delivered, read, etc.)
 * - Text messages with commands (hello, list, buttons)
 * - Interactive messages (list replies, button replies)
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

    if (!entries || entries.length === 0) {
      return NextResponse.json({ error: "Invalid Request" }, { status: 400 });
    }

    for (const entry of entries) {
      const changes = entry.changes || [];

      if (!changes || changes.length === 0) {
        return NextResponse.json({ error: "Invalid Request" }, { status: 400 });
      }

      for (const change of changes) {
        const value = change.value || {};
        const statuses = value.statuses ? value.statuses[0] : null;
        const messages = value.messages ? value.messages[0] : null;

        // Handle message status updates
        if (statuses) {
          console.log(`
            MESSAGE STATUS UPDATE:
            ID: ${statuses.id},
            STATUS: ${statuses.status}
          `);
          // You can add custom logic here to track message status
          continue;
        }

        // Handle incoming messages
        if (messages) {
          const from = messages.from;
          const messageId = messages.id;

          if (!from) {
            continue;
          }

          // Handle text messages
          if (messages.type === "text") {
            const msgBody = messages.text?.body || "";

            if (!msgBody) {
              continue;
            }

            console.log("Processing text message from:", from, msgBody);

            try {
              const lowerBody = msgBody.toLowerCase().trim();

              // Handle "hello" command
              if (lowerBody === "hello") {
                await sendWhatsAppReply(
                  from,
                  "Hello. How are you?",
                  messageId
                );
              }
              // Handle "list" command
              else if (lowerBody === "list") {
                await sendWhatsAppList(from, {
                  header: "Message Header",
                  body: "This is a interactive list message",
                  footer: "This is the message footer",
                  buttonText: "Tap for the options",
                  sections: [
                    {
                      title: "First Section",
                      rows: [
                        {
                          id: "first_option",
                          title: "First option",
                          description:
                            "This is the description of the first option",
                        },
                        {
                          id: "second_option",
                          title: "Second option",
                          description:
                            "This is the description of the second option",
                        },
                      ],
                    },
                    {
                      title: "Second Section",
                      rows: [
                        {
                          id: "third_option",
                          title: "Third option",
                        },
                      ],
                    },
                  ],
                });
              }
              // Handle "buttons" command
              else if (lowerBody === "buttons") {
                await sendWhatsAppButtons(from, {
                  header: "Message Header",
                  body: "This is a interactive reply buttons message",
                  footer: "This is the message footer",
                  buttons: [
                    {
                      id: "first_button",
                      title: "First Button",
                    },
                    {
                      id: "second_button",
                      title: "Second Button",
                    },
                  ],
                });
              }
              // Handle "phone" or "add phone" command - prompt for phone number
              else if (lowerBody === "phone" || lowerBody === "add phone" || lowerBody === "addphone" || lowerBody === "contact") {
                await sendWhatsAppMessage(
                  from,
                  "📱 *Phone Number Request*\n\nPlease send us your phone number.\n\n*Format:*\n• Include country code\n• You can use + or just numbers\n• Spaces, dashes, or parentheses are okay\n\n*Examples:*\n• +1234567890\n• 1234567890\n• +1 (234) 567-8900\n\nJust type your number and send it! 📞"
                );
              }
              // Handle phone number input (check if message looks like a phone number)
              else if (isPhoneNumber(msgBody)) {
                // Extract phone number (remove spaces, dashes, parentheses)
                const phoneNumber = msgBody.replace(/[\s\-\(\)]/g, "");
                console.log("✅ Phone number received:", phoneNumber, "from:", from);
                
                await sendWhatsAppReply(
                  from,
                  `✅ *Phone Number Received*\n\nThank you! We have saved your phone number:\n*${phoneNumber}*\n\nWe will contact you shortly. If you need to update it, just send "phone" again.`,
                  messageId
                );
                
                // Here you can add logic to save the phone number to your database
                // Example:
                // await savePhoneNumberToDatabase(from, phoneNumber);
              }
              // Default response for other messages
              else {
                await sendWhatsAppMessage(
                  from,
                  `Thanks for your message! We received: "${msgBody}"`
                );
              }
            } catch (err) {
              console.error("Failed to send WhatsApp reply:", err);
            }
          }
          // Handle interactive messages (list replies, button replies)
          else if (messages.type === "interactive") {
            if (messages.interactive?.type === "list_reply") {
              const listReply = messages.interactive.list_reply;
              console.log("List reply received:", listReply);

              try {
                await sendWhatsAppMessage(
                  from,
                  `You selected the option with ID ${listReply.id} - Title ${listReply.title}`
                );
              } catch (err) {
                console.error("Failed to send list reply response:", err);
              }
            } else if (messages.interactive?.type === "button_reply") {
              const buttonReply = messages.interactive.button_reply;
              console.log("Button reply received:", buttonReply);

              try {
                await sendWhatsAppMessage(
                  from,
                  `You selected the button with ID ${buttonReply.id} - Title ${buttonReply.title}`
                );
              } catch (err) {
                console.error("Failed to send button reply response:", err);
              }
            }
          }

          // Log full message for debugging
          console.log("Full message data:", JSON.stringify(messages, null, 2));
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