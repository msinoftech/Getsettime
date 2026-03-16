import axios from "axios";

export const getZoomTokens = (code: string, redirectUri?: string) =>
  axios.post("https://zoom.us/oauth/token", null,
    {
      params: {
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri || process.env.ZOOM_REDIRECT_URI
      },
      auth: {
        username: process.env.ZOOM_CLIENT_ID!,
        password: process.env.ZOOM_CLIENT_SECRET!
      }
    }
  );