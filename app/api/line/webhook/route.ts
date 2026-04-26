import { NextResponse } from "next/server";
import { generatePlantChatReply } from "@/lib/aiPlantChat";
import { fetchLineImage, replyToLine } from "@/lib/linePhotoUtils";
import { createClient } from "@supabase/supabase-js";

const PLANT_LABEL_MAP: Record<string, string> = {
  tomato: "トマト",
  coriander: "コリアンダー",
  makrut_lime: "コブミカン",
  mint: "ミント",
  everbearing_strawberry: "四季成りイチゴ",
  italian_parsley: "イタリアンパセリ",
  shiso: "大葉",
  perilla: "えごま",
};

function getPlantLabel(plantType: string): string {
  return PLANT_LABEL_MAP[plantType] ?? plantType;
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function handleImageMessage(event: any, lineToken: string) {
  const supabase = getSupabase();
  const lineUserId: string = event.source?.userId ?? "unknown";
  const messageId: string = event.message.id;
  const replyToken: string = event.replyToken;

  // 1. LINE から画像バイナリを取得
  const image = await fetchLineImage(messageId, lineToken);
  if (!image) {
    await replyToLine(lineToken, replyToken, [
      { type: "text", text: "画像の取得に失敗しました。もう一度お試しください🌱" },
    ]);
    return;
  }

  // 2. Supabase Storage に一時保存
  const ext = image.contentType.includes("png") ? "png" : "jpg";
  const storagePath = `pending/${lineUserId}/${messageId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("plant-photos")
    .upload(storagePath, image.binary, {
      contentType: image.contentType,
      upsert: true,
    });

  if (uploadError) {
    console.error("storage upload error:", uploadError);
    await replyToLine(lineToken, replyToken, [
      { type: "text", text: "画像の保存に失敗しました。もう一度お試しください🌱" },
    ]);
    return;
  }

  // 3. pending_line_photos に記録
  const { data: pending, error: insertError } = await supabase
    .from("pending_line_photos")
    .insert({
      line_user_id: lineUserId,
      line_message_id: messageId,
      storage_path: storagePath,
      status: "pending",
    })
    .select()
    .single();

  if (insertError || !pending) {
    console.error("pending insert error:", insertError);
    await replyToLine(lineToken, replyToken, [
      { type: "text", text: "エラーが発生しました。もう一度お試しください🌱" },
    ]);
    return;
  }

  // 4. 確認メッセージを送信（Buttons template）
  await replyToLine(lineToken, replyToken, [
    {
      type: "template",
      altText: "この写真を植物に追加しますか？",
      template: {
        type: "buttons",
        text: "この写真を育てている植物の写真として追加しますか？",
        actions: [
          {
            type: "postback",
            label: "追加する",
            data: `action=confirm_photo&id=${pending.id}`,
            displayText: "追加する",
          },
          {
            type: "postback",
            label: "追加しない",
            data: `action=cancel_photo&id=${pending.id}`,
            displayText: "追加しない",
          },
        ],
      },
    },
  ]);
}

async function handlePostback(event: any, lineToken: string) {
  const supabase = getSupabase();
  const replyToken: string = event.replyToken;
  const params = new URLSearchParams(event.postback?.data ?? "");
  const action = params.get("action");
  const pendingId = params.get("id");
  const plantId = params.get("plant_id");

  // ── 「追加する」が押された → 植物一覧を Quick Reply で表示 ──
  if (action === "confirm_photo" && pendingId) {
    const { data: pending, error } = await supabase
      .from("pending_line_photos")
      .select()
      .eq("id", pendingId)
      .eq("status", "pending")
      .single();

    if (error || !pending) {
      await replyToLine(lineToken, replyToken, [
        { type: "text", text: "写真が見つかりませんでした。もう一度画像を送ってください🌱" },
      ]);
      return;
    }

    await supabase
      .from("pending_line_photos")
      .update({ status: "selecting_plant" })
      .eq("id", pendingId);

    const { data: plants } = await supabase
      .from("plants")
      .select("id, plant_type")
      .order("created_at", { ascending: false });

    if (!plants || plants.length === 0) {
      await replyToLine(lineToken, replyToken, [
        {
          type: "text",
          text: "登録されている植物がありません。先にWebアプリで植物を追加してください🌱",
        },
      ]);
      return;
    }

    const items = plants.slice(0, 13).map((plant: any) => ({
      type: "action",
      action: {
        type: "postback",
        label: getPlantLabel(plant.plant_type).slice(0, 20),
        data: `action=select_plant&id=${pendingId}&plant_id=${plant.id}`,
        displayText: getPlantLabel(plant.plant_type),
      },
    }));

    await replyToLine(lineToken, replyToken, [
      {
        type: "text",
        text: "どの植物の写真として追加しますか？",
        quickReply: { items },
      },
    ]);
    return;
  }

  // ── 「追加しない」が押された ──
  if (action === "cancel_photo" && pendingId) {
    await supabase
      .from("pending_line_photos")
      .update({ status: "canceled" })
      .eq("id", pendingId);

    await replyToLine(lineToken, replyToken, [
      { type: "text", text: "写真の追加をキャンセルしました🌱" },
    ]);
    return;
  }

  // ── 植物が選ばれた → plant_photos に登録 ──
  if (action === "select_plant" && pendingId && plantId) {
    const { data: pending, error } = await supabase
      .from("pending_line_photos")
      .select()
      .eq("id", pendingId)
      .in("status", ["pending", "selecting_plant"])
      .single();

    if (error || !pending) {
      await replyToLine(lineToken, replyToken, [
        { type: "text", text: "写真が見つかりませんでした。もう一度画像を送ってください🌱" },
      ]);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("plant-photos")
      .getPublicUrl(pending.storage_path);

    const { error: photoError } = await supabase
      .from("plant_photos")
      .insert({
        plant_id: plantId,
        image_url: urlData.publicUrl,
        storage_path: pending.storage_path,
        taken_at: new Date().toISOString(),
      });

    if (photoError) {
      console.error("plant_photos insert error:", photoError);
      await replyToLine(lineToken, replyToken, [
        { type: "text", text: "写真の登録に失敗しました。もう一度お試しください🌱" },
      ]);
      return;
    }

    await supabase
      .from("pending_line_photos")
      .update({ status: "completed" })
      .eq("id", pendingId);

    const { data: plant } = await supabase
      .from("plants")
      .select("plant_type")
      .eq("id", plantId)
      .single();

    const plantName = plant ? getPlantLabel(plant.plant_type) : "植物";

    await replyToLine(lineToken, replyToken, [
      { type: "text", text: `${plantName}の写真として追加しました🌱` },
    ]);
  }
}

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

    const event = events[0];

    // 画像メッセージ
    if (event.type === "message" && event.message?.type === "image") {
      await handleImageMessage(event, lineToken);
      return NextResponse.json({ ok: true });
    }

    // postback（ボタン操作）
    if (event.type === "postback") {
      await handlePostback(event, lineToken);
      return NextResponse.json({ ok: true });
    }

    // テキスト（既存 AI チャット）
    if (event.type !== "message" || event.message?.type !== "text") {
      return NextResponse.json({ ok: true });
    }

    const userMessage: string = event.message.text;
    const replyToken: string = event.replyToken;

    const aiReply = await generatePlantChatReply({ userMessage });
    const replyText =
      aiReply ?? "うまく答えられませんでした。もう一度試してください🌱";

    await replyToLine(lineToken, replyToken, [
      { type: "text", text: replyText },
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { ok: false, error: "Webhook処理失敗" },
      { status: 500 }
    );
  }
}
