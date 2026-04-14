import { NextResponse } from "next/server";
import { getGoogleOAuthClient } from "@/lib/googleClient";

type BuildAuthUrlInput = {
  reqUrl: string;
  enableCalendarSync: boolean;
  isSignup: boolean;
  returnTo?: string;
  loginHint?: string;
};

function buildGoogleAuthUrl({
  reqUrl,
  enableCalendarSync,
  isSignup,
  returnTo,
  loginHint,
}: BuildAuthUrlInput): string {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error(
      "Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."
    );
  }

  const url = new URL(reqUrl);
  const baseUrl = `${url.protocol}//${url.host}`;
  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  const oauth2Client = getGoogleOAuthClient(redirectUri);

  const scopes = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];

  if (enableCalendarSync) {
    scopes.push("https://www.googleapis.com/auth/calendar");
  }

  const state = JSON.stringify({
    enableCalendarSync,
    isSignup,
    timestamp: Date.now(),
    ...(returnTo ? { returnTo } : {}),
  });

  const authOptions: Parameters<typeof oauth2Client.generateAuthUrl>[0] = {
    access_type: "offline",
    scope: scopes,
    prompt: isSignup ? "consent" : "select_account",
    state: Buffer.from(state).toString("base64"),
    include_granted_scopes: true,
  };

  if (
    typeof loginHint === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginHint.trim())
  ) {
    authOptions.login_hint = loginHint.trim();
  }

  return oauth2Client.generateAuthUrl(authOptions);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const isSignup = url.searchParams.get("signup") === "1";
    const enableCalendarSync = url.searchParams.get("calendar") === "1";
    const returnTo = url.searchParams.get("returnTo") ?? undefined;
    const loginHint = url.searchParams.get("loginHint") ?? undefined;

    const authUrl = buildGoogleAuthUrl({
      reqUrl: req.url,
      enableCalendarSync,
      isSignup,
      returnTo,
      loginHint,
    });

    return NextResponse.redirect(authUrl);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to generate auth URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { enableCalendarSync, isSignup, returnTo, loginHint } = body;

    // Validate environment variables
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.' },
        { status: 500 }
      );
    }

    // Construct redirect URI dynamically from request URL
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    const oauth2Client = getGoogleOAuthClient(redirectUri);

    // Base scopes (always requested)
    const scopes = [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    // Add calendar scope only if user enabled calendar sync
    if (enableCalendarSync === true) {
      scopes.push('https://www.googleapis.com/auth/calendar');
    }

    const state = JSON.stringify({
      enableCalendarSync: enableCalendarSync === true,
      isSignup: isSignup === true,
      timestamp: Date.now(),
      ...(typeof returnTo === 'string' && returnTo ? { returnTo } : {}),
    });

    const authOptions: Parameters<typeof oauth2Client.generateAuthUrl>[0] = {
      access_type: 'offline', // Request refresh token
      scope: scopes,
      prompt: isSignup ? 'consent' : 'select_account', // Force consent on signup
      state: Buffer.from(state).toString('base64'), // Encode state
      include_granted_scopes: true,
    };
    if (typeof loginHint === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginHint.trim())) {
      authOptions.login_hint = loginHint.trim();
    }
    const authUrl = oauth2Client.generateAuthUrl(authOptions);

    return NextResponse.json({ authUrl });
  } catch (error: any) {
    console.error('Google OAuth error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}
