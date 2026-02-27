import fs from "fs/promises";
import path from "path";
import os from "os";

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v18.0";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const APP_ID = process.env.WHATSAPP_APP_ID!;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET!;
const FALLBACK_ACCESS_TOKEN = process.env.WHATSAPP_FALLBACK_TOKEN!;

// Use OS temp directory for cross-platform compatibility (Windows/Linux/Mac)
const TOKEN_CACHE_PATH = path.join(os.tmpdir(), "whatsapp_token.json");
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

async function readCachedToken() {
  try {
    const raw = await fs.readFile(TOKEN_CACHE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeCachedToken(tokenObj: any) {
  try {
    await fs.writeFile(TOKEN_CACHE_PATH, JSON.stringify(tokenObj));
  } catch {
    // ignore
  }
}

async function exchangeToken(currentToken: string) {
  // OAuth token exchange uses Facebook Graph API base URL, not WhatsApp API URL
  const graphApiBase = WHATSAPP_API_URL.includes("graph.facebook.com") 
    ? WHATSAPP_API_URL.split("/v")[0] + "/v22.0"
    : "https://graph.facebook.com/v22.0";
  
  const url = `${graphApiBase}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${currentToken}`;

  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(`Token exchange failed: ${errorData.error?.message || res.statusText}`);
  }

  const data = await res.json();
  const expiresAt = Date.now() + data.expires_in * 1000;

  const tokenObj = {
    access_token: data.access_token,
    expires_at: expiresAt
  };

  await writeCachedToken(tokenObj);
  return tokenObj.access_token;
}

export async function getValidToken() {
  const cached = await readCachedToken();

  if (
    cached &&
    cached.access_token &&
    Date.now() + TOKEN_EXPIRY_BUFFER_MS < cached.expires_at
  ) {
    return cached.access_token;
  }

  try {
    return await exchangeToken(cached?.access_token || FALLBACK_ACCESS_TOKEN);
  } catch {
    return FALLBACK_ACCESS_TOKEN;
  }
}

/**
 * Format phone number for WhatsApp API
 * WhatsApp requires: international format, digits only, no +, no spaces
 * Example: 919876543210 (India), 1234567890 (US)
 */
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");
  
  // Remove leading + if somehow present
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }
  
  // Ensure minimum length (at least 10 digits)
  if (cleaned.length < 10) {
    throw new Error("Phone number must be at least 10 digits");
  }
  
  return cleaned;
}

/**
 * Send WhatsApp text message (for 24h window after user replies)
 * 
 * @param to - Recipient phone number
 * @param message - Message content to send
 * 
 * IMPORTANT: This can only be used within 24 hours after user replies.
 * For first messages, use sendWhatsAppTemplate() instead.
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string
) {
  // Validate and format phone number
  const formattedPhone = formatPhoneNumber(to);
  
  // Validate required environment variables
  if (!PHONE_NUMBER_ID) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID is not configured");
  }
  
  if (!FALLBACK_ACCESS_TOKEN) {
    throw new Error("WHATSAPP_FALLBACK_TOKEN is not configured");
  }

  const token = await getValidToken();
  
  if (!token) {
    throw new Error("Failed to obtain WhatsApp access token");
  }

  const apiUrl = `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`;
  
  const requestBody = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "text",
    text: {
      body: message
    }
  };

  console.log("Sending WhatsApp text message:", {
    to: formattedPhone,
    from: PHONE_NUMBER_ID
  });

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  const responseData = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMessage = responseData.error?.message || responseData.error?.error_user_msg || `WhatsApp API error: ${res.status}`;
    const errorCode = responseData.error?.code || res.status;
    const errorType = responseData.error?.type || "unknown";
    
    console.error("WhatsApp API Error:", {
      status: res.status,
      error: responseData.error,
      phone: formattedPhone
    });
    
    throw new Error(`${errorMessage} (Code: ${errorCode}, Type: ${errorType})`);
  }

  console.log("WhatsApp message sent successfully:", responseData);
  return responseData;
}

/**
 * Send WhatsApp template message (REQUIRED for first messages)
 * 
 * @param to - Recipient phone number
 * @param templateName - Name of the approved template (e.g., "hello_world", "welcome_message")
 * @param languageCode - Language code (default: "en_US")
 * @param components - Optional template parameters/components
 * 
 * Use this for FIRST messages to users (WhatsApp requirement)
 * Templates must be approved in Meta Business Manager
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string = "en_US",
  components?: Array<{
    type: "header" | "body" | "button";
    parameters?: Array<{
      type: "text" | "currency" | "date_time" | "image" | "document" | "video";
      text?: string;
      currency?: { fallback_value: string; code: string; amount_1000: number };
      date_time?: { fallback_value: string };
      image?: { link: string };
      document?: { link: string };
      video?: { link: string };
    }>;
    sub_type?: "url" | "quick_reply";
    index?: number;
  }>
) {
  // Validate and format phone number
  const formattedPhone = formatPhoneNumber(to);
  
  // Validate required environment variables
  if (!PHONE_NUMBER_ID) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID is not configured");
  }
  
  if (!FALLBACK_ACCESS_TOKEN) {
    throw new Error("WHATSAPP_FALLBACK_TOKEN is not configured");
  }

  if (!templateName) {
    throw new Error("Template name is required");
  }

  const token = await getValidToken();
  
  if (!token) {
    throw new Error("Failed to obtain WhatsApp access token");
  }

  const apiUrl = `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`;
  
  const requestBody: any = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode || "en" // Default to "en" if not provided
      }
    }
  };

  // Add components if provided
  if (components && components.length > 0) {
    requestBody.template.components = components;
  }

  console.log("Sending WhatsApp template message:", {
    to: formattedPhone,
    template: templateName,
    language: languageCode,
    componentsCount: components?.length || 0
  });

  // Log full request body for debugging (in development only)
  if (process.env.NODE_ENV === "development") {
    console.log("WhatsApp API Request Body:", JSON.stringify(requestBody, null, 2));
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  const responseData = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMessage = responseData.error?.message || responseData.error?.error_user_msg || `WhatsApp API error: ${res.status}`;
    const errorCode = responseData.error?.code || res.status;
    const errorType = responseData.error?.type || "unknown";
    
    console.error("WhatsApp Template API Error:", {
      status: res.status,
      error: responseData.error,
      phone: formattedPhone,
      template: templateName
    });
    
    throw new Error(`${errorMessage} (Code: ${errorCode}, Type: ${errorType})`);
  }

  console.log("WhatsApp template message sent successfully:", responseData);
  return responseData;
}

