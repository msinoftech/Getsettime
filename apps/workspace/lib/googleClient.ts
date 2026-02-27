import { google } from "googleapis";

export function getGoogleOAuthClient(redirectUri?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  // Use provided redirect URI or fallback to env variable
  const finalRedirectUri = redirectUri || process.env.GOOGLE_REDIRECT_URI;
  
  if (!clientId || !clientSecret || !finalRedirectUri) {
    throw new Error('Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables.');
  }
  
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    finalRedirectUri
  );
}