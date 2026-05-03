import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { buildDailyNotificationMessage } from "@/lib/buildDailyNotification";

async function sendLine(token: string, userId: string, message: string) {
  return fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: "text", text: message }],
    }),
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

  // 1. 通知メッセージを生成
  const { message, today, plantCount } = await buildDailyNotificationMessage();
  console.log(`[Daily] 生成メッセージ:\n${message}`);

  // 2. 通知先ユーザーをDBから取得
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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

  for (const userId of recipients) {
    try {
      const res = await sendLine(lineToken, userId, message);
      if (res.ok) {
        successCount++;
        console.log(`[Daily] 送信成功 userId=${userId}`);
      } else {
        failCount++;
        const errorText = await res.text();
        console.error(`[Daily] 送信失敗 userId=${userId} status=${res.status} body=${errorText}`);
      }
    } catch (err) {
      failCount++;
      console.error(`[Daily] 送信例外 userId=${userId}`, err);
    }
  }

  console.log(`[Daily] 送信完了 成功=${successCount} 失敗=${failCount} 合計=${recipients.length}`);
  return NextResponse.json({
    ok: true,
    today,
    count: plantCount,
    sent: successCount,
    failed: failCount,
  });
}
