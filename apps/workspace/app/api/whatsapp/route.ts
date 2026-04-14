import { NextResponse } from "next/server";
import { sendWhatsAppTemplate } from "@workspace/lib/whatsapp";
import nodemailer from "nodemailer";
import type { WhatsAppTemplateComponent } from "@workspace/lib/types";

function normalize_admin_phones(admin_phone: unknown): string[] {
  if (admin_phone == null) return [];
  if (Array.isArray(admin_phone)) {
    const flat = admin_phone.flat(Infinity) as unknown[];
    return flat
      .filter((x): x is string => typeof x === "string" && x.trim() !== "")
      .map((s) => s.trim());
  }
  if (typeof admin_phone === "string" && admin_phone.trim() !== "") {
    return [admin_phone.trim()];
  }
  return [];
}

function text_or_empty(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

type notification_kind = "booking" | "reminder" | "cancel" | "reschedule";

/** Per-kind Meta template names — user (invitee) side. */
const USER_TEMPLATE_NAMES: Record<notification_kind, string> = {
  booking: "booking_confirmation",
  reminder: "whatsapp_reminder",
  cancel: "appointment_cancelled", // old: appointment_cancelled, New: appointment_cancelled_to_user
  reschedule: "appointment_rescheduled",
};

/** Per-kind Meta template names — admin side. */
const ADMIN_TEMPLATE_NAMES: Record<notification_kind, string> = {
  booking: "booking_received",
  reminder: "whatsapp_reminder",
  cancel: "appointment_cancelled", // old: appointment_cancelled, New: appointment_cancelled_to_admin
  reschedule: "appointment_rescheduled", // old: appointment_rescheduled, New: appointment_rescheduled_to_admin
};

/** Per-kind template language codes (all default to "en"; override per-kind if needed). */
const TEMPLATE_LANGUAGE_CODES: Record<notification_kind, string> = {
  booking: "en",
  reminder: "en",
  cancel: "en",
  reschedule: "en",
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      phone,
      message,
      service,
      department,
      provider,
      start,
      end,
      note,
      arrive_early_min,
      arrive_early_max,
      booking_reference,
      // Optional flags to control which WhatsApp messages are sent.
      // Default to true for backward compatibility with existing callers.
      send_to_user = true,
      send_to_admin = true,
      admin_phone,
      skip_contact_form_email = false,
      notification_kind = "booking",
      cancelled_by,
    } = body;

    const validKinds: notification_kind[] = ["booking", "reminder", "cancel", "reschedule"];
    const whatsapp_flow_kind: notification_kind = validKinds.includes(
      notification_kind as notification_kind
    )
      ? (notification_kind as notification_kind)
      : "booking";

    if (!phone) {
      return NextResponse.json(
        { error: "Recipient phone number is required" },
        { status: 400 }
      );
    }

    if (!name || !message) {
      return NextResponse.json(
        { error: "Name and message are required" },
        { status: 400 }
      );
    }

    /**
     * MESSAGE FLOW:
     * - phone = phone number from form (TO whom we send)
     * - PHONE_NUMBER_ID = Meta business number (FROM whom we send - sender only)
     *
     * The message will be sent FROM Meta business number TO the form phone number
     * Phone formatting is handled in whatsapp.ts (formatPhoneNumber function)
     */

    // ================= EMAIL =================
    let emailSent = false;
    let emailError: string | null = null;

    if (!skip_contact_form_email) {
      try {
        // Check if email configuration is available
        if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });

          await transporter.sendMail({
            from: `"Contact Form" <${process.env.SMTP_USER}>`,
            to: process.env.SEND_TO || process.env.SMTP_USER,
            subject: "New Contact Form Submission",
            html: `
            <h2>New Contact Form Submission</h2>
            <p><b>Name:</b> ${name}</p>
            <p><b>Email:</b> ${email || "Not provided"}</p>
            <p><b>Phone:</b> ${phone}</p>
            <p><b>Message:</b></p>
            <p>${String(message).replace(/\n/g, "<br>")}</p>
            <hr>
            <p><small>Submitted: ${new Date().toLocaleString()}</small></p>
          `,
          });

          emailSent = true;
          console.log("Email sent successfully");
        } else {
          console.warn("Email configuration not found, skipping email notification");
          emailError = "Email configuration not available";
        }
      } catch (emailErr: unknown) {
        const err = emailErr as { message?: string };
        emailError = err.message || "Unknown email error";
        console.error("Email sending error:", emailErr);
      }
    }

    // ================= WHATSAPP =================
    let userWhatsappSent = false;
    let userWhatsappError: string | null = null;
    let userWhatsappResult: unknown = null;
    let adminWhatsappSent = false;
    let adminWhatsappError: string | null = null;
    let adminWhatsappResults: unknown[] = [];

    const userTemplateName = USER_TEMPLATE_NAMES[whatsapp_flow_kind];
    const adminTemplateName = ADMIN_TEMPLATE_NAMES[whatsapp_flow_kind];
    const languageCode = TEMPLATE_LANGUAGE_CODES[whatsapp_flow_kind];

    const firstName = String(name).split(" ")[0] || String(name);
    const fullName = String(name);

    const formatDateTimeForTemplate = (value: unknown) => {
      if (!value) return "Not provided";
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) return String(value);
      return date.toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    };
    const formattedStart = formatDateTimeForTemplate(start);
    const formattedEnd = formatDateTimeForTemplate(end);

    const safeService = text_or_empty(service);
    const safeDepartment = text_or_empty(department);
    const safeProvider = text_or_empty(provider);
    const safeNote = text_or_empty(note);

    const safeCancelledBy = text_or_empty(cancelled_by) || "N/A";

    const userTemplateParamsByKind: Record<notification_kind, string[]> = {
      booking: [
        firstName || "N/A",
        fullName || "N/A",
        email ? String(email) : "Not provided",
        String(phone) || "N/A",
        safeService || "N/A",
        safeDepartment || "N/A",
        safeProvider || "N/A",
        formattedStart,
        formattedEnd,
        safeNote || "N/A",
        String(arrive_early_min ?? 10),
        String(arrive_early_max ?? 15),
      ],
      reminder: [
        firstName || "N/A",
        safeService || "N/A",
        safeProvider || "N/A",
        safeDepartment || "N/A",
        formattedStart,
        formattedEnd,
        String(arrive_early_min ?? 10),
      ],
      cancel: [
        firstName || "N/A",
        safeService || "N/A",
        safeProvider || "N/A",
        formattedStart,
        formattedEnd,
        safeCancelledBy,
      ],
      reschedule: [
        firstName || "N/A",
        safeService || "N/A",
        safeProvider || "N/A",
        safeDepartment || "N/A",
        formattedStart,
        formattedEnd,
        String(arrive_early_min ?? 10),
      ],
    };

    const adminTemplateParamsByKind: Record<notification_kind, string[]> = {
      booking: [
        fullName || "N/A",
        email ? String(email) : "Not provided",
        String(phone) || "N/A",
        safeService || "N/A",
        safeDepartment || "N/A",
        safeProvider || "N/A",
        formattedStart,
        formattedEnd,
        safeNote || "N/A",
      ],
      reminder: userTemplateParamsByKind.reminder,
      cancel: userTemplateParamsByKind.cancel,
      reschedule: userTemplateParamsByKind.reschedule,
    };

    const userTemplateParams = userTemplateParamsByKind[whatsapp_flow_kind];
    const adminTemplateParams = adminTemplateParamsByKind[whatsapp_flow_kind];

    if (send_to_user) {
      const userTemplateComponents: WhatsAppTemplateComponent[] = [
        {
          type: "body",
          parameters: userTemplateParams.map((param) => ({
            type: "text" as const,
            text: String(param).substring(0, 32768),
          })),
        },
      ];

      if (booking_reference) {
        userTemplateComponents.push({
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [
            {
              type: "text",
              text: String(booking_reference),
            },
          ],
        });
      }

      console.log("Sending WhatsApp template to user:", {
        flow: whatsapp_flow_kind,
        phone,
        template: userTemplateName,
        language: languageCode,
        parametersCount: userTemplateParams.length,
        bookingReference: booking_reference,
      });

      try {
        userWhatsappResult = await sendWhatsAppTemplate(
          phone,
          userTemplateName,
          languageCode,
          userTemplateComponents
        );
        userWhatsappSent = true;
        console.log("WhatsApp template message sent to user successfully:", {
          messageId: (userWhatsappResult as { messages?: { id?: string }[] })
            ?.messages?.[0]?.id,
        });
      } catch (userWhatsappErr: unknown) {
        const err = userWhatsappErr as { message?: string };
        userWhatsappError = err.message || "Unknown WhatsApp error";
        console.error("WhatsApp sending error to user:", {
          error: err.message,
          template: userTemplateName,
          language: languageCode,
          phone,
          fullError:
            process.env.NODE_ENV === "development" ? userWhatsappErr : undefined,
        });
      }
    }

    const adminNumbers = normalize_admin_phones(admin_phone);
    console.log("Sending WhatsApp template to admins:", {
      adminCount: adminNumbers.length,
      send_to_admin: send_to_admin,
    });

    if (send_to_admin && adminNumbers.length > 0) {
      const adminTemplateComponents: WhatsAppTemplateComponent[] = [
        {
          type: "body",
          parameters: adminTemplateParams.map((param) => ({
            type: "text" as const,
            text: String(param).substring(0, 32768),
          })),
        },
      ];

      if (booking_reference) {
        adminTemplateComponents.push({
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [
            {
              type: "text",
              text: String(booking_reference),
            },
          ],
        });
      }

      try {
        const adminPromises = adminNumbers.map((adminPhone) =>
          sendWhatsAppTemplate(
            adminPhone,
            adminTemplateName,
            languageCode,
            adminTemplateComponents
          )
            .then((result) => ({ phone: adminPhone, success: true, result }))
            .catch((error: Error) => ({
              phone: adminPhone,
              success: false,
              error: error.message || "Unknown error",
              details:
                process.env.NODE_ENV === "development" ? error.stack : undefined,
            }))
        );

        const adminResults = await Promise.all(adminPromises);
        adminWhatsappResults = adminResults;

        const successfulAdmins = adminResults.filter((r) => r.success).length;
        adminWhatsappSent = successfulAdmins > 0;

        if (successfulAdmins > 0) {
          console.log(
            `WhatsApp template message sent to ${successfulAdmins} admin(s) successfully`
          );
        }

        const failedAdmins = adminResults.filter((r) => !r.success);
        if (failedAdmins.length > 0) {
          adminWhatsappError = `Failed to send to ${failedAdmins.length} admin(s)`;
          console.error("Some admin WhatsApp messages failed:", failedAdmins);
        }
      } catch (adminWhatsappErr: unknown) {
        const err = adminWhatsappErr as { message?: string };
        adminWhatsappError = err.message || "Unknown admin WhatsApp error";
        console.error("Admin WhatsApp sending error:", adminWhatsappErr);
      }
    } else if (send_to_admin && adminNumbers.length === 0) {
      console.warn(
        "Admin WhatsApp notifications enabled but no admin_phone numbers were provided; skipping admin send"
      );
      adminWhatsappError = "No admin recipient numbers";
    }

    const whatsappSent = userWhatsappSent || adminWhatsappSent;
    const success = emailSent || whatsappSent;

    return NextResponse.json({
      success,
      emailSent,
      whatsappSent,
      userWhatsappSent,
      adminWhatsappSent,
      sentTo: phone,
      userMessageId: (userWhatsappResult as { messages?: { id?: string }[] })
        ?.messages?.[0]?.id,
      adminCount: adminNumbers.length,
      adminResults: adminWhatsappResults,
      templateInfo: {
        flow: whatsapp_flow_kind,
        userTemplate: userTemplateName,
        adminTemplate: adminTemplateName,
        language: languageCode,
        userParametersCount: userTemplateParams.length,
        adminParametersCount: adminTemplateParams.length,
      },
      ...(emailError ? { emailError } : {}),
      ...(userWhatsappError ? { userWhatsappError } : {}),
      ...(adminWhatsappError ? { adminWhatsappError } : {}),
      ...(typeof userWhatsappResult === "object" &&
      userWhatsappResult !== null
        ? { userWhatsappResult }
        : {}),
    });
  } catch (err: unknown) {
    console.error("Contact Form API Route Error:", err);

    let errorMessage = err instanceof Error ? err.message : "Failed to send message";
    let statusCode = 500;

    if (
      errorMessage.includes("not in allowed list") ||
      errorMessage.includes("recipient")
    ) {
      errorMessage =
        "Recipient phone number is not registered with WhatsApp or not in test list. Please ensure the number is valid and registered with WhatsApp.";
      statusCode = 400;
    } else if (
      errorMessage.includes("invalid") ||
      errorMessage.includes("format")
    ) {
      errorMessage =
        "Invalid phone number format. Please use international format (e.g., 919876543210)";
      statusCode = 400;
    } else if (
      errorMessage.includes("token") ||
      errorMessage.includes("authentication")
    ) {
      errorMessage =
        "WhatsApp API authentication failed. Please check your credentials.";
      statusCode = 401;
    } else if (
      errorMessage.includes("template") ||
      errorMessage.includes("parameter")
    ) {
      errorMessage = `Template error: ${errorMessage}. Please verify: 1) Template name is correct, 2) Template is approved in Meta Business Manager, 3) Parameter count matches each template, 4) Language code is correct.`;
      statusCode = 400;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: statusCode }
    );
  }
}
