import nodemailer from 'nodemailer';

// Email transporter configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
};

interface BookingEmailData {
  inviteeName: string;
  inviteeEmail: string;
  providerName?: string;
  providerEmail?: string;
  eventTypeName: string;
  departmentName?: string;
  startTime: string;
  endTime: string;
  duration: number;
  notes?: string;
  /** IANA timezone (e.g. Asia/Kolkata) for displaying booking time in recipient's timezone */
  timezone?: string;
}

// Format date and time for email (uses timezone when provided to avoid UTC on server)
const formatDateTime = (dateString: string, timezone?: string): string => {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
    ...(timezone?.trim() && { timeZone: timezone.trim() }),
  };
  return date.toLocaleString('en-US', options);
};

// Email template for the user (invitee)
const getUserEmailTemplate = (data: BookingEmailData): string => {
  const departmentLabel = data.departmentName?.trim() ? data.departmentName : 'Not assigned';
  const providerLabel = data.providerName?.trim() ? data.providerName : 'Not assigned';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
    .booking-details { background-color: white; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #4F46E5; }
    .detail-row { margin: 10px 0; }
    .label { font-weight: bold; color: #4F46E5; }
    .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Booking Confirmed! 🎉</h1>
    </div>
    <div class="content">
      <p>Dear ${data.inviteeName},</p>
      <p>Your booking has been successfully confirmed. We're looking forward to seeing you!</p>
      
      <div class="booking-details">
        <h2 style="margin-top: 0; color: #4F46E5;">Booking Details</h2>
        <div class="detail-row">
          <span class="label">Event:</span> ${data.eventTypeName}
        </div>
        <div class="detail-row">
          <span class="label">Department:</span> ${departmentLabel}
        </div>
        <div class="detail-row">
          <span class="label">Service Provider:</span> ${providerLabel}
        </div>
        <div class="detail-row">
          <span class="label">Start Time:</span> ${formatDateTime(data.startTime, data.timezone)}
        </div>
        <div class="detail-row">
          <span class="label">End Time:</span> ${formatDateTime(data.endTime, data.timezone)}
        </div>
        <div class="detail-row">
          <span class="label">Duration:</span> ${data.duration} minutes
        </div>
        ${data.notes ? `
        <div class="detail-row">
          <span class="label">Notes:</span> ${data.notes}
        </div>
        ` : ''}
      </div>
      
      <p><strong>Important:</strong> Please arrive 5-10 minutes before your scheduled time.</p>
      <p>If you need to reschedule or cancel, please contact us as soon as possible.</p>
      
      <div class="footer">
        <p>This is an automated message. Please do not reply to this email.</p>
        <p>&copy; ${new Date().getFullYear()} GetSetTime. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

// Email template for the service provider (admin)
const getProviderEmailTemplate = (data: BookingEmailData): string => {
  const departmentLabel = data.departmentName?.trim() ? data.departmentName : 'Not assigned';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #059669; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
    .booking-details { background-color: white; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #059669; }
    .detail-row { margin: 10px 0; }
    .label { font-weight: bold; color: #059669; }
    .alert { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 5px; }
    .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Booking Alert 📅</h1>
    </div>
    <div class="content">
      <p>Dear ${data.providerName || 'Service Provider'},</p>
      <p>You have received a new booking. Please review the details below:</p>
      
      <div class="booking-details">
        <h2 style="margin-top: 0; color: #059669;">Booking Details</h2>
        <div class="detail-row">
          <span class="label">Client Name:</span> ${data.inviteeName}
        </div>
        <div class="detail-row">
          <span class="label">Client Email:</span> ${data.inviteeEmail}
        </div>
        <div class="detail-row">
          <span class="label">Event Type:</span> ${data.eventTypeName}
        </div>
        <div class="detail-row">
          <span class="label">Department:</span> ${departmentLabel}
        </div>
        <div class="detail-row">
          <span class="label">Start Time:</span> ${formatDateTime(data.startTime, data.timezone)}
        </div>
        <div class="detail-row">
          <span class="label">End Time:</span> ${formatDateTime(data.endTime, data.timezone)}
        </div>
        <div class="detail-row">
          <span class="label">Duration:</span> ${data.duration} minutes
        </div>
        ${data.notes ? `
        <div class="detail-row">
          <span class="label">Client Notes:</span> ${data.notes}
        </div>
        ` : ''}
      </div>
      
      <div class="alert">
        <strong>⚠️ Action Required:</strong> Please prepare for this appointment and ensure you're available at the scheduled time.
      </div>
      
      <p>You can manage this booking from your dashboard.</p>
      
      <div class="footer">
        <p>This is an automated notification from your booking system.</p>
        <p>&copy; ${new Date().getFullYear()} GetSetTime. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

// Send email to the user (invitee)
export const sendUserBookingEmail = async (data: BookingEmailData): Promise<void> => {
  try {
    const transporter = createTransporter();
    
    await transporter.sendMail({
      from: `"GetSetTime" <${process.env.SMTP_USER}>`,
      to: data.inviteeEmail,
      subject: `Booking Confirmation - ${data.eventTypeName}`,
      html: getUserEmailTemplate(data),
    });
    
    console.log('User booking email sent successfully to:', data.inviteeEmail);
  } catch (error) {
    console.error('Error sending user booking email:', error);
    throw error;
  }
};

// Send email to the service provider (admin)
export const sendProviderBookingEmail = async (data: BookingEmailData): Promise<void> => {
  try {
    if (!data.providerEmail) return;
    const transporter = createTransporter();
    
    await transporter.sendMail({
      from: `"GetSetTime Bookings" <${process.env.SMTP_USER}>`,
      to: data.providerEmail,
      subject: `New Booking Alert - ${data.eventTypeName} with ${data.inviteeName}`,
      html: getProviderEmailTemplate(data),
    });
    
    console.log('Provider booking email sent successfully to:', data.providerEmail);
  } catch (error) {
    console.error('Error sending provider booking email:', error);
    throw error;
  }
};

// Send both emails (user and provider)
export const sendBookingConfirmationEmails = async (data: BookingEmailData): Promise<{
  userEmailSent: boolean;
  providerEmailSent: boolean;
  errors: string[];
}> => {
  const errors: string[] = [];
  let userEmailSent = false;
  let providerEmailSent = false;

  // Send email to user
  if (data.inviteeEmail) {
    try {
      await sendUserBookingEmail(data);
      userEmailSent = true;
    } catch (error) {
      const err = error as Error;
      errors.push(`Failed to send email to user: ${err.message}`);
      console.error('User email error:', error);
    }
  } else {
    errors.push('User email not provided');
  }

  // Send email to provider
  if (data.providerEmail) {
    try {
      await sendProviderBookingEmail(data);
      providerEmailSent = true;
    } catch (error) {
      const err = error as Error;
      errors.push(`Failed to send email to provider: ${err.message}`);
      console.error('Provider email error:', error);
    }
  }

  return {
    userEmailSent,
    providerEmailSent,
    errors,
  };
};

// Send email confirmation link for registration (nodemailer)
export const sendConfirmationEmail = async (
  to: string,
  name: string,
  confirmationUrl: string
): Promise<void> => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"GetSetTime" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Confirm your GetSetTime account',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0; }
    .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Confirm your email</h1>
    </div>
    <div class="content">
      <p>Hi ${name || 'there'},</p>
      <p>Thanks for signing up for GetSetTime. Please confirm your email address by clicking the button below.</p>
      <p><a href="${confirmationUrl}" class="button">Confirm email</a></p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; font-size: 12px; color: #666;">${confirmationUrl}</p>
      <p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} GetSetTime. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `,
  });
};

