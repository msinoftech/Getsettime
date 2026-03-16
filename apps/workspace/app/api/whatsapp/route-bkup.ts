import { NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@workspace/lib/whatsapp";
import nodemailer from "nodemailer";

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

    // ================= SEND TO USER =================
    const userWhatsappMessage = `
    Your booking is confirmed
    Name: ${name}
    Email: ${email || "Not provided"}
    Phone: ${phone}
    MESSAGE: ${message}
    Thank you for reaching out!,
    We'll get back to you soon!,
    We appreciate your interest!,
    `.trim();

    try {
      userWhatsappResult = await sendWhatsAppMessage(
        phone,  // TO: Form phone number (user/recipient) - formatting handled in whatsapp.ts
        userWhatsappMessage
      );
      userWhatsappSent = true;
      console.log("WhatsApp message sent to user successfully");
    } catch (userWhatsappErr: any) {
      userWhatsappError = userWhatsappErr.message || "Unknown WhatsApp error";
      console.error("WhatsApp sending error to user:", userWhatsappErr);
      // Continue even if user WhatsApp fails
    }

    // ================= SEND TO ADMINS =================
    const adminNumbers = process.env.ADMIN_WHATSAPP_NUMBERS?.split(",").map(num => num.trim()).filter(num => num) || [];

    if (adminNumbers.length > 0) {
      const adminWhatsappMessage = `
      *New Booking Received*

      *Name:* ${name}
      *Email:* ${email || "Not provided"}
      *Phone:* ${phone}
      *Message:* ${message}
      `.trim();

      try {
        // Send to all admins in parallel
        const adminPromises = adminNumbers.map((adminPhone) =>
          sendWhatsAppMessage(adminPhone, adminWhatsappMessage)
            .then((result) => ({ phone: adminPhone, success: true, result }))
            .catch((error) => ({ phone: adminPhone, success: false, error: error.message }))
        );

        const adminResults = await Promise.all(adminPromises);
        adminWhatsappResults = adminResults;

        const successfulAdmins = adminResults.filter(r => r.success).length;
        adminWhatsappSent = successfulAdmins > 0;

        if (successfulAdmins > 0) {
          console.log(`WhatsApp message sent to ${successfulAdmins} admin(s) successfully`);
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
