import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer as supabase } from "@/src/lib/supabase-server";
import { fetchHouseholdData, todayStringJst } from "@/lib/fetchHouseholdData";
import { BackgroundLayer } from "@/app/BackgroundLayer";
import { PlantColumn } from "@/app/PlantColumn";

async function verifyShareToken(token: string): Promise<string | null> {
  const { data } = await supabase
    .from("household_share_links")
    .select("household_id")
    .eq("token", token)
    .eq("enabled", true)
    .single();
  return data?.household_id ?? null;
}

function getAppBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const householdId = await verifyShareToken(token);
  if (!householdId) notFound();

  // ── Server Actions (token captured via closure) ───────────────────────────

  async function addPlant(formData: FormData): Promise<void> {
    "use server";
    const hid = await verifyShareToken(token);
    if (!hid) return;

    const name = String(formData.get("name") || "").trim();
    if (!name) return;
    const species = String(formData.get("species") || "").trim() || null;
    const location = String(formData.get("location") || "").trim() || null;
    const startedAt = String(formData.get("started_at") || "").trim() || null;
    const memo = String(formData.get("memo") || "").trim() || null;
    const photo = formData.get("photo") as File | null;

    const todayStr = todayStringJst();
    const { data: plant, error: plantError } = await supabase
      .from("plants")
      .insert({
        plant_type: name,
        planted_at: startedAt ?? todayStr,
        started_at: startedAt || null,
        species,
        location,
        memo,
        household_id: hid,
      })
      .select()
      .single();

    if (plantError || !plant) return;

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
        console.error("share:addPlant photo upload error:", err);
      }
    }

    try {
      const baseUrl = getAppBaseUrl();
      await fetch(`${baseUrl}/api/generate-care-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId: plant.id }),
        cache: "no-store",
      });
    } catch (err) {
      console.error("share:generate-care-rules fetch error:", err);
    }

    revalidatePath(`/share/${token}`);
  }

  async function archivePlant(formData: FormData): Promise<void> {
    "use server";
    const hid = await verifyShareToken(token);
    if (!hid) return;
    const plantId = String(formData.get("plant_id") || "");
    if (!plantId) return;
    await supabase
      .from("plants")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", plantId)
      .eq("household_id", hid);
    revalidatePath(`/share/${token}`);
  }

  async function restorePlant(formData: FormData): Promise<void> {
    "use server";
    const hid = await verifyShareToken(token);
    if (!hid) return;
    const plantId = String(formData.get("plant_id") || "");
    if (!plantId) return;
    await supabase
      .from("plants")
      .update({ archived_at: null })
      .eq("id", plantId)
      .eq("household_id", hid);
    revalidatePath(`/share/${token}`);
  }

  async function uploadPlantPhoto(
    formData: FormData
  ): Promise<{ success: boolean; error?: string }> {
    "use server";
    try {
      const hid = await verifyShareToken(token);
      if (!hid) return { success: false, error: "共有リンクが無効です。" };

      const plantId = String(formData.get("plant_id") || "");
      const file = formData.get("photo") as File | null;
      if (!plantId || !file || file.size === 0)
        return { success: false, error: "必要なデータが不足しています" };

      const { data: plant } = await supabase
        .from("plants")
        .select("id")
        .eq("id", plantId)
        .eq("household_id", hid)
        .single();
      if (!plant) return { success: false, error: "植物が見つかりません。" };

      const storagePath = `plants/${plantId}/${Date.now()}-${file.name}`;
      const bytes = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from("plant-photos")
        .upload(storagePath, bytes, { contentType: file.type || "image/jpeg" });
      if (uploadError)
        return { success: false, error: "アップロードに失敗しました。" };

      const { data: urlData } = supabase.storage
        .from("plant-photos")
        .getPublicUrl(storagePath);
      const { error: dbError } = await supabase.from("plant_photos").insert([{
        plant_id: plantId,
        image_url: urlData.publicUrl,
        storage_path: storagePath,
        taken_at: new Date().toISOString(),
      }]);
      if (dbError) return { success: false, error: "データの保存に失敗しました。" };

      revalidatePath(`/share/${token}`);
      return { success: true };
    } catch {
      return { success: false, error: "予期しないエラーが発生しました。" };
    }
  }

  async function reorderPlants(orderedIds: string[]): Promise<void> {
    "use server";
    const hid = await verifyShareToken(token);
    if (!hid) return;
    await Promise.all(
      orderedIds.map((id, index) =>
        supabase
          .from("plants")
          .update({ sort_order: index })
          .eq("id", id)
          .eq("household_id", hid)
      )
    );
    revalidatePath(`/share/${token}`);
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  const {
    plants,
    archivedPlants,
    today,
    latestPhotos,
    photoHistories,
    plantHasTodayEventRecord,
    careCardMap,
    plantCareCards,
    spotlightCard,
    spotlightTrivia,
    summaryStats,
    hasError,
  } = await fetchHouseholdData(householdId);

  const fontFamily =
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  return (
    <>
      <style>{`
        .board-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 18px;
          align-items: start;
        }
        @media (max-width: 960px) {
          .board-grid { grid-template-columns: 1fr; }
        }
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
        .col-board {
          background: rgba(253, 250, 244, 0.96);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.95);
          border-radius: 14px;
          padding: 18px;
          box-shadow: 0 2px 16px rgba(60, 50, 30, 0.10);
        }
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
        .empty-today-card {
          background: linear-gradient(135deg, #f2faf4 0%, #faf8f3 100%);
          border-radius: 10px;
          padding: 28px 16px;
          margin-bottom: 8px;
          text-align: center;
          border: 1px dashed #c8e6cc;
        }
      `}</style>

      <BackgroundLayer />

      <main style={{ minHeight: "100vh", padding: "14px 20px 48px", fontFamily }}>
        <div style={{ maxWidth: 1440, margin: "0 auto 14px" }}>
          <span style={{ fontSize: 12, color: "#8a9a8a", fontWeight: 500, letterSpacing: 0.2 }}>
            Plant Care — 共有ビュー
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
              hasError={hasError}
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

          {/* ── Right column ── */}
          <div className="col-right">
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

              {summaryStats.total > 0 && (() => {
                const { fertilizerCount, waterCount, observationCount } = summaryStats;
                const hasGrouped = fertilizerCount >= 2 || waterCount >= 2 || observationCount >= 2;

                let line1 = "";
                let line2 = "";
                let isFertilizerBatch = false;
                const targetPlants = (() => {
                  if (fertilizerCount >= 2) {
                    line1 = "そろそろ液肥を考えてもよさそうです";
                    line2 = "春から育っている植物や、実・葉を育てている植物を見てみましょう。";
                    isFertilizerBatch = true;
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
                        {shownPlants.length > 0 && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #f0ebe2", fontSize: 11, color: "#6b7280", lineHeight: 1.7 }}>
                            <span style={{ fontWeight: 600, color: "#4b7a5a" }}>{isFertilizerBatch ? "見てみるなら：" : "今日見る植物："}</span>
                            {shownPlants.map(c => c.plantName).join("・")}
                            {restCount > 0 && <span style={{ color: "#9ca3af" }}>{isFertilizerBatch ? " など" : ` ほか${restCount}件`}</span>}
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

            <div className="sidebar-section">
              {summaryStats.total > 0 && (
                <div className="col-board">
                  <h2 className="col-heading">Care summary</h2>

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
                      </div>
                    </div>
                  )}

                  {summaryStats.observationCount > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", margin: "0 0 4px 0" }}>
                        👀 見守りポイント
                      </p>
                      <div style={{ background: "#f0f9ff", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#374151", lineHeight: 1.75 }}>
                        <b>{summaryStats.observationCount}件</b>は通常の観察対象です。
                      </div>
                    </div>
                  )}

                  {summaryStats.photoCount > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", margin: "0 0 4px 0" }}>
                        📸 写真記録のおすすめ
                      </p>
                      <div style={{ background: "#faf5ff", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#374151", lineHeight: 1.75 }}>
                        <b>{summaryStats.photoCount}件</b>の植物がしばらく写真のない状態です。
                      </div>
                    </div>
                  )}

                  <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>
                    詳しくは各植物カードのケアメモを確認してください。
                  </p>
                </div>
              )}
            </div>{/* /sidebar-section */}
          </div>{/* /col-right */}
        </div>
      </main>
    </>
  );
}
