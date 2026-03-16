const getVerifyService = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !serviceSid) {
    throw new Error(
      'Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_VERIFY_SERVICE_SID'
    );
  }

  const twilio = require('twilio');
  const client = twilio(accountSid, authToken);
  return client.verify.v2.services(serviceSid);
};

export async function sendVerification(phoneE164: string): Promise<boolean> {
  try {
    const service = getVerifyService();
    const verification = await service.verifications.create({
      to: phoneE164,
      channel: 'sms',
    });
    return verification.status === 'pending';
  } catch (error) {
    console.error('[twilio-verify] Failed to send verification:', error);
    return false;
  }
}

export async function checkVerification(
  phoneE164: string,
  code: string
): Promise<boolean> {
  try {
    const service = getVerifyService();
    const check = await service.verificationChecks.create({
      to: phoneE164,
      code,
    });
    return check.status === 'approved';
  } catch (error) {
    console.error('[twilio-verify] Failed to check verification:', error);
    return false;
  }
}
