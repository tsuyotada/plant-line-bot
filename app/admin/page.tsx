import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/src/lib/supabase-ssr";
import { supabaseServer as supabase } from "@/src/lib/supabase-server";

const ff = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function fmt(dt: string | null | undefined): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function AdminPage() {
  // ── Access control ────────────────────────────────────────────────────────
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) redirect("/login");

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (!adminEmails.includes(user.email ?? "")) redirect("/");

  // ── Data fetch (all parallel) ─────────────────────────────────────────────
  const [
    { data: authUsersData },
    { data: households },
    { data: plants },
    { data: photos },
    { data: shareLinks },
    { data: joinCodes },
    { data: lineUsers },
  ] = await Promise.all([
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from("households").select("id, name, owner_id, created_at").order("created_at", { ascending: false }),
    supabase.from("plants").select("id, household_id, archived_at"),
    supabase.from("plant_photos").select("id, plant_id"),
    supabase.from("household_share_links").select("id, household_id, enabled"),
    supabase.from("household_line_join_codes").select("id, household_id, enabled"),
    supabase.from("line_notification_users").select("id, line_user_id, household_id, is_active, recipient_role, has_tested_notification"),
  ]);

  const emailMap = new Map<string, string>(
    (authUsersData?.users ?? []).map((u) => [u.id, u.email ?? ""])
  );

  const hh = households ?? [];
  const allPlants = plants ?? [];
  const allPhotos = photos ?? [];
  const allShareLinks = shareLinks ?? [];
  const allJoinCodes = joinCodes ?? [];
  const allLineUsers = lineUsers ?? [];

  // plant_id → household_id の逆引き
  const plantHhMap = new Map<string, string>(
    allPlants.map((p) => [p.id, p.household_id])
  );

  // household ごとの集計
  const plantCount = (hhId: string) =>
    allPlants.filter((p) => p.household_id === hhId && !p.archived_at).length;
  const photoCount = (hhId: string) =>
    allPhotos.filter((ph) => plantHhMap.get(ph.plant_id) === hhId).length;
  const lineCount = (hhId: string) =>
    allLineUsers.filter((u) => u.household_id === hhId && u.is_active).length;
  const hasShareLink = (hhId: string) =>
    allShareLinks.some((l) => l.household_id === hhId && l.enabled);
  const hasJoinCode = (hhId: string) =>
    allJoinCodes.some((c) => c.household_id === hhId && c.enabled);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const summary = {
    households: hh.length,
    plants: allPlants.filter((p) => !p.archived_at).length,
    photos: allPhotos.length,
    lineActive: allLineUsers.filter((u) => u.is_active).length,
    shareEnabled: allShareLinks.filter((l) => l.enabled).length,
    joinEnabled: allJoinCodes.filter((c) => c.enabled).length,
  };

  // ── Warnings ───────────────────────────────────────────────────────────────
  const nullOwnerHh = hh.filter((h) => !h.owner_id);
  const nullHhLineUsers = allLineUsers.filter((u) => !u.household_id);
  const noShareLinkHh = hh.filter((h) => !hasShareLink(h.id));

  return (
    <div style={{ minHeight: "100vh", background: "#f8f7f4", fontFamily: ff, padding: "32px 24px 64px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a3320", margin: "0 0 4px", letterSpacing: -0.4 }}>
                Plant Care Admin
              </h1>
              <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
                ログイン中: {user.email}
              </p>
            </div>
            <span style={{ fontSize: 11, background: "#dcf5e4", color: "#1a5c36", padding: "4px 10px", borderRadius: 20, fontWeight: 700 }}>
              読み取り専用
            </span>
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Households", value: summary.households },
            { label: "Plants (active)", value: summary.plants },
            { label: "Photos", value: summary.photos },
            { label: "LINE通知 (active)", value: summary.lineActive },
            { label: "共有リンク (有効)", value: summary.shareEnabled },
            { label: "参加コード (有効)", value: summary.joinEnabled },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "#fff", borderRadius: 10, padding: "14px 16px", boxShadow: "0 1px 4px rgba(60,50,30,0.08)", border: "1px solid rgba(200,190,170,0.20)" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1a3320", lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Warnings ── */}
        {(nullOwnerHh.length > 0 || nullHhLineUsers.length > 0 || noShareLinkHh.length > 0) && (
          <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "16px 18px", marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 10 }}>⚠️ 要確認</div>
            {nullOwnerHh.length > 0 && (
              <div style={{ fontSize: 12, color: "#92400e", marginBottom: 6 }}>
                • <b>owner_id が null の household</b>: {nullOwnerHh.length} 件
                （{nullOwnerHh.map((h) => h.name ?? h.id).join(", ")}）
              </div>
            )}
            {nullHhLineUsers.length > 0 && (
              <div style={{ fontSize: 12, color: "#92400e", marginBottom: 6 }}>
                • <b>household_id が null の LINE通知ユーザー</b>: {nullHhLineUsers.length} 件
              </div>
            )}
            {noShareLinkHh.length > 0 && (
              <div style={{ fontSize: 12, color: "#92400e" }}>
                • <b>有効な共有リンクのない household</b>: {noShareLinkHh.length} 件
                （{noShareLinkHh.map((h) => h.name ?? h.id).join(", ")}）
              </div>
            )}
          </div>
        )}

        {/* ── Household table ── */}
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(60,50,30,0.08)", border: "1px solid rgba(200,190,170,0.20)", overflow: "hidden", marginBottom: 28 }}>
          <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid #f0ebe2" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#1a3320" }}>Household 一覧</span>
            <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 8 }}>{hh.length} 件</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#fdfaf4" }}>
                  {["名前", "オーナーEmail", "作成日", "植物", "写真", "LINE通知", "共有リンク", "参加コード"].map((h) => (
                    <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontWeight: 700, color: "#6b7280", fontSize: 11, borderBottom: "1px solid #f0ebe2", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hh.map((h, i) => {
                  const email = h.owner_id ? (emailMap.get(h.owner_id) ?? "—") : "⚠️ null";
                  const shareLinkOk = hasShareLink(h.id);
                  const joinCodeOk = hasJoinCode(h.id);
                  return (
                    <tr key={h.id} style={{ borderBottom: i < hh.length - 1 ? "1px solid #f5f2ed" : "none", background: i % 2 === 1 ? "#fdfcfa" : "#fff" }}>
                      <td style={{ padding: "9px 14px", fontWeight: 600, color: "#2d4a3e", whiteSpace: "nowrap" }}>{h.name ?? "—"}</td>
                      <td style={{ padding: "9px 14px", color: email.startsWith("⚠️") ? "#b45309" : "#374151", whiteSpace: "nowrap" }}>{email}</td>
                      <td style={{ padding: "9px 14px", color: "#6b7280", whiteSpace: "nowrap" }}>{fmt(h.created_at)}</td>
                      <td style={{ padding: "9px 14px", color: "#374151", textAlign: "center" }}>{plantCount(h.id)}</td>
                      <td style={{ padding: "9px 14px", color: "#374151", textAlign: "center" }}>{photoCount(h.id)}</td>
                      <td style={{ padding: "9px 14px", color: "#374151", textAlign: "center" }}>{lineCount(h.id)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: shareLinkOk ? "#1a5c36" : "#9ca3af", background: shareLinkOk ? "#dcf5e4" : "#f3f4f6", padding: "2px 7px", borderRadius: 10 }}>
                          {shareLinkOk ? "有効" : "なし"}
                        </span>
                      </td>
                      <td style={{ padding: "9px 14px", textAlign: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: joinCodeOk ? "#1a5c36" : "#9ca3af", background: joinCodeOk ? "#dcf5e4" : "#f3f4f6", padding: "2px 7px", borderRadius: 10 }}>
                          {joinCodeOk ? "有効" : "なし"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── LINE notification users ── */}
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(60,50,30,0.08)", border: "1px solid rgba(200,190,170,0.20)", overflow: "hidden", marginBottom: 28 }}>
          <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid #f0ebe2" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#1a3320" }}>LINE通知ユーザー</span>
            <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 8 }}>{allLineUsers.length} 件</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#fdfaf4" }}>
                  {["LINE User ID (末尾8桁)", "Household", "role", "通知", "テスト済み"].map((h) => (
                    <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontWeight: 700, color: "#6b7280", fontSize: 11, borderBottom: "1px solid #f0ebe2", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allLineUsers.map((u, i) => {
                  const hhName = hh.find((h) => h.id === u.household_id)?.name ?? (u.household_id ? u.household_id.slice(0, 8) + "…" : "⚠️ null");
                  return (
                    <tr key={u.id} style={{ borderBottom: i < allLineUsers.length - 1 ? "1px solid #f5f2ed" : "none", background: i % 2 === 1 ? "#fdfcfa" : "#fff" }}>
                      <td style={{ padding: "9px 14px", color: "#374151", fontFamily: "monospace" }}>…{u.line_user_id.slice(-8)}</td>
                      <td style={{ padding: "9px 14px", color: u.household_id ? "#374151" : "#b45309", fontWeight: u.household_id ? 400 : 600 }}>{hhName}</td>
                      <td style={{ padding: "9px 14px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: u.recipient_role === "owner" ? "#1e40af" : "#6b7280", background: u.recipient_role === "owner" ? "#dbeafe" : "#f3f4f6", padding: "2px 7px", borderRadius: 10 }}>
                          {u.recipient_role ?? "family"}
                        </span>
                      </td>
                      <td style={{ padding: "9px 14px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: u.is_active ? "#1a5c36" : "#9ca3af", background: u.is_active ? "#dcf5e4" : "#f3f4f6", padding: "2px 7px", borderRadius: 10 }}>
                          {u.is_active ? "ON" : "OFF"}
                        </span>
                      </td>
                      <td style={{ padding: "9px 14px", color: "#6b7280", textAlign: "center" }}>
                        {u.has_tested_notification ? "✓" : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Footer ── */}
        <p style={{ fontSize: 11, color: "#c4b89a", textAlign: "center", margin: 0 }}>
          Plant Care Admin · 読み取り専用 · データの編集・削除はこの画面からは行えません
        </p>

      </div>
    </div>
  );
}
