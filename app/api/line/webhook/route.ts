import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { generatePlantChatReply } from "@/lib/aiPlantChat";
import { fetchLineImage, replyToLine, pushToLine } from "@/lib/linePhotoUtils";
import { generatePhotoAdvice } from "@/lib/aiPhotoAdvice";
import { identifyPlantFromPhoto } from "@/lib/aiPlantIdentify";
import { buildDailyNotificationMessage } from "@/lib/buildDailyNotification";
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

// LINE Quick Reply 上限13件。前後ナビボタン最大2件を確保し、植物スロットは11件に固定する。
// これにより「前のみ」「次のみ」「前後両方」どの組み合わせでも合計≤13件を保証できる。
const PLANT_PAGE_SIZE = 11;
const CONFIDENCE_THRESHOLD = 0.6;

async function fetchActivePlants(supabase: ReturnType<typeof getSupabase>) {
  const { data: raw } = await supabase
    .from("plants")
    .select("id, plant_type, sort_order, species, memo")
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
  const hasPrev = page > 0;
  const hasMore = plants.length > start + PLANT_PAGE_SIZE;
  // hasMore=false のとき plants.slice(start) は必ず ≤11 件（数学的保証）
  const pageSlice = hasMore
    ? plants.slice(start, start + PLANT_PAGE_SIZE)
    : plants.slice(start);

  const items: any[] = [];

  if (hasPrev) {
    items.push({
      type: "action",
      action: {
        type: "postback",
        label: "前のページを見る",
        data: `action=more_plants&id=${pendingId}&page=${page - 1}`,
        displayText: "前のページを見る",
      },
    });
  }

  for (const plant of pageSlice) {
    items.push({
      type: "action",
      action: {
        type: "postback",
        label: getPlantLabel(plant.plant_type).slice(0, 20),
        data: `action=select_plant&id=${pendingId}&plant_id=${plant.id}`,
        displayText: getPlantLabel(plant.plant_type),
      },
    });
  }

  if (hasMore) {
    items.push({
      type: "action",
      action: {
        type: "postback",
        label: "次のページを見る",
        data: `action=more_plants&id=${pendingId}&page=${page + 1}`,
        displayText: "次のページを見る",
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

// ── バッチセッション取得 ──────────────────────────────────────────
async function getActiveBatchSession(
  supabase: ReturnType<typeof getSupabase>,
  lineUserId: string
) {
  const { data } = await supabase
    .from("line_batch_sessions")
    .select("id")
    .eq("line_user_id", lineUserId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

// ── バッチ用 Quick Reply アイテム生成 ─────────────────────────────
function buildBatchPlantPageItems(plants: any[], batchSessionId: string, page: number): any[] {
  const start = page * PLANT_PAGE_SIZE;
  const hasPrev = page > 0;
  const hasMore = plants.length > start + PLANT_PAGE_SIZE;
  const pageSlice = hasMore ? plants.slice(start, start + PLANT_PAGE_SIZE) : plants.slice(start);
  const items: any[] = [];

  if (hasPrev) {
    items.push({
      type: "action",
      action: {
        type: "postback",
        label: "前のページを見る",
        data: `action=more_plants_batch&batch_id=${batchSessionId}&page=${page - 1}`,
        displayText: "前のページを見る",
      },
    });
  }
  for (const plant of pageSlice) {
    items.push({
      type: "action",
      action: {
        type: "postback",
        label: getPlantLabel(plant.plant_type).slice(0, 20),
        data: `action=select_plant_batch&batch_id=${batchSessionId}&plant_id=${plant.id}`,
        displayText: getPlantLabel(plant.plant_type),
      },
    });
  }
  if (hasMore) {
    items.push({
      type: "action",
      action: {
        type: "postback",
        label: "次のページを見る",
        data: `action=more_plants_batch&batch_id=${batchSessionId}&page=${page + 1}`,
        displayText: "次のページを見る",
      },
    });
  }
  return items;
}

// ── 不確定写真用 Quick Reply アイテム生成 ────────────────────────
function buildUncertainPlantPageItems(plants: any[], batchSessionId: string, pendingPhotoId: string, page: number): any[] {
  const start = page * PLANT_PAGE_SIZE;
  const hasPrev = page > 0;
  const hasMore = plants.length > start + PLANT_PAGE_SIZE;
  const pageSlice = hasMore ? plants.slice(start, start + PLANT_PAGE_SIZE) : plants.slice(start);
  const items: any[] = [];

  if (hasPrev) {
    items.push({
      type: "action",
      action: {
        type: "postback",
        label: "前のページを見る",
        data: `action=more_plants_uncertain&batch_id=${batchSessionId}&photo_id=${pendingPhotoId}&page=${page - 1}`,
        displayText: "前のページを見る",
      },
    });
  }
  for (const plant of pageSlice) {
    items.push({
      type: "action",
      action: {
        type: "postback",
        label: getPlantLabel(plant.plant_type).slice(0, 20),
        data: `action=select_plant_uncertain&batch_id=${batchSessionId}&photo_id=${pendingPhotoId}&plant_id=${plant.id}`,
        displayText: getPlantLabel(plant.plant_type),
      },
    });
  }
  if (hasMore) {
    items.push({
      type: "action",
      action: {
        type: "postback",
        label: "次のページを見る",
        data: `action=more_plants_uncertain&batch_id=${batchSessionId}&photo_id=${pendingPhotoId}&page=${page + 1}`,
        displayText: "次のページを見る",
      },
    });
  }
  return items;
}

// ── バッチ写真を一括保存し AIアドバイスを送信 ──────────────────────
async function saveBatchPhotosAndAdvise(
  supabase: ReturnType<typeof getSupabase>,
  lineToken: string,
  replyToken: string,
  lineUserId: string,
  batchSessionId: string,
  plantId: string
): Promise<void> {
  const { data: batchPhotos } = await supabase
    .from("pending_line_photos")
    .select()
    .eq("batch_session_id", batchSessionId)
    .eq("status", "batching");

  if (!batchPhotos || batchPhotos.length === 0) {
    await replyToLine(lineToken, replyToken, [
      { type: "text", text: "写真が見つかりませんでした。もう一度お試しください🌱" },
    ]);
    return;
  }

  const insertData = batchPhotos.map((photo: any) => ({
    plant_id: plantId,
    image_url: supabase.storage.from("plant-photos").getPublicUrl(photo.storage_path).data.publicUrl,
    storage_path: photo.storage_path,
    taken_at: new Date().toISOString(),
  }));

  const { error: insertError } = await supabase.from("plant_photos").insert(insertData);
  if (insertError) {
    console.error(`[Batch] plant_photos insert失敗`, insertError);
    await replyToLine(lineToken, replyToken, [
      { type: "text", text: "写真の保存に失敗しました。もう一度お試しください🌱" },
    ]);
    return;
  }

  await supabase.from("pending_line_photos").update({ status: "completed" }).eq("batch_session_id", batchSessionId);
  await supabase.from("line_batch_sessions").update({ status: "completed" }).eq("id", batchSessionId);
  revalidatePath("/");
  console.log(`[Batch] ${batchPhotos.length}枚保存完了 plant_id=${plantId}`);

  const { data: plant } = await supabase
    .from("plants")
    .select("plant_type, initial_state_type, initial_state_note")
    .eq("id", plantId)
    .single();
  const plantName = plant ? getPlantLabel(plant.plant_type) : "植物";

  await replyToLine(lineToken, replyToken, [
    { type: "text", text: `${plantName}の写真${batchPhotos.length}枚を保存しました🌱\n少しお待ちください…` },
  ]);

  // 1枚目の画像でAIアドバイス
  const firstPhoto = batchPhotos[0];
  const { data: urlData } = supabase.storage.from("plant-photos").getPublicUrl(firstPhoto.storage_path);
  const advice = await generatePhotoAdvice({
    imageUrl: urlData.publicUrl,
    plantName,
    initialStateType: plant?.initial_state_type ?? null,
    initialStateNote: plant?.initial_state_note ?? null,
  });
  if (advice && lineUserId) {
    await pushToLine(lineToken, lineUserId, [{ type: "text", text: advice }]);
  }
}

// 植物写真を plant_photos に保存し、AIアドバイスを push 送信する共通処理
async function savePlantPhotoAndAdvise(
  supabase: ReturnType<typeof getSupabase>,
  lineToken: string,
  replyToken: string,
  lineUserId: string,
  pendingId: string,
  plantId: string
): Promise<void> {
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

  const { error: photoError } = await supabase.from("plant_photos").insert({
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

  await replyToLine(lineToken, replyToken, [
    { type: "text", text: `${plantName}の写真として追加しました🌱\n少しお待ちください…` },
  ]);

  const advice = await generatePhotoAdvice({
    imageUrl,
    plantName,
    initialStateType: plant?.initial_state_type ?? null,
    initialStateNote: plant?.initial_state_note ?? null,
  });

  if (advice && lineUserId) {
    await pushToLine(lineToken, lineUserId, [{ type: "text", text: advice }]);
  }
}

// ── 友だち追加時のウェルカムメッセージ ──────────────────────────
async function handleFollowEvent(event: any, lineToken: string) {
  const lineUserId: string = event.source?.userId ?? "unknown";
  const replyToken: string = event.replyToken;
  console.log(`[LINE] follow event received userId=${lineUserId}`);

  await replyToLine(lineToken, replyToken, [
    {
      type: "text",
      text: "こんにちは🌱\n植物の見守りBotです。\n\nこのBotでは、毎朝のケア通知や写真記録ができます。\n\nまずは下のボタンから登録してください。\n登録すると、毎朝の植物通知が届くようになります。\n\n写真を送ると、そのまま記録とアドバイスもできます📸\n\nやめたいときは『解除』と送ればOKです",
      quickReply: {
        items: [
          {
            type: "action",
            action: { type: "message", label: "登録する", text: "登録" },
          },
          {
            type: "action",
            action: { type: "message", label: "通知テスト", text: "通知テスト" },
          },
          {
            type: "action",
            action: { type: "message", label: "使い方を見る", text: "通知" },
          },
        ],
      },
    },
  ]);
  console.log(`[LINE] welcome message sent userId=${lineUserId}`);
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

  // 4. バッチモード確認 → アクティブなら一時蓄積して返す
  const batchSession = await getActiveBatchSession(supabase, lineUserId);
  if (batchSession) {
    await supabase
      .from("pending_line_photos")
      .update({ batch_session_id: batchSession.id, status: "batching" })
      .eq("id", pending.id);

    const { count } = await supabase
      .from("pending_line_photos")
      .select("*", { count: "exact", head: true })
      .eq("batch_session_id", batchSession.id)
      .eq("status", "batching");

    const photoCount = count ?? 1;
    console.log(`[Batch] 蓄積 userId=${lineUserId} batchId=${batchSession.id} count=${photoCount}`);
    await replyToLine(lineToken, replyToken, [
      { type: "text", text: `${photoCount}枚目を受け取りました📷\n続けて送るか、「完了」で植物を選んでください。` },
    ]);
    return;
  }

  // 5. AI で植物を推定 → 確認メッセージ送信
  const plants = await fetchActivePlants(supabase);

  if (plants.length === 0) {
    await replyToLine(lineToken, replyToken, [
      { type: "text", text: "登録されている植物がありません。先にWebアプリで植物を追加してください🌱" },
    ]);
    return;
  }

  const { data: imageUrlData } = supabase.storage.from("plant-photos").getPublicUrl(storagePath);
  const imageUrl = imageUrlData.publicUrl;

  const plantsForAI = plants.map((p: any) => ({
    id: p.id,
    name: getPlantLabel(p.plant_type),
    species: p.species ?? null,
    memo: p.memo ?? null,
  }));

  console.log(`[AI] 識別候補植物数=${plantsForAI.length}: ${plantsForAI.map((p: any) => p.name).join(", ")}`);

  const aiResult = await identifyPlantFromPhoto({ imageUrl, plants: plantsForAI });

  console.log(`[AI] 識別結果: matchedPlantId=${aiResult?.matchedPlantId ?? "null"} matchedPlantName=${aiResult?.matchedPlantName ?? "null"} confidence=${aiResult?.confidence ?? "null"} reason=${aiResult?.reason ?? ""}`);

  if (aiResult && aiResult.confidence >= CONFIDENCE_THRESHOLD) {
    // AI が信頼度高く推定できた → ユーザーに確認
    await replyToLine(lineToken, replyToken, [
      {
        type: "text",
        text: `この写真は${aiResult.matchedPlantName}っぽいです🌿\n（${aiResult.reason}）\n\n${aiResult.matchedPlantName}として保存しますか？`,
        quickReply: {
          items: [
            {
              type: "action",
              action: {
                type: "postback",
                label: `${aiResult.matchedPlantName}で保存`.slice(0, 20),
                data: `action=confirm_ai_plant&id=${pending.id}&plant_id=${aiResult.matchedPlantId}`,
                displayText: `${aiResult.matchedPlantName}で保存`,
              },
            },
            {
              type: "action",
              action: {
                type: "postback",
                label: "別の植物を選ぶ",
                data: `action=reject_ai_plant&id=${pending.id}`,
                displayText: "別の植物を選ぶ",
              },
            },
            {
              type: "action",
              action: {
                type: "postback",
                label: "今回はやめる",
                data: `action=cancel_photo&id=${pending.id}`,
                displayText: "今回はやめる",
              },
            },
          ],
        },
      },
    ]);
  } else {
    // AI が判断できなかった → 直接植物選択フローへ
    console.log(`[AI] 推定失敗 or 信頼度低 (${aiResult?.confidence ?? "null"}) → 植物選択フローへ`);

    await supabase
      .from("pending_line_photos")
      .update({ status: "selecting_plant" })
      .eq("id", pending.id);

    const items = buildPlantPageItems(plants, pending.id, 0);
    const totalPages = Math.ceil(plants.length / PLANT_PAGE_SIZE);
    const hasMoreFirst = plants.length > PLANT_PAGE_SIZE;
    console.log(`[Plants] page=1/${totalPages} 表示件数=${items.length} 前へ=なし 次へ=${hasMoreFirst}`);

    await replyToLine(lineToken, replyToken, [
      {
        type: "text",
        text: "どの植物か判断が難しかったので、植物を選んでください🌱",
        quickReply: { items },
      },
    ]);
  }
}

async function handlePostback(event: any, lineToken: string) {
  const supabase = getSupabase();
  const replyToken: string = event.replyToken;
  const params = new URLSearchParams(event.postback?.data ?? "");
  const action = params.get("action");
  const pendingId = params.get("id");
  const plantId = params.get("plant_id");
  const batchSessionId = params.get("batch_id");

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
    const hasMoreFirst = plants.length > PLANT_PAGE_SIZE;
    console.log(`[Plants] page=1/${totalPages} 表示件数=${items.length} 前へ=なし 次へ=${hasMoreFirst}`);

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

  // ── AI推定結果を「はい」で確認 → 保存 ──
  if (action === "confirm_ai_plant" && pendingId && plantId) {
    const lineUserId: string = event.source?.userId ?? "";
    console.log(`[AI] ユーザー確認: confirm plant_id=${plantId} pendingId=${pendingId}`);
    await savePlantPhotoAndAdvise(supabase, lineToken, replyToken, lineUserId, pendingId, plantId);
    return;
  }

  // ── 「別の植物を選ぶ」が押された → 植物選択フローへ ──
  if (action === "reject_ai_plant" && pendingId) {
    console.log(`[AI] ユーザー拒否: reject → 植物選択フローへ pendingId=${pendingId}`);

    await supabase
      .from("pending_line_photos")
      .update({ status: "selecting_plant" })
      .eq("id", pendingId);

    const plants = await fetchActivePlants(supabase);
    const items = buildPlantPageItems(plants, pendingId, 0);
    const totalPages = Math.ceil(plants.length / PLANT_PAGE_SIZE);
    console.log(`[Plants] reject_ai_plant page=1/${totalPages} 表示件数=${items.length}`);

    await replyToLine(lineToken, replyToken, [
      {
        type: "text",
        text: "どの植物の写真として追加しますか？",
        quickReply: { items },
      },
    ]);
    return;
  }

  // ── 「次の植物を見る」が押された → 次ページを Quick Reply で表示 ──
  if (action === "more_plants" && pendingId) {
    const page = parseInt(params.get("page") ?? "1", 10);

    const plants = await fetchActivePlants(supabase);
    const totalPages = Math.ceil(plants.length / PLANT_PAGE_SIZE);

    const hasPrevLog = page > 0;
    const hasMoreLog = plants.length > page * PLANT_PAGE_SIZE + PLANT_PAGE_SIZE;
    console.log(`[Plants] more_plants page=${page + 1}/${totalPages} 全件数=${plants.length} 前へ=${hasPrevLog} 次へ=${hasMoreLog}`);

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
    await savePlantPhotoAndAdvise(supabase, lineToken, replyToken, lineUserId, pendingId, plantId);
    return;
  }

  // ── バッチ：植物が選ばれた → 全枚数を一括保存 ──────────────────
  if (action === "select_plant_batch" && batchSessionId && plantId) {
    const lineUserId: string = event.source?.userId ?? "";
    console.log(`[Batch] 植物選択 batchId=${batchSessionId} plant_id=${plantId}`);
    await saveBatchPhotosAndAdvise(supabase, lineToken, replyToken, lineUserId, batchSessionId, plantId);
    return;
  }

  // ── バッチ：植物選択のページング ───────────────────────────────
  if (action === "more_plants_batch" && batchSessionId) {
    const page = parseInt(params.get("page") ?? "0", 10);
    const plants = await fetchActivePlants(supabase);
    const items = buildBatchPlantPageItems(plants, batchSessionId, page);
    await replyToLine(lineToken, replyToken, [
      {
        type: "text",
        text: `どの植物として保存しますか？（${page + 1}ページ目）`,
        quickReply: { items },
      },
    ]);
    return;
  }

  // ── 不確定写真：植物を選んで保存 → 次の要確認写真へ ───────────
  if (action === "select_plant_uncertain") {
    const photoId = params.get("photo_id");
    const lineUserId: string = event.source?.userId ?? "";
    if (!batchSessionId || !photoId || !plantId) return;

    const { data: photo } = await supabase.from("pending_line_photos").select().eq("id", photoId).single();
    if (!photo) {
      await replyToLine(lineToken, replyToken, [{ type: "text", text: "写真が見つかりませんでした🌱" }]);
      return;
    }

    const { data: urlData } = supabase.storage.from("plant-photos").getPublicUrl(photo.storage_path);
    const { error: insertError } = await supabase.from("plant_photos").insert({
      plant_id: plantId,
      image_url: urlData.publicUrl,
      storage_path: photo.storage_path,
      taken_at: new Date().toISOString(),
    });
    if (insertError) {
      console.error(`[Uncertain] plant_photos insert失敗 photo=${photoId}`, insertError);
      await replyToLine(lineToken, replyToken, [{ type: "text", text: "保存に失敗しました。もう一度お試しください🌱" }]);
      return;
    }
    await supabase.from("pending_line_photos").update({ status: "completed" }).eq("id", photoId);
    revalidatePath("/");

    const { data: plantData } = await supabase.from("plants").select("plant_type").eq("id", plantId).single();
    const plantName = plantData ? getPlantLabel(plantData.plant_type) : "植物";
    console.log(`[Uncertain] 保存完了 photo=${photoId} plant=${plantName}`);

    // 次の要確認写真を取得
    const { data: nextPhotos } = await supabase
      .from("pending_line_photos")
      .select()
      .eq("batch_session_id", batchSessionId)
      .eq("status", "needs_selection")
      .order("created_at", { ascending: true })
      .limit(1);

    if (!nextPhotos || nextPhotos.length === 0) {
      await supabase.from("line_batch_sessions").update({ status: "completed" }).eq("id", batchSessionId);
      await replyToLine(lineToken, replyToken, [
        { type: "text", text: `${plantName}として保存しました✅\nすべての写真の登録が完了しました🌱` },
      ]);
      return;
    }

    const nextPhoto = nextPhotos[0];
    const { data: nextUrlData } = supabase.storage.from("plant-photos").getPublicUrl(nextPhoto.storage_path);
    const { count: remainCount } = await supabase
      .from("pending_line_photos")
      .select("*", { count: "exact", head: true })
      .eq("batch_session_id", batchSessionId)
      .eq("status", "needs_selection");

    const plants = await fetchActivePlants(supabase);
    const items = buildUncertainPlantPageItems(plants, batchSessionId, nextPhoto.id, 0);

    await replyToLine(lineToken, replyToken, [
      { type: "text", text: `${plantName}として保存しました✅` },
      { type: "image", originalContentUrl: nextUrlData.publicUrl, previewImageUrl: nextUrlData.publicUrl },
      { type: "text", text: `次の写真（残り${remainCount ?? "?"}枚）\nどの植物ですか？`, quickReply: { items } },
    ]);
    return;
  }

  // ── 不確定写真：植物選択のページング ────────────────────────────
  if (action === "more_plants_uncertain") {
    const photoId = params.get("photo_id");
    if (!batchSessionId || !photoId) return;
    const page = parseInt(params.get("page") ?? "0", 10);

    const plants = await fetchActivePlants(supabase);
    const items = buildUncertainPlantPageItems(plants, batchSessionId, photoId, page);

    const { data: photo } = await supabase.from("pending_line_photos").select().eq("id", photoId).single();
    const msgs: any[] = [];
    if (photo) {
      const { data: photoUrlData } = supabase.storage.from("plant-photos").getPublicUrl(photo.storage_path);
      msgs.push({ type: "image", originalContentUrl: photoUrlData.publicUrl, previewImageUrl: photoUrlData.publicUrl });
    }
    msgs.push({ type: "text", text: `植物を選んでください（${page + 1}ページ目）`, quickReply: { items } });
    await replyToLine(lineToken, replyToken, msgs);
    return;
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

    // フォロー（友だち追加）
    if (event.type === "follow") {
      await handleFollowEvent(event, lineToken);
      return NextResponse.json({ ok: true });
    }

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

    // テキスト
    if (event.type !== "message" || event.message?.type !== "text") {
      return NextResponse.json({ ok: true });
    }

    const userMessage: string = event.message.text.trim();
    const replyToken: string = event.replyToken;
    const lineUserId: string = event.source?.userId ?? "";
    const supabase = getSupabase();

    // ── コマンド：まとめて（バッチ開始） ───────────────────────────
    if (userMessage === "まとめて" || userMessage === "複数枚") {
      // 古いアクティブセッションがあればキャンセル
      const { data: oldSessions } = await supabase
        .from("line_batch_sessions")
        .select("id")
        .eq("line_user_id", lineUserId)
        .eq("status", "active");

      if (oldSessions && oldSessions.length > 0) {
        const oldIds = oldSessions.map((s: any) => s.id);
        await supabase.from("line_batch_sessions").update({ status: "canceled" }).in("id", oldIds);
        await supabase.from("pending_line_photos").update({ status: "canceled" }).in("batch_session_id", oldIds);
        console.log(`[Batch] 古いセッション${oldIds.length}件をキャンセル userId=${lineUserId}`);
      }

      await supabase.from("line_batch_sessions").insert({ line_user_id: lineUserId });
      console.log(`[Batch] セッション開始 userId=${lineUserId}`);
      await replyToLine(lineToken, replyToken, [
        {
          type: "text",
          text: "複数枚モードを開始しました📷\n写真を何枚でも送ってください。\n送り終わったら「完了」と送ると植物を選んで一括保存できます。\n（中止するには「キャンセル」と送ってください）",
        },
      ]);
      return NextResponse.json({ ok: true });
    }

    // ── コマンド：完了（AI識別 → 自動保存 or 要確認） ────────────────
    if (userMessage === "完了") {
      const batchSession = await getActiveBatchSession(supabase, lineUserId);
      if (batchSession) {
        const { data: batchPhotos } = await supabase
          .from("pending_line_photos")
          .select("*")
          .eq("batch_session_id", batchSession.id)
          .eq("status", "batching")
          .order("created_at", { ascending: true });

        if (!batchPhotos || batchPhotos.length === 0) {
          await replyToLine(lineToken, replyToken, [
            { type: "text", text: "写真が届いていません📷\n写真を送ってから「完了」と送ってください。" },
          ]);
          return NextResponse.json({ ok: true });
        }

        await supabase.from("line_batch_sessions").update({ status: "selecting_plant" }).eq("id", batchSession.id);

        const plants = await fetchActivePlants(supabase);
        const plantsForAI = plants.map((p: any) => ({
          id: p.id,
          name: getPlantLabel(p.plant_type),
          species: p.species ?? null,
          memo: p.memo ?? null,
        }));

        // AI で各写真を識別 → 自信あり=自動保存 / 自信なし=要確認キュー
        const autoSavedNames: string[] = [];
        const uncertainPhotoIds: string[] = [];

        for (const photo of batchPhotos) {
          const { data: urlData } = supabase.storage.from("plant-photos").getPublicUrl(photo.storage_path);
          const aiResult = await identifyPlantFromPhoto({ imageUrl: urlData.publicUrl, plants: plantsForAI });
          console.log(`[Batch/AI] photo=${photo.id} confidence=${aiResult?.confidence ?? "null"} plant=${aiResult?.matchedPlantName ?? "null"}`);

          if (aiResult && aiResult.confidence >= CONFIDENCE_THRESHOLD) {
            const { error: insertError } = await supabase.from("plant_photos").insert({
              plant_id: aiResult.matchedPlantId,
              image_url: urlData.publicUrl,
              storage_path: photo.storage_path,
              taken_at: new Date().toISOString(),
            });
            if (!insertError) {
              await supabase.from("pending_line_photos").update({ status: "completed" }).eq("id", photo.id);
              autoSavedNames.push(aiResult.matchedPlantName);
            } else {
              console.error(`[Batch/AI] 自動保存失敗 photo=${photo.id}`, insertError);
              await supabase.from("pending_line_photos").update({ status: "needs_selection" }).eq("id", photo.id);
              uncertainPhotoIds.push(photo.id);
            }
          } else {
            await supabase.from("pending_line_photos").update({ status: "needs_selection" }).eq("id", photo.id);
            uncertainPhotoIds.push(photo.id);
          }
        }

        revalidatePath("/");
        console.log(`[Batch/AI] 自動保存=${autoSavedNames.length}枚 要確認=${uncertainPhotoIds.length}枚`);

        if (uncertainPhotoIds.length === 0) {
          await supabase.from("line_batch_sessions").update({ status: "completed" }).eq("id", batchSession.id);
          await replyToLine(lineToken, replyToken, [
            { type: "text", text: `${batchPhotos.length}枚すべてAIが自動で保存しました🌱\n（${autoSavedNames.join("、")}）` },
          ]);
          return NextResponse.json({ ok: true });
        }

        // 要確認写真を1枚ずつ表示
        const { data: firstUncertainData } = await supabase
          .from("pending_line_photos")
          .select()
          .eq("id", uncertainPhotoIds[0])
          .single();

        if (!firstUncertainData) {
          await replyToLine(lineToken, replyToken, [{ type: "text", text: "エラーが発生しました🌱" }]);
          return NextResponse.json({ ok: true });
        }

        const { data: firstUrlData } = supabase.storage.from("plant-photos").getPublicUrl(firstUncertainData.storage_path);
        const items = buildUncertainPlantPageItems(plants, batchSession.id, firstUncertainData.id, 0);
        const autoMsg = autoSavedNames.length > 0 ? `${autoSavedNames.length}枚はAIが自動で保存しました🌱\n` : "";

        await replyToLine(lineToken, replyToken, [
          { type: "text", text: `${autoMsg}${uncertainPhotoIds.length}枚の植物を確認してください。` },
          { type: "image", originalContentUrl: firstUrlData.publicUrl, previewImageUrl: firstUrlData.publicUrl },
          { type: "text", text: `1枚目（全${uncertainPhotoIds.length}枚）\nどの植物ですか？`, quickReply: { items } },
        ]);
        return NextResponse.json({ ok: true });
      }
      // バッチ中でなければ AI チャットへ流す
    }

    // ── コマンド：キャンセル（バッチ破棄） ──────────────────────────
    if (userMessage === "キャンセル") {
      const batchSession = await getActiveBatchSession(supabase, lineUserId);
      if (batchSession) {
        await supabase.from("line_batch_sessions").update({ status: "canceled" }).eq("id", batchSession.id);
        await supabase.from("pending_line_photos").update({ status: "canceled" }).eq("batch_session_id", batchSession.id);
        console.log(`[Batch] キャンセル batchId=${batchSession.id} userId=${lineUserId}`);
        await replyToLine(lineToken, replyToken, [
          { type: "text", text: "複数枚モードをキャンセルしました🌿\nまた写真を送るときは「まとめて」と送ってください。" },
        ]);
        return NextResponse.json({ ok: true });
      }
      // バッチ中でなければ AI チャットへ流す
    }

    // ── コマンド：登録 ──────────────────────────────────────────────
    if (userMessage === "登録") {
      const { data: existing } = await supabase
        .from("line_notification_users")
        .select("id, is_active")
        .eq("line_user_id", lineUserId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("line_notification_users")
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq("line_user_id", lineUserId);
      } else {
        await supabase
          .from("line_notification_users")
          .insert({ line_user_id: lineUserId, is_active: true });
      }
      console.log(`[通知登録] userId=${lineUserId} 登録完了`);
      console.log(`[LINE] register quick reply sent userId=${lineUserId}`);
      await replyToLine(lineToken, replyToken, [
        {
          type: "text",
          text: "登録しました🌱\n明日から毎朝の植物通知が届きます。\n\n今すぐ試したい場合は、下の『通知テスト』を押してください。",
          quickReply: {
            items: [
              {
                type: "action",
                action: { type: "message", label: "通知テスト", text: "通知テスト" },
              },
            ],
          },
        },
      ]);
      return NextResponse.json({ ok: true });
    }

    // ── コマンド：解除 ──────────────────────────────────────────────
    if (userMessage === "解除") {
      await supabase
        .from("line_notification_users")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("line_user_id", lineUserId);
      console.log(`[通知登録] userId=${lineUserId} 解除完了`);
      await replyToLine(lineToken, replyToken, [
        { type: "text", text: "毎朝の植物通知を停止しました🌿\n再開したい場合は「登録」と送ってください。" },
      ]);
      return NextResponse.json({ ok: true });
    }

    // ── コマンド：通知（使い方案内） ──────────────────────────────────
    if (userMessage === "通知") {
      await replyToLine(lineToken, replyToken, [
        {
          type: "text",
          text: "毎朝、植物のケアが必要かどうかをお知らせします🌱\n\n登録すると毎朝通知が届くようになります。\nやめたいときは「解除」と送ってください。",
          quickReply: {
            items: [
              {
                type: "action",
                action: { type: "message", label: "登録する", text: "登録" },
              },
              {
                type: "action",
                action: { type: "message", label: "通知テスト", text: "通知テスト" },
              },
            ],
          },
        },
      ]);
      return NextResponse.json({ ok: true });
    }

    // ── コマンド：通知テスト ────────────────────────────────────────
    if (userMessage === "通知テスト") {
      const { data: regRecord } = await supabase
        .from("line_notification_users")
        .select("is_active")
        .eq("line_user_id", lineUserId)
        .maybeSingle();
      const isRegistered = regRecord?.is_active === true;
      console.log(`[LINE] notification test requested userId=${lineUserId} registered=${isRegistered}`);

      const { message } = await buildDailyNotificationMessage();

      if (isRegistered) {
        await replyToLine(lineToken, replyToken, [
          { type: "text", text: `📋 通知テスト：\n\n${message}` },
        ]);
      } else {
        await replyToLine(lineToken, replyToken, [
          { type: "text", text: `📋 通知テスト：\n\n${message}` },
          {
            type: "text",
            text: "いかがでしょうか？\nこのようなメッセージが毎朝届くようになります。\n\nよければ登録してみてください👇",
            quickReply: {
              items: [
                {
                  type: "action",
                  action: { type: "message", label: "登録する", text: "登録" },
                },
              ],
            },
          },
        ]);
      }
      return NextResponse.json({ ok: true });
    }

    // ── AI チャット（既存） ─────────────────────────────────────────
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
