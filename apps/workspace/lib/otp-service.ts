import { createSupabaseServerClient } from '@app/db';

interface OTPRecord {
  identifier: string;
  code: string;
  expires_at: string;
  attempts: number;
  type: 'email' | 'phone';
}

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;

/**
 * Store OTP in Supabase database
 */
export async function storeOTP(
  identifier: string,
  code: string,
  type: 'email' | 'phone'
): Promise<boolean> {
  try {
    const supabase = createSupabaseServerClient();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    // Delete any existing OTP for this identifier
    await supabase
      .from('otp_verifications')
      .delete()
      .eq('identifier', identifier);

    // Insert new OTP
    const { error } = await supabase
      .from('otp_verifications')
      .insert({
        identifier,
        code,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
        type,
      });

    if (error) {
      console.error('Error storing OTP:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error storing OTP:', error);
    return false;
  }
}

/**
 * Verify OTP from Supabase database
 */
/**
 * Check if OTP was already verified
 */
export async function isOTPVerified(identifier: string): Promise<boolean> {
  try {
    const supabase = createSupabaseServerClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('otp_verifications')
      .select('verified, expires_at')
      .eq('identifier', identifier)
      .single();

    if (error || !data) {
      return false;
    }

    // Check if expired
    if (new Date(data.expires_at) < new Date(now)) {
      return false;
    }

    return data.verified === true;
  } catch (error) {
    console.error('Error checking OTP verification:', error);
    return false;
  }
}

export async function verifyOTP(
  identifier: string,
  code: string,
  deleteAfterVerify: boolean = false
): Promise<boolean> {
  try {
    const supabase = createSupabaseServerClient();
    const now = new Date().toISOString();

    // Get OTP record
    const { data, error } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('identifier', identifier)
      .single();

    if (error || !data) {
      console.error('OTP not found or error:', error);
      return false;
    }

    // Check if expired
    if (new Date(data.expires_at) < new Date(now)) {
      await supabase
        .from('otp_verifications')
        .delete()
        .eq('identifier', identifier);
      console.error('OTP expired');
      return false;
    }

    // Check if max attempts exceeded
    if (data.attempts >= MAX_ATTEMPTS) {
      await supabase
        .from('otp_verifications')
        .delete()
        .eq('identifier', identifier);
      console.error('Max attempts exceeded');
      return false;
    }

    // Increment attempts
    await supabase
      .from('otp_verifications')
      .update({ attempts: data.attempts + 1 })
      .eq('identifier', identifier);

    // Verify code
    if (data.code !== code) {
      console.error('OTP code mismatch');
      return false;
    }

    // OTP verified - mark as verified
    await supabase
      .from('otp_verifications')
      .update({ 
        verified: true, 
        verified_at: new Date().toISOString() 
      })
      .eq('identifier', identifier);

    // Delete if requested (for initial verification endpoint)
    if (deleteAfterVerify) {
      await supabase
        .from('otp_verifications')
        .delete()
        .eq('identifier', identifier);
    }

    return true;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return false;
  }
}

/**
 * Check rate limit for OTP requests
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests: number = 3,
  windowMinutes: number = 15
): Promise<boolean> {
  try {
    const supabase = createSupabaseServerClient();
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);

    // Count OTP requests in the time window
    const { count, error } = await supabase
      .from('otp_verifications')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .gte('created_at', windowStart.toISOString());

    if (error) {
      console.error('Error checking rate limit:', error);
      return true; // Allow on error to avoid blocking legitimate requests
    }

    return (count || 0) < maxRequests;
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return true; // Allow on error
  }
}

/**
 * Send OTP via Email using Resend (or similar service)
 */
export async function sendOTPEmail(email: string, code: string): Promise<boolean> {
  try {
    // Option 1: Using Resend (recommended)
    // Install: npm install resend
    // const { Resend } = require('resend');
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // const { error } = await resend.emails.send({
    //   from: 'noreply@yourdomain.com',
    //   to: email,
    //   subject: 'Your Verification Code',
    //   html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code will expire in 10 minutes.</p>`,
    // });
    // return !error;

    // Option 2: Using Supabase Email (if configured)
    // const supabase = createSupabaseServerClient();
    // const { error } = await supabase.functions.invoke('send-email', {
    //   body: { to: email, subject: 'Verification Code', code },
    // });
    // return !error;

    // Option 3: Using Nodemailer with SMTP
    // Install: npm install nodemailer
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Your Verification Code',
      html: `<p>Your verification code is: <strong>${code}</strong></p>`,
    });
    return true;

    // For now, log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] OTP Email to ${email}: ${code}`);
      return true;
    }

    // In production, implement one of the options above
    console.error('Email service not configured');
    return false;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
}

/**
 * Send OTP via SMS using Twilio (or similar service)
 */
export async function sendOTPSMS(phone: string, code: string): Promise<boolean> {
  try {
    // Option 1: Using Twilio (recommended)
    // Install: npm install twilio
    const twilio = require('twilio');
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    await client.messages.create({
      body: `Your verification code is: ${code}. This code will expire in 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });
    return true;

    // Option 2: Using AWS SNS
    // Install: npm install @aws-sdk/client-sns
    // const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
    // const sns = new SNSClient({ region: process.env.AWS_REGION });
    // await sns.send(new PublishCommand({
    //   PhoneNumber: phone,
    //   Message: `Your verification code is: ${code}`,
    // }));
    // return true;

    // For now, log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] OTP SMS to ${phone}: ${code}`);
      return true;
    }

    // In production, implement one of the options above
    console.error('SMS service not configured');
    return false;
  } catch (error) {
    console.error('Error sending OTP SMS:', error);
    return false;
  }
}

