import { NextRequest, NextResponse } from "next/server";
import LINKS from "../links";

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL!;
const FALLBACK_URL = "https://peijulink.com";
const DEDUPE_COOKIE_NAME = "lt_last_click";
const DEDUPE_WINDOW_MS = 5000;

function createRedirectResponse(destination: string) {
  return NextResponse.redirect(destination);
}

function getTimestampParts(value: string) {
  const [loggedSlug = "", loggedAt = ""] = value.split("|");
  const loggedAtMs = Number(loggedAt);

  return {
    loggedSlug,
    loggedAtMs,
  };
}

function shouldSkipLogging(req: NextRequest, slug: string) {
  const cookieValue = req.cookies.get(DEDUPE_COOKIE_NAME)?.value;

  if (!cookieValue) {
    return false;
  }

  const { loggedSlug, loggedAtMs } = getTimestampParts(cookieValue);

  if (loggedSlug !== slug || !Number.isFinite(loggedAtMs)) {
    return false;
  }

  return Date.now() - loggedAtMs < DEDUPE_WINDOW_MS;
}

function setDedupeCookie(res: NextResponse, slug: string) {
  res.cookies.set(DEDUPE_COOKIE_NAME, `${slug}|${Date.now()}`, {
    httpOnly: true,
    maxAge: Math.ceil(DEDUPE_WINDOW_MS / 1000),
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const destination = LINKS[slug];

  if (!destination) {
    return createRedirectResponse(FALLBACK_URL);
  }

  const res = createRedirectResponse(destination);
  setDedupeCookie(res, slug);

  if (shouldSkipLogging(req, slug)) {
    return res;
  }

  const userAgent = req.headers.get("user-agent") || "";
  const referrer = req.headers.get("referer") || "";
  const device = /mobile/i.test(userAgent) ? "mobile" : "desktop";

  const url = new URL(req.url);
  const utm_source = url.searchParams.get("utm_source") || "";
  const utm_campaign = url.searchParams.get("utm_campaign") || "";

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slug,
        destination,
        referrer,
        device,
        utm_source,
        utm_campaign,
      }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Logging failed:", error);
  }

  return res;
}

export async function HEAD(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const destination = LINKS[slug] || FALLBACK_URL;

  return createRedirectResponse(destination);
}
