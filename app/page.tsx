import { supabase } from "../src/lib/supabase";
import { revalidatePath } from "next/cache";
import { BackgroundLayer } from "./BackgroundLayer";
import { PlantColumn } from "./PlantColumn";
import {
  buildTodayTasksForPlants,
  buildTodayLineMessage,
} from "@/lib/plantGrowthAdvisor";

// DB migration required (run once):
// alter table plants add column if not exists sort_order integer;
// update plants set sort_order = sub.rn - 1
//   from (select id, row_number() over (order by created_at) as rn from plants) sub
//   where plants.id = sub.id;

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
  const today = todayString();

  const { data: allPlantsRaw, error: plantsError } = await supabase
    .from("plants")
    .select("*")
    .order("created_at", { ascending: false });

  // Sort in JS so the query never fails when sort_order column doesn't exist yet.
  // Plants with sort_order set appear first (ascending), NULLs fall back to created_at order.
  const allPlants = (allPlantsRaw ?? []).sort((a, b) => {
    const aOrd: number | null = a.sort_order ?? null;
    const bOrd: number | null = b.sort_order ?? null;
    if (aOrd !== null && bOrd !== null) return aOrd - bOrd;
    if (aOrd !== null) return -1;
    if (bOrd !== null) return 1;
    return 0; // both null → preserve created_at desc order from query
  });
  const plants = allPlants.filter((p) => !p.archived_at);
  const archivedPlants = allPlants.filter((p) => !!p.archived_at);

  // care_events kept as internal data (not used for badge display)
  await supabase
    .from("care_events")
    .select("id")
    .eq("scheduled_for", today)
    .eq("status", "pending")
    .limit(1);

  // Photos
  const { data: photosRaw, error: photosError } = await supabase
    .from("plant_photos")
    .select("id, plant_id, image_url, taken_at")
    .order("taken_at", { ascending: false });

  console.log(`[Page] plants取得件数=${allPlants.length} photosError=${photosError?.message ?? "なし"}`);
  console.log(`[Page] plant_photos取得件数=${photosRaw?.length ?? 0}`);

  const photos = photosRaw ?? [];
  const latestPhotos: Record<string, string> = {};
  const photoHistories: Record<
    string,
    { id: string; url: string; takenAt: string }[]
  > = {};

  for (const photo of photos) {
    const url: string = photo.image_url ?? "";
    if (!url) continue;
    if (!latestPhotos[photo.plant_id]) {
      latestPhotos[photo.plant_id] = url;
      console.log(`[Page] plant_id=${photo.plant_id} 最新写真あり url=${url}`);
    }
    if (!photoHistories[photo.plant_id]) photoHistories[photo.plant_id] = [];
    photoHistories[photo.plant_id].push({
      id: photo.id,
      url,
      takenAt: String(photo.taken_at ?? "").slice(0, 10),
    });
  }

  for (const plant of plants) {
    if (!latestPhotos[plant.id]) {
      console.log(`[Page] plant_id=${plant.id} (${plant.plant_type}) 写真なし`);
    }
  }

  // AI-generated today tasks (growth-stage based)
  const plantsForAdvisor = plants.map((p) => ({
    id: p.id,
    display_name: getPlantLabel(p.plant_type),
    species: p.species ?? null,
    started_at: p.started_at ?? null,
    planted_at: p.planted_at ?? null,
    memo: p.memo ?? null,
    location: p.location ?? null,
  }));

  let todayTasks: Awaited<ReturnType<typeof buildTodayTasksForPlants>> = [];
  try {
    todayTasks = await buildTodayTasksForPlants(plantsForAdvisor, today);
  } catch (err) {
    console.error("AI task generation error:", err);
  }

  // Badge record: derived from AI tasks (not care_events)
  const plantHasTodayEventRecord = Object.fromEntries(
    plants.map((plant) => [
      plant.id,
      todayTasks.some((t) => t.plant_id === plant.id),
    ])
  );

  const todayLineMessage = buildTodayLineMessage(today, todayTasks);
  const lineShareUrl = `https://line.me/R/msg/text/?${encodeURIComponent(todayLineMessage)}`;

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

        /* ─── Column heading ─── */
        .col-heading {
          font-size: 12px;
          font-weight: 700;
          color: #2d4a3e;
          margin: 0 0 14px;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          padding-left: 10px;
          border-left: 3px solid #6db07b;
          line-height: 1.4;
        }

        /* ─── Plants 2-col grid (equal columns) ─── */
        .plants-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          max-width: 560px;
          gap: 8px;
          margin-bottom: 12px;
        }
        @media (max-width: 480px) {
          .plants-grid { grid-template-columns: 1fr; max-width: none; }
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
            />
          </div>

          {/* ── Right column (1/3幅): 今日やること + LINE通知 縦積み ── */}
          <div className="col-right">
          {/* ── 今日やること ── */}
          <div className="col-board">
            <h2 className="col-heading">今日やること</h2>

            {todayTasks.length === 0 ? (
              <div className="empty-today-card">
                <p style={{ color: "#7a9a7a", margin: 0, fontSize: 14, lineHeight: 1.6 }}>
                  今日はゆっくり見守る日です 🌿
                </p>
              </div>
            ) : (
              todayTasks.map((pt) => (
                <div key={pt.plant_id} className="todo-card-active">
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#2d4a3e", marginBottom: 3 }}>
                    {pt.plant_name}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#a0a8a2",
                      marginBottom: 8,
                      letterSpacing: 0.3,
                    }}
                  >
                    {pt.growth_stage}
                  </div>
                  {pt.tasks.map((task, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 13,
                        color: "#374151",
                        lineHeight: 1.65,
                        marginBottom: i < pt.tasks.length - 1 ? 6 : 0,
                        paddingLeft: 12,
                        position: "relative",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "0.15em",
                          color: "#6db07b",
                          fontSize: 11,
                        }}
                      >
                        ✓
                      </span>
                      {task}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* ── LINE通知 ── */}
          <div className="col-board">
            <h2 className="col-heading">LINE通知</h2>

            <div className="line-card">
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#a0a8a2",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 10,
                }}
              >
                最新メッセージのプレビュー
              </div>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  color: "#2d4a3e",
                  lineHeight: 1.75,
                  padding: "12px 14px",
                  background: "#f2faf4",
                  borderRadius: 8,
                  border: "1px solid #c8e6cc",
                  marginBottom: 14,
                }}
              >
                {todayLineMessage}
              </div>
              <a
                href={lineShareUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-block",
                  padding: "9px 18px",
                  background: "#06c755",
                  color: "#ffffff",
                  textDecoration: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                LINEで開く
              </a>
              <div style={{ marginTop: 12, fontSize: 11, color: "#c8c0b4", letterSpacing: 0.2 }}>
                最終送信日時: —
              </div>
            </div>

            <div className="line-card" style={{ marginBottom: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#a0a8a2",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 14,
                }}
              >
                通知を受け取る
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div className="qr-placeholder">
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#93c9a0", letterSpacing: 0.5 }}>
                    QR
                  </span>
                </div>
                <div style={{ paddingTop: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#2d4a3e", marginBottom: 5 }}>
                    通知を受け取る
                  </div>
                  <p style={{ fontSize: 12, color: "#7a8a7a", margin: "0 0 10px", lineHeight: 1.65 }}>
                    Receive plant care notifications.
                  </p>
                  <div style={{ fontSize: 11, color: "#c8c0b4", lineHeight: 1.5 }}>
                    — LINE登録はこちら（準備中）
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>{/* /col-right */}
        </div>
      </main>
    </>
  );
}
