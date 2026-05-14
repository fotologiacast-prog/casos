// api/debug-google-oauth.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

const mask = (value?: string) => {
  if (!value) return null;

  return {
    length: value.length,
    startsWith: value.slice(0, 10),
    endsWith: value.slice(-35),
    hasSpaces: value !== value.trim(),
    hasQuotes: value.includes('"') || value.includes("'"),
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN || "",
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json().catch(() => ({}));

  return res.status(200).json({
    googleStatus: response.status,
    googleOk: response.ok,
    googleResponse: data,
    envDebug: {
      GOOGLE_CLIENT_ID: mask(process.env.GOOGLE_CLIENT_ID),
      GOOGLE_CLIENT_SECRET: mask(process.env.GOOGLE_CLIENT_SECRET),
      GOOGLE_REFRESH_TOKEN: mask(process.env.GOOGLE_REFRESH_TOKEN),
      HAS_SERVICE_ACCOUNT: Boolean(
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 ||
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON
      ),
    },
  });
}
