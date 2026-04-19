import { NextRequest, NextResponse } from "next/server";
import LINKS from "../links";

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL!;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const destination = LINKS[slug];

  if (!destination) {
    return NextResponse.redirect("https://peijulink.com");
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

  return NextResponse.redirect(destination);
}