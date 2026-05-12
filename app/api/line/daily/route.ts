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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 通知先ユーザーを household_id 付きで取得
  const { data: users, error: usersError } = await supabase
    .from("line_notification_users")
    .select("line_user_id, household_id")
    .eq("is_active", true);

  if (usersError) {
    console.error("[Daily] line_notification_users取得失敗:", usersError.message);
  }

  const fallbackHouseholdId = process.env.DEFAULT_HOUSEHOLD_ID!;

  // DBに誰も登録されていなければ環境変数にフォールバック
  let byHousehold: Map<string, string[]>;
  if (!users || users.length === 0) {
    const fallbackUserId = process.env.LINE_USER_ID;
    if (fallbackUserId) {
      console.log("[Daily] DBに通知ユーザーなし → LINE_USER_ID/DEFAULT_HOUSEHOLD_ID環境変数にフォールバック");
      byHousehold = new Map([[fallbackHouseholdId, [fallbackUserId]]]);
    } else {
      console.log("[Daily] 通知先ユーザーなし（DBも環境変数もなし）");
      return NextResponse.json({ ok: true, sent: 0 });
    }
  } else {
    // household_id ごとにグループ化（null は DEFAULT_HOUSEHOLD_ID にフォールバック）
    byHousehold = new Map<string, string[]>();
    for (const u of users) {
      const hid = u.household_id ?? fallbackHouseholdId;
      if (!byHousehold.has(hid)) byHousehold.set(hid, []);
      byHousehold.get(hid)!.push(u.line_user_id);
    }
  }

  console.log(`[Daily] 対象 household 数=${byHousehold.size} 合計ユーザー数=${[...byHousehold.values()].reduce((s, r) => s + r.length, 0)}`);

  let totalSuccess = 0;
  let totalFail = 0;
  let totalImageFail = 0;

  for (const [householdId, recipients] of byHousehold) {
    console.log(`[Daily] household=${householdId} recipients=${recipients.length}人`);

    const { message, today, plantCount, spotlightPhotoUrl } =
      await buildDailyNotificationMessage(householdId);
    console.log(`[Daily] household=${householdId} plantCount=${plantCount}`);
    console.log(`[Daily] 生成メッセージ:\n${message}`);
    console.log(`[Daily] spotlightPhotoUrl=${spotlightPhotoUrl ?? "なし"}`);

    // daily_notification_logs は household が1つの場合のみ保存
    // 複数 household 対応時のログは次フェーズで household_id カラム追加後に対応
    if (byHousehold.size === 1) {
      const { error: logError } = await supabase
        .from("daily_notification_logs")
        .upsert({ date: today, message_body: message }, { onConflict: "date" });
      if (logError) {
        console.error("[Daily] daily_notification_logs保存失敗:", logError.message);
      }
    }

    for (const userId of recipients) {
      // 画像メッセージ（失敗してもテキストは送る）
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
            totalImageFail++;
            const errBody = await imgRes.text().catch(() => "");
            console.warn(`[Daily] 画像送信失敗 userId=${userId} status=${imgRes.status} body=${errBody}`);
          } else {
            console.log(`[Daily] 画像送信成功 userId=${userId}`);
          }
        } catch (err) {
          totalImageFail++;
          console.warn(`[Daily] 画像送信例外 userId=${userId}`, err);
        }
      }

      // テキストメッセージ（必ず実行）
      try {
        const res = await sendLineMessages(lineToken, userId, [
          { type: "text", text: message },
        ]);
        if (res.ok) {
          totalSuccess++;
          console.log(`[Daily] テキスト送信成功 userId=${userId}`);
        } else {
          totalFail++;
          const errorText = await res.text();
          console.error(`[Daily] テキスト送信失敗 userId=${userId} status=${res.status} body=${errorText}`);
        }
      } catch (err) {
        totalFail++;
        console.error(`[Daily] テキスト送信例外 userId=${userId}`, err);
      }
    }
  }

  console.log(`[Daily] 送信完了 成功=${totalSuccess} 失敗=${totalFail} 画像失敗=${totalImageFail}`);
  return NextResponse.json({
    ok: true,
    sent: totalSuccess,
    failed: totalFail,
    imageFailed: totalImageFail,
    householdCount: byHousehold.size,
  });
}
