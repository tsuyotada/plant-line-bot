import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { generatePlantChatReply } from "@/lib/aiPlantChat";
import { fetchLineImage, replyToLine, pushToLine } from "@/lib/linePhotoUtils";
import { generatePhotoAdvice } from "@/lib/aiPhotoAdvice";
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

// LINE Quick Reply の上限は13件。12件を植物に使い、残り1件を「次へ」ボタンに確保する
const PLANT_PAGE_SIZE = 12;

async function fetchActivePlants(supabase: ReturnType<typeof getSupabase>) {
  const { data: raw } = await supabase
    .from("plants")
    .select("id, plant_type, sort_order")
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  // Webアプリと同じ並び順（sort_order優先、nullは末尾）
  return (raw ?? []).sort((a: any, b: any) => {
    const aOrd: number | null = a.sort_order ?? null;
    const bOrd: number | null = b.sort_order ?? null;
    if (aOrd !== null && bOrd !== null) return aOrd - bOrd;
    if (aOrd !== null) return -1;
    if (bOrd !== null) return 1;
    return 0;
  });
}

function buildPlantPageItems(plants: any[], pendingId: string, page: number): any[] {
  const start = page * PLANT_PAGE_SIZE;
  const hasMore = plants.length > start + PLANT_PAGE_SIZE;
  const pageSlice = hasMore
    ? plants.slice(start, start + PLANT_PAGE_SIZE)
    : plants.slice(start);

  const items = pageSlice.map((plant: any) => ({
    type: "action",
    action: {
      type: "postback",
      label: getPlantLabel(plant.plant_type).slice(0, 20),
      data: `action=select_plant&id=${pendingId}&plant_id=${plant.id}`,
      displayText: getPlantLabel(plant.plant_type),
    },
  }));

  if (hasMore) {
    items.push({
      type: "action",
      action: {
        type: "postback",
        label: "次の植物を見る",
        data: `action=more_plants&id=${pendingId}&page=${page + 1}`,
        displayText: "次の植物を見る",
      },
    });
  }

  return items;
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

  console.log(`[LINE] 画像受信 userId=${lineUserId}`);
  console.log(`[LINE] messageId=${messageId}`);

  // 1. LINE から画像バイナリを取得
  const image = await fetchLineImage(messageId, lineToken);
  if (!image) {
    // fetchLineImage 内で詳細ログ済み
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
    console.error(`[Storage] upload失敗 path=${storagePath}`, uploadError);
    await replyToLine(lineToken, replyToken, [
      { type: "text", text: "画像の保存に失敗しました。もう一度お試しください🌱" },
    ]);
    return;
  }

  console.log(`[Storage] upload成功 path=${storagePath}`);

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
    console.error(`[DB] pending_line_photos insert失敗 messageId=${messageId}`, insertError);
    await replyToLine(lineToken, replyToken, [
      { type: "text", text: "エラーが発生しました。もう一度お試しください🌱" },
    ]);
    return;
  }

  console.log(`[DB] pending_line_photos insert成功 id=${pending.id} storagePath=${storagePath}`);

  // 4. 確認メッセージを送信（Buttons template）
  await replyToLine(lineToken, replyToken, [
    {
      type: "template",
      altText: "この写真を植物の記録として保存し、状態のアドバイスを受け取りますか？🌱",
      template: {
        type: "buttons",
        text: "この写真を植物の記録として保存し、状態のアドバイスを受け取りますか？🌱",
        actions: [
          {
            type: "postback",
            label: "保存してアドバイスを見る",
            data: `action=confirm_photo&id=${pending.id}`,
            displayText: "保存してアドバイスを見る",
          },
          {
            type: "postback",
            label: "今回はやめる",
            data: `action=cancel_photo&id=${pending.id}`,
            displayText: "今回はやめる",
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

    const plants = await fetchActivePlants(supabase);

    console.log(`[Plants] 取得件数=${plants.length} 候補: ${plants.map((p: any) => getPlantLabel(p.plant_type)).join(", ")}`);

    if (plants.length === 0) {
      await replyToLine(lineToken, replyToken, [
        {
          type: "text",
          text: "登録されている植物がありません。先にWebアプリで植物を追加してください🌱",
        },
      ]);
      return;
    }

    const items = buildPlantPageItems(plants, pendingId, 0);
    const totalPages = Math.ceil(plants.length / PLANT_PAGE_SIZE);
    console.log(`[Plants] page=1/${totalPages} 表示件数=${items.length}`);

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
      {
        type: "text",
        text: "今回はアドバイスを行いませんでした。\n必要なときは、また写真を送ってください🌱",
      },
    ]);
    return;
  }

  // ── 「次の植物を見る」が押された → 次ページを Quick Reply で表示 ──
  if (action === "more_plants" && pendingId) {
    const page = parseInt(params.get("page") ?? "1", 10);

    const plants = await fetchActivePlants(supabase);
    const totalPages = Math.ceil(plants.length / PLANT_PAGE_SIZE);

    console.log(`[Plants] more_plants page=${page + 1}/${totalPages} 全件数=${plants.length}`);

    const items = buildPlantPageItems(plants, pendingId, page);
    console.log(`[Plants] page=${page + 1}/${totalPages} 表示件数=${items.length}`);

    await replyToLine(lineToken, replyToken, [
      {
        type: "text",
        text: `どの植物の写真として追加しますか？（${page + 1}ページ目）`,
        quickReply: { items },
      },
    ]);
    return;
  }

  // ── 植物が選ばれた → plant_photos に登録 → AI アドバイス送信 ──
  if (action === "select_plant" && pendingId && plantId) {
    const lineUserId: string = event.source?.userId ?? "";

    console.log(`[DB] plant_id=${plantId} pendingId=${pendingId}`);

    const { data: pending, error } = await supabase
      .from("pending_line_photos")
      .select()
      .eq("id", pendingId)
      .in("status", ["pending", "selecting_plant"])
      .single();

    if (error || !pending) {
      console.error(`[DB] pending_line_photos 取得失敗 pendingId=${pendingId}`, error);
      await replyToLine(lineToken, replyToken, [
        { type: "text", text: "写真が見つかりませんでした。もう一度画像を送ってください🌱" },
      ]);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("plant-photos")
      .getPublicUrl(pending.storage_path);

    const imageUrl: string = urlData.publicUrl;
    console.log(`[DB] 画像URL生成 imageUrl=${imageUrl}`);

    const { error: photoError } = await supabase
      .from("plant_photos")
      .insert({
        plant_id: plantId,
        image_url: imageUrl,
        storage_path: pending.storage_path,
        taken_at: new Date().toISOString(),
      });

    if (photoError) {
      console.error(`[DB] plant_photos insert失敗 plant_id=${plantId} imageUrl=${imageUrl}`, photoError);
      await replyToLine(lineToken, replyToken, [
        { type: "text", text: "写真の登録に失敗しました。もう一度お試しください🌱" },
      ]);
      return;
    }

    console.log(`[DB] plant_photos insert成功 plant_id=${plantId} imageUrl=${imageUrl}`);

    revalidatePath("/");
    console.log("[Cache] revalidatePath('/') 実行");

    await supabase
      .from("pending_line_photos")
      .update({ status: "completed" })
      .eq("id", pendingId);

    const { data: plant } = await supabase
      .from("plants")
      .select("plant_type, initial_state_type, initial_state_note")
      .eq("id", plantId)
      .single();

    const plantName = plant ? getPlantLabel(plant.plant_type) : "植物";
    console.log(`[Plants] ユーザー選択 plant_id=${plantId} plantName=${plantName}`);

    // 登録完了を reply token で即返信
    await replyToLine(lineToken, replyToken, [
      { type: "text", text: `${plantName}の写真として追加しました🌱\n少しお待ちください…` },
    ]);

    // AI アドバイスを生成して push で送信
    const advice = await generatePhotoAdvice({
      imageUrl,
      plantName,
      initialStateType: plant?.initial_state_type ?? null,
      initialStateNote: plant?.initial_state_note ?? null,
    });

    if (advice && lineUserId) {
      await pushToLine(lineToken, lineUserId, [
        { type: "text", text: advice },
      ]);
    }
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
