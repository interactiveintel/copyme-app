import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { success: false, error: "Invalid email" },
      { status: 400 }
    );
  }

  const sheetUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;

  if (!sheetUrl) {
    // Fallback: log to server console so emails aren't lost
    console.log(`[WAITLIST] ${email} — ${new Date().toISOString()}`);
    return NextResponse.json({ success: true, stored: "log" });
  }

  try {
    await fetch(sheetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return NextResponse.json({ success: true, stored: "sheet" });
  } catch {
    console.log(`[WAITLIST] ${email} — ${new Date().toISOString()}`);
    return NextResponse.json({ success: true, stored: "log" });
  }
}
