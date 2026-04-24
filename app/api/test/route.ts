import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const userId = process.env.LINE_USER_ID;

  if (!token || !userId) {
    return NextResponse.json(
      { ok: false, error: "LINE環境変数が設定されていません" },
      { status: 500 }
    );
  }

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [
        {
          type: "text",
          text: "Plant Care APPからのテスト通知です🌱",
        },
      ],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    return NextResponse.json(
      { ok: false, error: errorText },
      { status: res.status }
    );
  }

  return NextResponse.json({ ok: true });
}