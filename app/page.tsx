import { supabaseServer as supabase } from "../src/lib/supabase-server";
import { getAuthedHouseholdId, createSupabaseServerClient } from "../src/lib/supabase-ssr";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BackgroundLayer } from "./BackgroundLayer";
import { AppHeader } from "./AppHeader";
import { PlantColumn } from "./PlantColumn";
import { fetchHouseholdData, todayStringJst, getPlantLabel } from "@/lib/fetchHouseholdData";
import { ShareLinkCard } from "./ShareLinkCard";
import { LineJoinCard } from "./LineJoinCard";

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

  const householdId = await getAuthedHouseholdId();
  if (!householdId) return;

  const today = todayStringJst();

  const { data: plant, error: plantError } = await supabase
    .from("plants")
    .insert({
      plant_type: name,
      planted_at: startedAt ?? today,
      started_at: startedAt || null,
      species,
      location,
      memo,
      household_id: householdId,
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
  const householdId = await getAuthedHouseholdId();
  if (!householdId) return;
  await supabase
    .from("plants")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", plantId)
    .eq("household_id", householdId);
  revalidatePath("/");
}

async function restorePlant(formData: FormData) {
  "use server";
  const plantId = String(formData.get("plant_id") || "");
  if (!plantId) return;
  const householdId = await getAuthedHouseholdId();
  if (!householdId) return;
  await supabase
    .from("plants")
    .update({ archived_at: null })
    .eq("id", plantId)
    .eq("household_id", householdId);
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

    const householdId = await getAuthedHouseholdId();
    if (!householdId) return { success: false, error: "認証エラーです。再ログインしてください。" };

    // Verify the plant belongs to this household
    const { data: plant } = await supabase
      .from("plants")
      .select("id")
      .eq("id", plantId)
      .eq("household_id", householdId)
      .single();
    if (!plant) return { success: false, error: "植物が見つかりません。" };

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
  const householdId = await getAuthedHouseholdId();
  if (!householdId) return;
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("plants")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("household_id", householdId)
    )
  );
  revalidatePath("/");
}

// ── Setup action ──────────────────────────────────────────────────────────────

async function deletePhoto(formData: FormData): Promise<void> {
  "use server";
  const photoId = String(formData.get("photo_id") || "");
  if (!photoId) return;

  const householdId = await getAuthedHouseholdId();
  if (!householdId) return;

  // Verify photo belongs to this household, and fetch storage_path from DB
  const { data: photo } = await supabase
    .from("plant_photos")
    .select("id, storage_path, plants!inner(household_id)")
    .eq("id", photoId)
    .eq("plants.household_id", householdId)
    .single();
  if (!photo) return;

  const { error: dbError } = await supabase.from("plant_photos").delete().eq("id", photoId);
  if (dbError) { console.error("deletePhoto DB削除失敗:", dbError.message); return; }

  const storagePath = (photo as any).storage_path as string | null;
  if (storagePath) {
    const { error: storageError } = await supabase.storage.from("plant-photos").remove([storagePath]);
    if (storageError) console.warn("deletePhoto Storage削除失敗:", storageError.message);
  }
  revalidatePath("/");
}

async function createHousehold(formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  if (!name) {
    redirect("/?setup_error=1");
    return;
  }

  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    redirect("/login");
    return;
  }

  const { error } = await supabase
    .from("households")
    .insert({ owner_id: user.id, name });

  if (error) console.error("createHousehold error:", error);

  redirect("/");
}

// ── Share link actions ─────────────────────────────────────────────────────────

async function createShareLink(): Promise<string | null> {
  "use server";
  const householdId = await getAuthedHouseholdId();
  if (!householdId) return null;

  const token = crypto.randomUUID();
  const { error } = await supabase.from("household_share_links").insert({
    household_id: householdId,
    token,
    enabled: true,
  });
  if (error) {
    console.error("createShareLink error:", error);
    return null;
  }
  revalidatePath("/");
  return token;
}

async function revokeShareLink(formData: FormData): Promise<void> {
  "use server";
  const householdId = await getAuthedHouseholdId();
  if (!householdId) return;
  const linkId = String(formData.get("link_id") || "");
  if (!linkId) return;
  await supabase
    .from("household_share_links")
    .update({ enabled: false })
    .eq("id", linkId)
    .eq("household_id", householdId);
  revalidatePath("/");
}

async function regenerateShareLink(formData: FormData): Promise<string | null> {
  "use server";
  const householdId = await getAuthedHouseholdId();
  if (!householdId) return null;
  const linkId = String(formData.get("link_id") || "");
  if (!linkId) return null;

  const newToken = crypto.randomUUID();
  const { error } = await supabase
    .from("household_share_links")
    .update({ token: newToken, enabled: true })
    .eq("id", linkId)
    .eq("household_id", householdId);
  if (error) {
    console.error("regenerateShareLink error:", error);
    return null;
  }
  revalidatePath("/");
  return newToken;
}

const JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateJoinCode(): string {
  return Array.from({ length: 6 }, () =>
    JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)]
  ).join("");
}

async function createJoinCode(): Promise<string | null> {
  "use server";
  const householdId = await getAuthedHouseholdId();
  if (!householdId) return null;

  for (let i = 0; i < 5; i++) {
    const code = generateJoinCode();
    const { error } = await supabase
      .from("household_line_join_codes")
      .insert({ household_id: householdId, code, enabled: true });
    if (!error) { revalidatePath("/"); return code; }
    if (!error.message?.includes("unique")) break;
  }
  console.error("createJoinCode: unique constraint exceeded");
  return null;
}

async function revokeJoinCode(): Promise<void> {
  "use server";
  const householdId = await getAuthedHouseholdId();
  if (!householdId) return;
  await supabase
    .from("household_line_join_codes")
    .update({ enabled: false })
    .eq("household_id", householdId)
    .eq("enabled", true);
  revalidatePath("/");
}

async function regenerateJoinCode(): Promise<string | null> {
  "use server";
  const householdId = await getAuthedHouseholdId();
  if (!householdId) return null;

  await supabase
    .from("household_line_join_codes")
    .update({ enabled: false })
    .eq("household_id", householdId)
    .eq("enabled", true);

  for (let i = 0; i < 5; i++) {
    const code = generateJoinCode();
    const { error } = await supabase
      .from("household_line_join_codes")
      .insert({ household_id: householdId, code, enabled: true });
    if (!error) { revalidatePath("/"); return code; }
    if (!error.message?.includes("unique")) break;
  }
  console.error("regenerateJoinCode: unique constraint exceeded");
  return null;
}

// ── Auth actions ──────────────────────────────────────────────────────────────

async function signOut() {
  "use server";
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

async function updateHouseholdName(name: string): Promise<void> {
  "use server";
  const trimmed = name.trim();
  if (!trimmed) return;
  const householdId = await getAuthedHouseholdId();
  if (!householdId) return;
  await supabase
    .from("households")
    .update({ name: trimmed })
    .eq("id", householdId);
  revalidatePath("/");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ setup_error?: string }>;
}) {
  const pageStart = Date.now();

  const fontFamily =
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  // ── 未ログイン → 玄関ページ ────────────────────────────────────────────────
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!user) {
    return (
      <>
        <BackgroundLayer />
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily,
          }}
        >
          <div
            style={{
              background: "rgba(253, 250, 244, 0.96)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.95)",
              borderRadius: 20,
              padding: "48px 36px",
              maxWidth: 400,
              width: "100%",
              boxShadow: "0 4px 32px rgba(60,50,30,0.12)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 44, marginBottom: 14 }}>🌱</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a3320", margin: "0 0 10px", letterSpacing: -0.3 }}>
              My Garden
            </h1>
            <p style={{ fontSize: 14, color: "#4b6b5a", lineHeight: 1.75, margin: "0 0 28px" }}>
              わが家の植物ページを、家族で見守る。
            </p>
            <a
              href="/login"
              style={{
                display: "block",
                padding: "13px 0",
                background: "#4b7a5a",
                color: "#fff",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                textDecoration: "none",
                marginBottom: 20,
              }}
            >
              あなたのガーデンを開く
            </a>
            <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7, margin: 0 }}>
              家族から共有リンクを受け取った方は、
              <br />
              そのリンクから開けます。ログインは不要です。
            </p>
          </div>
        </main>
      </>
    );
  }

  // ── ログイン済み + household なし → セットアップ ──────────────────────────
  const { data: household } = await supabase
    .from("households")
    .select("id, name")
    .eq("owner_id", user.id)
    .single();

  if (!household) {
    const { setup_error } = await searchParams;
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%)",
          padding: "24px",
          fontFamily,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "40px 32px",
            maxWidth: 400,
            width: "100%",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#1f3a2a",
              margin: "0 0 10px",
            }}
          >
            家庭の植物ページを作りましょう
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#555",
              lineHeight: 1.6,
              margin: "0 0 24px",
            }}
          >
            家族みんなで植物を管理できるページを作ります。
            <br />
            ページ名を入力してはじめましょう。
          </p>
          <form action={createHousehold}>
            {setup_error && (
              <p
                style={{
                  fontSize: 13,
                  color: "#b91c1c",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  padding: "8px 12px",
                  margin: "0 0 14px",
                }}
              >
                ページ名を入力してください。
              </p>
            )}
            <input
              type="text"
              name="name"
              placeholder="例：田中家のガーデン"
              maxLength={50}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1.5px solid #d1e8d8",
                borderRadius: 10,
                fontSize: 15,
                outline: "none",
                boxSizing: "border-box",
                marginBottom: 14,
                fontFamily: "inherit",
              }}
            />
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "12px",
                background: "#4b7a5a",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              はじめる
            </button>
          </form>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "20px 0 0", lineHeight: 1.5 }}>
            ログイン中: {user.email}
          </p>
        </div>
      </main>
    );
  }

  const householdId = household.id;
  const householdName = household.name ?? "My Garden";

  const dbStart = Date.now();
  const [data, shareLinkResult, joinCodeResult] = await Promise.all([
    fetchHouseholdData(householdId),
    supabase
      .from("household_share_links")
      .select("id, token, enabled, created_at")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("household_line_join_codes")
      .select("code")
      .eq("household_id", householdId)
      .eq("enabled", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  console.log(`[Page] db queries ${Date.now() - dbStart}ms (plants=${data.plants.length} hasError=${data.hasError})`);

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
  } = data;

  const shareLink = shareLinkResult.data;
  const appBaseUrl = getAppBaseUrl();
  const shareUrl = shareLink?.enabled
    ? `${appBaseUrl}/share/${shareLink.token}`
    : null;
  const joinCode = joinCodeResult.data?.code ?? null;

  console.log(`[Page] total render ${Date.now() - pageStart}ms`);

  return (
    <>
      <style>{`
        /* ─── Board grid ─── */
        /* 1280px+: My plants (main) 2:1 Today's pick (sub) */
        /* minmax(0,Xfr) forces min=0 so columns are truly proportional */
        .board-grid {
          display: grid;
          grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }
        /* 768–1279px: strictly equal columns */
        @media (max-width: 1279px) {
          .board-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
        }
        /* <768px: single column */
        @media (max-width: 767px) {
          .board-grid { display: flex; flex-direction: column; }
        }

        /* ─── Grid span helpers ─── */
        .col-plants { grid-column: span 1; }
        .col-right {
          grid-column: span 1;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        /* ─── Today's pick image — contained on all sizes ─── */
        .spotlight-img {
          width: 100%;
          max-height: 260px;
          object-fit: cover;
          display: block;
        }
        @media (max-width: 767px) {
          .spotlight-img { max-height: 200px; }
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
        @media (max-width: 767px) {
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

        /* ─── Empty today card ─── */
        .empty-today-card {
          background: linear-gradient(135deg, #f2faf4 0%, #faf8f3 100%);
          border-radius: 10px;
          padding: 28px 16px;
          margin-bottom: 8px;
          text-align: center;
          border: 1px dashed #c8e6cc;
        }

      `}</style>

      <AppHeader
        mode="owner"
        householdName={householdName}
        updateNameAction={updateHouseholdName}
        signOutAction={signOut}
      />

      <main style={{ minHeight: "100vh", padding: "14px 20px 48px", fontFamily }}>
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
              deletePhotoAction={deletePhoto}
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
                  className="spotlight-img"
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
            let isFertilizerBatch = false;
            const targetPlants: typeof plantCareCards = (() => {
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
                    {line3 && <p style={{ margin: "0 0 8px", color: "#6b7280" }}>{line3}</p>}
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

          {/* ── サイドバー: 全体サマリー・共有リンク・LINE（モバイルでは植物カードの下） ── */}
          <div className="sidebar-section">

          {/* ── 全体サマリー ── */}
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
                    {(summaryStats.waterCount + summaryStats.fertilizerCount) >= 5 && (
                      <><br /><span style={{ color: "#6b7280" }}>対象が多めなので、まずはよく育っている植物や最近元気のない植物から確認しましょう。</span></>
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
                    <br /><span style={{ color: "#6b7280" }}>葉色・虫食い・土の乾き具合を軽く見ておくと安心です。</span>
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
                    <br /><span style={{ color: "#6b7280" }}>余力があれば、お世話のついでに1枚記録しておくと変化に気づきやすいです。</span>
                  </div>
                </div>
              )}

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

          {/* ── 家族共有リンク ── */}
          <ShareLinkCard
            shareUrl={shareUrl}
            linkId={shareLink?.id ?? null}
            createShareLinkAction={createShareLink}
            revokeShareLinkAction={revokeShareLink}
            regenerateShareLinkAction={regenerateShareLink}
          />

          {/* ── LINE 家族参加 ── */}
          <LineJoinCard
            code={joinCode}
            createJoinCodeAction={createJoinCode}
            revokeJoinCodeAction={revokeJoinCode}
            regenerateJoinCodeAction={regenerateJoinCode}
          />
          </div>{/* /sidebar-section */}
          </div>{/* /col-right */}
        </div>
      </main>
    </>
  );
}
