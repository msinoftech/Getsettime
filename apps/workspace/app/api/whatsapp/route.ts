import { NextResponse } from "next/server";
import { sendWhatsAppTemplate } from "@workspace/lib/whatsapp";
import nodemailer from "nodemailer";
import type { WhatsAppTemplateComponent } from "@workspace/lib/types";

export async function POST(req: Request) {
  try {
    const { name, email, phone, message } = await req.json();

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

    try {
      // Check if email configuration is available
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          // port: Number(process.env.EMAIL_PORT) || 587,
          // secure: process.env.EMAIL_PORT === "465", // true for 465, false for other ports
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
            <p>${message.replace(/\n/g, "<br>")}</p>
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
    } catch (emailErr: any) {
      emailError = emailErr.message || "Unknown email error";
      console.error("Email sending error:", emailErr);
      // Don't fail the request if email fails, but log it
    }

    // ================= WHATSAPP =================
    let userWhatsappSent = false;
    let userWhatsappError: string | null = null;
    let userWhatsappResult: any = null;
    let adminWhatsappSent = false;
    let adminWhatsappError: string | null = null;
    let adminWhatsappResults: any[] = [];

    // Template configuration
    const userTemplateName = process.env.USER_WHATSAPP_TEMPLATE || "contact_information";
    const adminTemplateName = process.env.ADMIN_WHATSAPP_TEMPLATE || "contact_information";
    // WhatsApp language codes: Use "en" (not "en_US") as per your example
    const languageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en";

    // Extract first name from full name (first word)
    const firstName = name.split(" ")[0] || name;
    const fullName = name;

    // Prepare template parameters - ensure all values are strings and not empty
    const templateParams = [
      firstName || "N/A",
      fullName || "N/A",
      email || "Not provided",
      phone || "N/A",
      message || "No message"
    ];

    // ================= SEND TO USER =================
    // Build template components for user
    const userTemplateComponents: WhatsAppTemplateComponent[] = [
      {
        type: "body",
        parameters: templateParams.map(param => ({
          type: "text" as const,
          text: String(param).substring(0, 32768) // WhatsApp limit per parameter
        }))
      }
    ];

    console.log("Sending WhatsApp template to user:", {
      phone,
      template: userTemplateName,
      language: languageCode,
      parameters: templateParams,
      parametersCount: templateParams.length
    });

    try {
      userWhatsappResult = await sendWhatsAppTemplate(
        phone,  // TO: Form phone number (user/recipient) - formatting handled in whatsapp.ts
        userTemplateName,
        languageCode,
        userTemplateComponents
      );
      userWhatsappSent = true;
      console.log("WhatsApp template message sent to user successfully:", {
        messageId: userWhatsappResult?.messages?.[0]?.id
      });
    } catch (userWhatsappErr: any) {
      userWhatsappError = userWhatsappErr.message || "Unknown WhatsApp error";
      console.error("WhatsApp sending error to user:", {
        error: userWhatsappErr.message,
        template: userTemplateName,
        language: languageCode,
        phone,
        fullError: process.env.NODE_ENV === "development" ? userWhatsappErr : undefined
      });
      // Continue even if user WhatsApp fails
    }

    // ================= SEND TO ADMINS =================
    const adminNumbers = process.env.ADMIN_WHATSAPP_NUMBERS?.split(",").map(num => num.trim()).filter(num => num) || [];

    if (adminNumbers.length > 0) {
      // Build template components for admin (same parameters as user)
      const adminTemplateComponents: WhatsAppTemplateComponent[] = [
        {
          type: "body",
          parameters: templateParams.map(param => ({
            type: "text" as const,
            text: String(param).substring(0, 32768) // WhatsApp limit per parameter
          }))
        }
      ];

      console.log("Sending WhatsApp template to admins:", {
        adminCount: adminNumbers.length,
        template: adminTemplateName,
        language: languageCode,
        parameters: templateParams,
        parametersCount: templateParams.length
      });

      try {
        // Send to all admins in parallel
        const adminPromises = adminNumbers.map((adminPhone) =>
          sendWhatsAppTemplate(adminPhone, adminTemplateName, languageCode, adminTemplateComponents)
            .then((result) => ({ phone: adminPhone, success: true, result }))
            .catch((error) => ({ 
              phone: adminPhone, 
              success: false, 
              error: error.message || "Unknown error",
              details: process.env.NODE_ENV === "development" ? error.stack : undefined
            }))
        );

        const adminResults = await Promise.all(adminPromises);
        adminWhatsappResults = adminResults;

        const successfulAdmins = adminResults.filter(r => r.success).length;
        adminWhatsappSent = successfulAdmins > 0;

        if (successfulAdmins > 0) {
          console.log(`WhatsApp template message sent to ${successfulAdmins} admin(s) successfully`);
        }

        const failedAdmins = adminResults.filter(r => !r.success);
        if (failedAdmins.length > 0) {
          adminWhatsappError = `Failed to send to ${failedAdmins.length} admin(s)`;
          console.error("Some admin WhatsApp messages failed:", failedAdmins);
        }
      } catch (adminWhatsappErr: any) {
        adminWhatsappError = adminWhatsappErr.message || "Unknown admin WhatsApp error";
        console.error("Admin WhatsApp sending error:", adminWhatsappErr);
      }
    } else {
      console.warn("ADMIN_WHATSAPP_NUMBERS not configured, skipping admin notifications");
      adminWhatsappError = "Admin numbers not configured";
    }

    // Combined WhatsApp status
    const whatsappSent = userWhatsappSent || adminWhatsappSent;

    // Return success if at least one method succeeded
    const success = emailSent || whatsappSent;

    return NextResponse.json({
      success,
      emailSent,
      whatsappSent,
      userWhatsappSent,
      adminWhatsappSent,
      sentTo: phone,
      userMessageId: userWhatsappResult?.messages?.[0]?.id,
      adminCount: adminNumbers.length,
      adminResults: adminWhatsappResults,
      templateInfo: {
        userTemplate: userTemplateName,
        adminTemplate: adminTemplateName,
        language: languageCode,
        parametersCount: templateParams.length
      },
      ...(emailError && { emailError }),
      ...(userWhatsappError && { userWhatsappError }),
      ...(adminWhatsappError && { adminWhatsappError }),
      ...(userWhatsappResult && { userWhatsappResult })
    });
  } catch (err: any) {
    console.error("Contact Form API Route Error:", err);
    
    // Provide more helpful error messages
    let errorMessage = err.message || "Failed to send message";
    let statusCode = 500;

    if (errorMessage.includes("not in allowed list") || errorMessage.includes("recipient")) {
      errorMessage = "Recipient phone number is not registered with WhatsApp or not in test list. Please ensure the number is valid and registered with WhatsApp.";
      statusCode = 400;
    } else if (errorMessage.includes("invalid") || errorMessage.includes("format")) {
      errorMessage = "Invalid phone number format. Please use international format (e.g., 919876543210)";
      statusCode = 400;
    } else if (errorMessage.includes("token") || errorMessage.includes("authentication")) {
      errorMessage = "WhatsApp API authentication failed. Please check your credentials.";
      statusCode = 401;
    } else if (errorMessage.includes("template") || errorMessage.includes("parameter")) {
      errorMessage = `Template error: ${errorMessage}. Please verify: 1) Template name is correct, 2) Template is approved in Meta Business Manager, 3) Parameter count matches template (expected 5 parameters), 4) Language code is correct.`;
      statusCode = 400;
    }

    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? err.message : undefined
      },
      { status: statusCode }
    );
  }
}
