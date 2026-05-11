import { supabaseServer as supabase } from "../src/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { BackgroundLayer } from "./BackgroundLayer";
import { PlantColumn } from "./PlantColumn";
import { getCarePriority, type CareRule } from "@/lib/dailyCareMessage";
import { buildPlantCareCards, type PlantAdviceInput } from "@/lib/buildPlantCareAdvice";
import { getPlantTrivia } from "@/lib/plantTrivias";

// DB migration required (run once):
// alter table plants add column if not exists sort_order integer;
// update plants set sort_order = sub.rn - 1
//   from (select id, row_number() over (order by created_at) as rn from plants) sub
//   where plants.id = sub.id;
//
// create table if not exists daily_notification_logs (
//   id uuid primary key default gen_random_uuid(),
//   date date not null unique,
//   message_body text not null,
//   created_at timestamptz default now()
// );
//
// alter table plants add column if not exists fertilizer_enabled boolean default true;
// alter table plants add column if not exists fertilizer_interval_days integer default 14;
// alter table plants add column if not exists last_fertilized_at date;

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

const plantLabelMap: Record<string, string> = {
  tomato: "トマト",
  coriander: "コリアンダー",
  makrut_lime: "コブミカン",
  mint: "ミント",
  everbearing_strawberry: "四季成りイチゴ",
  italian_parsley: "イタリアンパセリ",
  shiso: "大葉",
  perilla: "えごま",
};

function getPlantLabel(plantType: string | null | undefined) {
  if (!plantType) return "植物";
  return plantLabelMap[plantType] ?? plantType;
}

function getAppBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

// ── Server actions ────────────────────────────────────────────────────────────

async function addPlant(formData: FormData) {
  "use server";

  const name = String(formData.get("name") || "").trim();
  const species = String(formData.get("species") || "").trim() || null;
  const location = String(formData.get("location") || "").trim() || null;
  const startedAt = String(formData.get("started_at") || "").trim() || null;
  const memo = String(formData.get("memo") || "").trim() || null;
  const photo = formData.get("photo") as File | null;

  if (!name) return;

  const { data: plant, error: plantError } = await supabase
    .from("plants")
    .insert({
      plant_type: name,
      planted_at: startedAt ?? todayString(),
      started_at: startedAt || null,
      species,
      location,
      memo,
    })
    .select()
    .single();

  if (plantError || !plant) {
    console.error("plants insert error:", plantError);
    return;
  }

  if (photo && photo.size > 0) {
    try {
      const storagePath = `plants/${plant.id}/${Date.now()}-${photo.name}`;
      const bytes = await photo.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from("plant-photos")
        .upload(storagePath, bytes, { contentType: photo.type || "image/jpeg" });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("plant-photos")
          .getPublicUrl(storagePath);
        await supabase.from("plant_photos").insert({
          plant_id: plant.id,
          image_url: urlData.publicUrl,
          storage_path: storagePath,
          taken_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error("photo upload error in addPlant:", err);
    }
  }

  try {
    const baseUrl = getAppBaseUrl();
    const res = await fetch(`${baseUrl}/api/generate-care-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantId: plant.id }),
      cache: "no-store",
    });
    if (!res.ok) console.error("generate-care-rules API error:", await res.text());
  } catch (error) {
    console.error("generate-care-rules fetch error:", error);
  }

  revalidatePath("/");
}

async function archivePlant(formData: FormData) {
  "use server";
  const plantId = String(formData.get("plant_id") || "");
  if (!plantId) return;
  await supabase
    .from("plants")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", plantId);
  revalidatePath("/");
}

async function restorePlant(formData: FormData) {
  "use server";
  const plantId = String(formData.get("plant_id") || "");
  if (!plantId) return;
  await supabase.from("plants").update({ archived_at: null }).eq("id", plantId);
  revalidatePath("/");
}

async function uploadPlantPhoto(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  "use server";

  try {
    const plantId = String(formData.get("plant_id") || "");
    const file = formData.get("photo") as File | null;

    if (!plantId || !file || file.size === 0)
      return { success: false, error: "必要なデータが不足しています" };

    const storagePath = `plants/${plantId}/${Date.now()}-${file.name}`;
    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("plant-photos")
      .upload(storagePath, bytes, { contentType: file.type || "image/jpeg" });

    if (uploadError)
      return { success: false, error: "アップロードに失敗しました。通信状態を確認してください。" };

    const { data: urlData } = supabase.storage
      .from("plant-photos")
      .getPublicUrl(storagePath);

    const { error: dbError } = await supabase.from("plant_photos").insert([
      {
        plant_id: plantId,
        image_url: urlData.publicUrl,
        storage_path: storagePath,
        taken_at: new Date().toISOString(),
      },
    ]);

    if (dbError) return { success: false, error: "データの保存に失敗しました。" };

    revalidatePath("/");
    return { success: true };
  } catch {
    return { success: false, error: "予期しないエラーが発生しました。" };
  }
}

async function reorderPlants(orderedIds: string[]) {
  "use server";
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("plants").update({ sort_order: index }).eq("id", id)
    )
  );
  revalidatePath("/");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function Home() {
  const pageStart = Date.now();
  const today = todayString();

  // Run all independent DB queries in parallel (was sequential → ~10s, now parallel → ~2-3s)
  const dbStart = Date.now();
  const [
    { data: allPlantsRaw, error: plantsError },
    { data: photosRaw, error: photosError },
    { data: careRulesRaw },
  ] = await Promise.all([
    supabase
      .from("plants")
      .select("*")
      .order("created_at", { ascending: false }),
    // Limit to 500 most recent photos; histories beyond this load on demand
    supabase
      .from("plant_photos")
      .select("id, plant_id, image_url, taken_at")
      .order("taken_at", { ascending: false })
      .limit(500),
    supabase
      .from("care_rules")
      .select("id, plant_id, task_type, task_detail, interval_days, title, message, confidence, is_active")
      .eq("is_active", true),
  ]);
  console.log(`[Page] db queries ${Date.now() - dbStart}ms (plants=${allPlantsRaw?.length ?? 0} photos=${photosRaw?.length ?? 0} careRules=${careRulesRaw?.length ?? 0} plantsErr=${plantsError?.message ?? "-"} photosErr=${photosError?.message ?? "-"}`);

  // Sort in JS so the query never fails when sort_order column doesn't exist yet.
  // Plants with sort_order set appear first (ascending), NULLs fall back to created_at order.
  const allPlants = (allPlantsRaw ?? []).sort((a, b) => {
    const aOrd: number | null = a.sort_order ?? null;
    const bOrd: number | null = b.sort_order ?? null;
    if (aOrd !== null && bOrd !== null) return aOrd - bOrd;
    if (aOrd !== null) return -1;
    if (bOrd !== null) return 1;
    return 0;
  });
  const plants = allPlants.filter((p) => !p.archived_at);
  const archivedPlants = allPlants.filter((p) => !!p.archived_at);

  const photos = photosRaw ?? [];
  const latestPhotos: Record<string, string> = {};
  const photoHistories: Record<
    string,
    { id: string; url: string; takenAt: string }[]
  > = {};

  for (const photo of photos) {
    const url: string = photo.image_url ?? "";
    if (!url) continue;
    if (!latestPhotos[photo.plant_id]) latestPhotos[photo.plant_id] = url;
    if (!photoHistories[photo.plant_id]) photoHistories[photo.plant_id] = [];
    photoHistories[photo.plant_id].push({
      id: photo.id,
      url,
      takenAt: String(photo.taken_at ?? "").slice(0, 10),
    });
  }

  // Badge record: derived from photo recency (urgent/attention → 要対応)
  const todayMs = new Date(today).getTime();
  const plantHasTodayEventRecord = Object.fromEntries(
    plants.map((plant) => {
      const latestPhoto = photoHistories[plant.id]?.[0];
      const daysSince = latestPhoto
        ? Math.floor((todayMs - new Date(latestPhoto.takenAt).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const priority = getCarePriority(daysSince);
      return [plant.id, priority === "urgent" || priority === "attention"];
    })
  );

  // care_rules を plant_id でグループ化
  const careRulesMap = new Map<string, CareRule[]>();
  for (const rule of careRulesRaw ?? []) {
    if (!careRulesMap.has(rule.plant_id)) careRulesMap.set(rule.plant_id, []);
    careRulesMap.get(rule.plant_id)!.push(rule as CareRule);
  }

  // 植物ごとのケアアドバイスカード生成
  const plantAdviceInputs: PlantAdviceInput[] = plants.map((plant) => {
    const latestPhoto = photoHistories[plant.id]?.[0];
    const daysSinceLastPhoto = latestPhoto
      ? Math.floor((todayMs - new Date(latestPhoto.takenAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const fertilizerBaseDate =
      (plant.last_fertilized_at as string | null) ??
      (plant.created_at as string | null) ??
      today;
    const daysSinceLastFertilized = Math.floor(
      (todayMs - new Date(String(fertilizerBaseDate).slice(0, 10)).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return {
      id: plant.id,
      display_name: getPlantLabel(plant.plant_type),
      plantType: plant.plant_type ?? null,
      daysSinceLastPhoto,
      fertilizerEnabled: plant.fertilizer_enabled !== false,
      fertilizerIntervalDays: (plant.fertilizer_interval_days as number | null) ?? 14,
      daysSinceLastFertilized,
      latestPhotoUrl: latestPhotos[plant.id] ?? null,
    };
  });

  const plantCareCards = buildPlantCareCards(plantAdviceInputs, careRulesMap);

  // PlantColumn に渡すケアカードマップ（plant_id → advice/tags/priority）
  const careCardMap = Object.fromEntries(
    plantCareCards.map(c => [c.plantId, { advice: c.advice, tags: c.tags, priority: c.priority }])
  );

  // 今日の1枚: 写真あり・urgent/attention 優先、なければ先頭
  const spotlightCard = (() => {
    const withPhoto = plantCareCards.filter(c => !!c.latestPhotoUrl);
    if (withPhoto.length === 0) return null;
    return withPhoto.find(c => c.priority === "urgent" || c.priority === "attention") ?? withPhoto[0];
  })();
  const spotlightTrivia = spotlightCard
    ? getPlantTrivia(spotlightCard.plantType ?? null, today)
    : null;

  // 全体サマリー集計
  const summaryStats = {
    waterCount: plantCareCards.filter(c => c.tags.includes("水やり")).length,
    fertilizerCount: plantCareCards.filter(c => c.tags.includes("液体肥料")).length,
    // 観察・環境確認は同じ「見守り」カテゴリ。植物単位で重複カウントしない
    observationCount: plantCareCards.filter(c =>
      c.tags.some(t => t === "観察" || t === "環境確認")
    ).length,
    photoCount: plantCareCards.filter(c => c.tags.includes("写真記録")).length,
    total: plantCareCards.length,
  };

  console.log(`[Page] total render ${Date.now() - pageStart}ms`);

  const fontFamily =
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  return (
    <>
      <style>{`
        /* ─── Board grid ─── */
        .board-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 18px;
          align-items: start;
        }
        @media (max-width: 960px) {
          .board-grid { grid-template-columns: 1fr; }
        }

        /* ─── Grid span helpers ─── */
        .col-plants { grid-column: span 2; }
        .col-right {
          grid-column: span 1;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        @media (max-width: 960px) {
          .col-plants, .col-right { grid-column: span 1; }
        }

        /* ─── Mobile reorder: spotlight → plants → sidebar ─── */
        .spotlight-section {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .sidebar-section {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        @media (max-width: 960px) {
          .board-grid { display: flex; flex-direction: column; }
          .col-right { display: contents; }
          .spotlight-section { order: 1; }
          .col-plants { order: 2; }
          .sidebar-section { order: 3; }
        }

        /* ─── Column panel ─── */
        .col-board {
          background: rgba(253, 250, 244, 0.96);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.95);
          border-radius: 14px;
          padding: 18px;
          box-shadow: 0 2px 16px rgba(60, 50, 30, 0.10);
        }

        /* ─── Column heading (Trello board label style) ─── */
        .col-heading {
          font-size: 14px;
          font-weight: 800;
          color: #1a3320;
          margin: 0 0 14px;
          letter-spacing: -0.1px;
          line-height: 1.3;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 0;
          border: none;
          background: none;
        }
        .col-heading::before {
          content: '';
          display: block;
          width: 11px;
          height: 11px;
          border-radius: 3px;
          background: #48b06a;
          flex-shrink: 0;
        }

        /* ─── Plants grid (auto-fill, responsive columns) ─── */
        .plants-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 8px;
          margin-bottom: 12px;
        }
        @media (max-width: 480px) {
          .plants-grid { grid-template-columns: 1fr; }
        }

        /* ─── Plant card ─── */
        .plant-card {
          background: #ffffff;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(60, 50, 30, 0.08);
          transition: box-shadow 0.15s;
        }
        .plant-card:hover {
          box-shadow: 0 3px 10px rgba(60, 50, 30, 0.13);
        }

        /* ─── Generic white cards ─── */
        .todo-card,
        .form-card,
        .line-card {
          background: #ffffff;
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 8px;
          box-shadow: 0 1px 3px rgba(60, 50, 30, 0.07);
        }

        /* ─── Today task card ─── */
        .todo-card-active {
          background: #ffffff;
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 8px;
          box-shadow: 0 1px 3px rgba(60, 50, 30, 0.07);
          border-left: 3px solid #06c755;
        }

        /* ─── Empty today card ─── */
        .empty-today-card {
          background: linear-gradient(135deg, #f2faf4 0%, #faf8f3 100%);
          border-radius: 10px;
          padding: 28px 16px;
          margin-bottom: 8px;
          text-align: center;
          border: 1px dashed #c8e6cc;
        }

        /* ─── Sub-section label ─── */
        .sub-heading {
          font-size: 11px;
          font-weight: 700;
          color: #a0a8a2;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin: 20px 0 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid #e8e4dc;
        }

        /* ─── Badges ─── */
        .badge-alert {
          display: inline-block;
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          background: #fef3c7;
          color: #92400e;
        }
        .badge-ok {
          display: inline-block;
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          background: #dcf5e4;
          color: #1a5c36;
        }

        /* ─── Form inputs ─── */
        .form-input {
          width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #ddd8cf;
          background: #fdfcfa;
          font-size: 13px;
          box-sizing: border-box;
          font-family: inherit;
          color: #374151;
        }
        .form-input:focus {
          outline: none;
          border-color: #6db07b;
          box-shadow: 0 0 0 2px rgba(109, 176, 123, 0.18);
        }
        .form-textarea {
          width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #ddd8cf;
          background: #fdfcfa;
          font-size: 13px;
          box-sizing: border-box;
          font-family: inherit;
          color: #374151;
          resize: vertical;
          min-height: 60px;
          line-height: 1.5;
        }
        .form-textarea:focus {
          outline: none;
          border-color: #6db07b;
          box-shadow: 0 0 0 2px rgba(109, 176, 123, 0.18);
        }

        /* ─── Form label ─── */
        .form-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #7a8a7a;
          margin-bottom: 5px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* ─── QR placeholder ─── */
        .qr-placeholder {
          width: 88px;
          height: 88px;
          background: #f2faf4;
          border: 2px dashed #93c9a0;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        /* ─── Button base ─── */
        .btn {
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          font-family: inherit;
        }
        .btn-primary {
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          font-family: inherit;
          background: #06c755;
          color: #ffffff;
        }
      `}</style>

      <BackgroundLayer />

      <main style={{ minHeight: "100vh", padding: "14px 20px 48px", fontFamily }}>
        <div style={{ maxWidth: 1440, margin: "0 auto 14px", paddingRight: 200 }}>
          <span style={{ fontSize: 12, color: "#8a9a8a", fontWeight: 500, letterSpacing: 0.2 }}>
            Keep every balcony plant healthy.
          </span>
        </div>

        <div className="board-grid" style={{ maxWidth: 1440, margin: "0 auto" }}>
          {/* ── Column 1: 育てている植物 (2/3幅) ── */}
          <div className="col-plants">
            <PlantColumn
              plants={plants}
              archivedPlants={archivedPlants}
              today={today}
              plantHasTodayEventRecord={plantHasTodayEventRecord}
              hasError={!!plantsError}
              addPlantAction={addPlant}
              archivePlantAction={archivePlant}
              restorePlantAction={restorePlant}
              reorderPlantAction={reorderPlants}
              uploadPhotoAction={uploadPlantPhoto}
              latestPhotos={latestPhotos}
              photoHistories={photoHistories}
              careCardMap={careCardMap}
            />
          </div>

          {/* ── Right column (1/3幅): 今日の1枚・全体サマリー・LINE登録 ── */}
          <div className="col-right">

          {/* ── 今日の1枚（モバイルでは最上部に来る） ── */}
          <div className="spotlight-section">
          <div className="col-board">
            <h2 className="col-heading">Today's pick</h2>

            {spotlightCard ? (
              <div style={{ background: "#ffffff", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(60,50,30,0.07)" }}>
                <img
                  src={spotlightCard.latestPhotoUrl!}
                  alt={spotlightCard.plantName}
                  style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }}
                />
                <div style={{ padding: "10px 12px 12px" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#2d4a3e", marginBottom: 4 }}>
                    {spotlightCard.plantName}
                  </div>
                  <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.65 }}>
                    {spotlightCard.advice}
                  </div>
                  {spotlightTrivia && (
                    <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.65, marginTop: 6, paddingTop: 6, borderTop: "1px solid #f0ebe2", fontStyle: "italic" }}>
                      💡 {spotlightTrivia}
                    </div>
                  )}
                  {spotlightCard.tags.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 7 }}>
                      {spotlightCard.tags.map((tag) => {
                        const tagCfg: Record<string, { bg: string; color: string }> = {
                          "水やり":   { bg: "#dbeafe", color: "#1e40af" },
                          "液体肥料": { bg: "#fef3c7", color: "#92400e" },
                          "観察":     { bg: "#e0f2fe", color: "#0369a1" },
                          "写真記録": { bg: "#ede9fe", color: "#5b21b6" },
                          "剪定":     { bg: "#dcfce7", color: "#166534" },
                          "収穫":     { bg: "#d1fae5", color: "#065f46" },
                          "環境確認": { bg: "#f1f5f9", color: "#475569" },
                        };
                        const c = tagCfg[tag] ?? { bg: "#f1f5f9", color: "#475569" };
                        return (
                          <span key={tag} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, fontWeight: 600, background: c.bg, color: c.color }}>
                            {tag}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="empty-today-card">
                <p style={{ color: "#7a9a7a", margin: 0, fontSize: 13, lineHeight: 1.6 }}>
                  写真を記録すると、ここに今日の注目植物が表示されます。
                </p>
              </div>
            )}
          </div>

          {/* ── まとめてやるケア ── */}
          {summaryStats.total > 0 && (() => {
            const { fertilizerCount, waterCount, observationCount } = summaryStats;
            const hasGrouped = fertilizerCount >= 2 || waterCount >= 2 || observationCount >= 2;

            let line1 = "";
            let line2 = "";
            let line3 = "";
            // 対象植物を絞り込む（優先順：液体肥料 → 水やり → 観察）
            const targetPlants: typeof plantCareCards = (() => {
              if (fertilizerCount >= 2) {
                line1 = `液体肥料の対象が${fertilizerCount}件あります。`;
                line2 = "今日は液肥をまとめてあげるとよさそうです。";
                line3 = "余裕があれば、気になる植物から見てみましょう。";
                return plantCareCards.filter(c => c.tags.includes("液体肥料"));
              }
              if (waterCount >= 2) {
                line1 = `水やりの対象が${waterCount}件あります。`;
                line2 = "ベランダに出たついでに、土の乾き具合をまとめて見てみましょう。";
                return plantCareCards.filter(c => c.tags.includes("水やり"));
              }
              if (observationCount >= 2) {
                line1 = `${observationCount}件の植物が観察のタイミングです。`;
                line2 = "ベランダを通るときに、葉や茎の様子をさらっと見てみましょう。";
                return plantCareCards.filter(c => c.tags.some(t => t === "観察" || t === "環境確認"));
              }
              return [];
            })();

            const SHOW_MAX = 3;
            const shownPlants = targetPlants.slice(0, SHOW_MAX);
            const restCount = targetPlants.length - shownPlants.length;

            return (
              <div className="col-board">
                <h2 className="col-heading">Care batch</h2>
                {hasGrouped ? (
                  <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.8 }}>
                    <p style={{ margin: "0 0 4px", fontWeight: 700, color: "#2d4a3e" }}>{line1}</p>
                    <p style={{ margin: "0 0 4px" }}>{line2}</p>
                    {line3 && <p style={{ margin: "0 0 8px", color: "#6b7280" }}>{line3}</p>}
                    {shownPlants.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #f0ebe2", fontSize: 11, color: "#6b7280", lineHeight: 1.7 }}>
                        <span style={{ fontWeight: 600, color: "#4b7a5a" }}>今日見る植物：</span>
                        {shownPlants.map(c => c.plantName).join("・")}
                        {restCount > 0 && <span style={{ color: "#9ca3af" }}> ほか{restCount}件</span>}
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: "#6b7280", margin: 0, lineHeight: 1.75 }}>
                    今日はまとめて気にかけるケアはなさそうです。
                  </p>
                )}
              </div>
            );
          })()}
          </div>{/* /spotlight-section */}

          {/* ── サイドバー: 全体サマリー・LINE（モバイルでは植物カードの下） ── */}
          <div className="sidebar-section">

          {/* ── 全体サマリー ── */}
          {summaryStats.total > 0 && (
            <div className="col-board">
              <h2 className="col-heading">Care summary</h2>

              {/* 🌿 今日の主なお世話：水やり・液体肥料 */}
              {(summaryStats.waterCount > 0 || summaryStats.fertilizerCount > 0) && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#3d6b3d", margin: "0 0 4px 0" }}>
                    🌿 今日の主なお世話
                  </p>
                  <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#374151", lineHeight: 1.75 }}>
                    {summaryStats.waterCount > 0 && summaryStats.fertilizerCount > 0 ? (
                      <>水やり候補が<b>{summaryStats.waterCount}件</b>、液体肥料のタイミングが<b>{summaryStats.fertilizerCount}件</b>あります。</>
                    ) : summaryStats.waterCount > 0 ? (
                      <>水やり候補が<b>{summaryStats.waterCount}件</b>あります。</>
                    ) : (
                      <>液体肥料のタイミングが<b>{summaryStats.fertilizerCount}件</b>あります。</>
                    )}
                    {(summaryStats.waterCount + summaryStats.fertilizerCount) >= 5 && (
                      <><br /><span style={{ color: "#6b7280" }}>対象が多めなので、まずはよく育っている植物や最近元気のない植物から確認しましょう。</span></>
                    )}
                  </div>
                </div>
              )}

              {/* 👀 見守りポイント：観察・環境確認 */}
              {summaryStats.observationCount > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", margin: "0 0 4px 0" }}>
                    👀 見守りポイント
                  </p>
                  <div style={{ background: "#f0f9ff", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#374151", lineHeight: 1.75 }}>
                    <b>{summaryStats.observationCount}件</b>は通常の観察対象です。
                    <br /><span style={{ color: "#6b7280" }}>葉色・虫食い・土の乾き具合を軽く見ておくと安心です。</span>
                  </div>
                </div>
              )}

              {/* 📸 写真記録のおすすめ */}
              {summaryStats.photoCount > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", margin: "0 0 4px 0" }}>
                    📸 写真記録のおすすめ
                  </p>
                  <div style={{ background: "#faf5ff", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#374151", lineHeight: 1.75 }}>
                    <b>{summaryStats.photoCount}件</b>の植物がしばらく写真のない状態です。
                    <br /><span style={{ color: "#6b7280" }}>余力があれば、お世話のついでに1枚記録しておくと変化に気づきやすいです。</span>
                  </div>
                </div>
              )}

              {/* 全て問題なし */}
              {summaryStats.waterCount === 0 && summaryStats.fertilizerCount === 0 &&
               summaryStats.observationCount === 0 && summaryStats.photoCount === 0 && (
                <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px", lineHeight: 1.75 }}>
                  今日は大きな作業は不要です。ゆっくり様子を見てあげてください。
                </p>
              )}

              <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>
                詳しくは各植物カードのケアメモを確認してください。
              </p>
            </div>
          )}

          {/* ── LINE通知を受け取る ── */}
          <div className="col-board">
            <h2 className="col-heading">LINE reminders</h2>

            <div className="line-card" style={{ marginBottom: 0 }}>
              {/* QR + ボタン */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <img
                  src="/images/line-qr.png"
                  alt="LINE友だち追加QRコード"
                  style={{ width: 180, height: 180, borderRadius: 10, border: "1px solid #e8e4dc", display: "block" }}
                />
                <div style={{ fontSize: 11, color: "#7a8a7a", textAlign: "center", lineHeight: 1.5 }}>
                  QRを読み取るか、下のリンクから追加できます
                </div>
                <a
                  href="https://line.me/R/ti/p/@100ukedv"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "block",
                    width: "100%",
                    maxWidth: 240,
                    padding: "8px 20px",
                    background: "#06c755",
                    color: "#ffffff",
                    textDecoration: "none",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 13,
                    textAlign: "center",
                  }}
                >
                  LINEで友だち追加
                </a>
              </div>

              {/* 使い方説明 */}
              <p
                style={{
                  fontSize: 11,
                  color: "#7a8a7a",
                  margin: 0,
                  lineHeight: 1.75,
                  padding: "10px 0 0",
                  borderTop: "1px solid #f0ebe2",
                }}
              >
                友だち追加後に「登録」と送ると、毎朝の植物通知が届きます🌱<br />
                停止したいときは「解除」と送ってください。
              </p>
            </div>
          </div>
          </div>{/* /sidebar-section */}
          </div>{/* /col-right */}
        </div>
      </main>
    </>
  );
}
