import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { buildDailyNotificationMessage } from "@/lib/buildDailyNotification";

async function sendLineMessages(token: string, userId: string, messages: object[]) {
  return fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to: userId, messages }),
  });
}

export async function GET() {
  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!lineToken) {
    return NextResponse.json(
      { ok: false, error: "LINE_CHANNEL_ACCESS_TOKEN未設定" },
      { status: 500 }
    );
  }

  // 1. 通知メッセージ（テキスト＋スポットライト画像URL）を生成
  const { message, today, plantCount, spotlightPhotoUrl } = await buildDailyNotificationMessage();
  console.log(`[Daily] 生成メッセージ:\n${message}`);
  console.log(`[Daily] spotlightPhotoUrl=${spotlightPhotoUrl ?? "なし"}`);

  // 2. 通知先ユーザーをDBから取得
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // メッセージ本文をDBに保存（今日やること表示に使用）
  const { error: logError } = await supabase
    .from("daily_notification_logs")
    .upsert({ date: today, message_body: message }, { onConflict: "date" });
  if (logError) {
    console.error("[Daily] daily_notification_logs保存失敗:", logError.message);
  }

  const { data: users, error: usersError } = await supabase
    .from("line_notification_users")
    .select("line_user_id")
    .eq("is_active", true);

  if (usersError) {
    console.error("[Daily] line_notification_users取得失敗:", usersError.message);
  }

  // DBに誰も登録されていなければ環境変数にフォールバック
  let recipients: string[] = (users ?? []).map((u) => u.line_user_id);
  if (recipients.length === 0) {
    const fallbackId = process.env.LINE_USER_ID;
    if (fallbackId) {
      console.log("[Daily] DBに通知ユーザーなし → LINE_USER_ID環境変数にフォールバック");
      recipients = [fallbackId];
    } else {
      console.log("[Daily] 通知先ユーザーなし（DBも環境変数もなし）");
      return NextResponse.json({ ok: true, today, count: plantCount, sent: 0 });
    }
  }

  console.log(`[Daily] 通知送信先=${recipients.length}人`);

  // 3. 全員に送信（1人失敗しても続行）
  let successCount = 0;
  let failCount = 0;
  let imageFailCount = 0;

  for (const userId of recipients) {
    // 3a. 今日の1枚 画像メッセージを先送り（失敗してもテキストは送る）
    if (spotlightPhotoUrl) {
      try {
        const imgRes = await sendLineMessages(lineToken, userId, [
          {
            type: "image",
            originalContentUrl: spotlightPhotoUrl,
            previewImageUrl: spotlightPhotoUrl,
          },
        ]);
        if (!imgRes.ok) {
          imageFailCount++;
          console.warn(`[Daily] 画像送信失敗 userId=${userId} status=${imgRes.status}`);
        } else {
          console.log(`[Daily] 画像送信成功 userId=${userId}`);
        }
      } catch (err) {
        imageFailCount++;
        console.warn(`[Daily] 画像送信例外 userId=${userId}`, err);
      }
    }

    // 3b. テキストメッセージ送信（必ず実行）
    try {
      const res = await sendLineMessages(lineToken, userId, [
        { type: "text", text: message },
      ]);
      if (res.ok) {
        successCount++;
        console.log(`[Daily] テキスト送信成功 userId=${userId}`);
      } else {
        failCount++;
        const errorText = await res.text();
        console.error(`[Daily] テキスト送信失敗 userId=${userId} status=${res.status} body=${errorText}`);
      }
    } catch (err) {
      failCount++;
      console.error(`[Daily] テキスト送信例外 userId=${userId}`, err);
    }
  }

  console.log(`[Daily] 送信完了 成功=${successCount} 失敗=${failCount} 画像失敗=${imageFailCount} 合計=${recipients.length}`);
  return NextResponse.json({
    ok: true,
    today,
    count: plantCount,
    sent: successCount,
    failed: failCount,
    imageFailed: imageFailCount,
    spotlightSent: !!spotlightPhotoUrl && imageFailCount < recipients.length,
  });
}
