import { NextResponse } from "next/server";
import { generatePlantChatReply } from "@/lib/aiPlantChat";

export async function POST(req: Request) {
  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!lineToken) {
    return NextResponse.json(
      { ok: false, error: "LINEトークン未設定" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();

    const events = body.events;

    if (!events || events.length === 0) {
      return NextResponse.json({ ok: true });
    }

    // 1件目だけ処理（まずはシンプルに）
    const event = events[0];

    // テキスト以外は無視
    if (event.type !== "message" || event.message.type !== "text") {
      return NextResponse.json({ ok: true });
    }

    const userMessage = event.message.text;
    const replyToken = event.replyToken;

    // AIで返信生成
    const aiReply = await generatePlantChatReply({
      userMessage,
    });

    const replyText =
      aiReply ?? "うまく答えられませんでした。もう一度試してください🌱";

    // LINEに返信
    const lineRes = await fetch(
      "https://api.line.me/v2/bot/message/reply",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lineToken}`,
        },
        body: JSON.stringify({
          replyToken,
          messages: [
            {
              type: "text",
              text: replyText,
            },
          ],
        }),
      }
    );

    if (!lineRes.ok) {
      const errorText = await lineRes.text();
      console.error("LINE reply error:", errorText);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { ok: false, error: "Webhook処理失敗" },
      { status: 500 }
    );
  }
}