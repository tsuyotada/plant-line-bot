import { supabase } from "../src/lib/supabase";

const PLANTS_MASTER_URL =
  "https://opensheet.elk.sh/1XmNK_IFrsQfZ7D65ECBKLDHEHJ7VK9TTFCdwa7_mjrk/plants_master";

const CARE_RULES_URL =
  "https://opensheet.elk.sh/1XmNK_IFrsQfZ7D65ECBKLDHEHJ7VK9TTFCdwa7_mjrk/care_rules";

const ADVICE_MESSAGES_URL =
  "https://opensheet.elk.sh/1XmNK_IFrsQfZ7D65ECBKLDHEHJ7VK9TTFCdwa7_mjrk/advice_messages";

type PlantMasterRow = {
  plant_code: string;
  plant_name: string;
  enabled: string;
};

type CareRuleRow = {
  plant_code: string;
  event_code: string;
  days_after_planting: string;
  repeat_every_days: string;
  is_repeat: string;
  enabled: string;
};

type AdviceMessageRow = {
  event_code: string;
  title: string;
  message: string;
};

function addDays(dateString: string, days: number) {
  const d = new Date(dateString);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

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
  return plantType ? (plantLabelMap[plantType] ?? "植物") : "植物";
}

async function fetchPlantsMaster(): Promise<PlantMasterRow[]> {
  const res = await fetch(PLANTS_MASTER_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("plants_master の取得に失敗しました");
  return res.json();
}

async function fetchCareRules(): Promise<CareRuleRow[]> {
  const res = await fetch(CARE_RULES_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("care_rules の取得に失敗しました");
  return res.json();
}

async function fetchAdviceMessages(): Promise<AdviceMessageRow[]> {
  const res = await fetch(ADVICE_MESSAGES_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("advice_messages の取得に失敗しました");
  return res.json();
}

function buildAdviceMap(adviceMessages: AdviceMessageRow[]) {
  return new Map(
    adviceMessages.map((row) => [
      row.event_code,
      { title: row.title, message: row.message },
    ])
  );
}

function getAdviceText(
  adviceMap: Map<string, { title: string; message: string }>,
  taskType: string | null | undefined
) {
  const advice = adviceMap.get(taskType ?? "");
  if (!advice) {
    return { title: "植物のお世話", message: "植物のお世話をしましょう" };
  }
  return advice;
}

function isTrueLike(value: string | null | undefined) {
  return String(value).toLowerCase() === "true";
}

function toNumberOrNull(value: string | null | undefined) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function buildCareEventsFromRules(
  plantId: string,
  plantType: string,
  plantedAt: string,
  rules: CareRuleRow[]
) {
  const events: {
    plant_id: string;
    scheduled_for: string;
    status: string;
    task_type: string;
    rule_id?: string | null;
  }[] = [];

  const targetRules = rules.filter(
    (rule) => rule.plant_code === plantType && isTrueLike(rule.enabled)
  );

  for (const rule of targetRules) {
    const daysAfterPlanting = toNumberOrNull(rule.days_after_planting);
    const repeatEveryDays = toNumberOrNull(rule.repeat_every_days);
    const isRepeat = isTrueLike(rule.is_repeat);

    if (daysAfterPlanting == null) continue;

    if (!isRepeat) {
      events.push({
        plant_id: plantId,
        scheduled_for: addDays(plantedAt, daysAfterPlanting),
        status: "pending",
        task_type: rule.event_code,
        rule_id: null,
      });
      continue;
    }

    if (repeatEveryDays == null || repeatEveryDays <= 0) continue;

    for (let day = daysAfterPlanting; day <= 30; day += repeatEveryDays) {
      events.push({
        plant_id: plantId,
        scheduled_for: addDays(plantedAt, day),
        status: "pending",
        task_type: rule.event_code,
        rule_id: null,
      });
    }
  }

  return events;
}

function buildTodayLineMessage(
  today: string,
  todayEvents: any[],
  adviceMap: Map<string, { title: string; message: string }>
) {
  if (todayEvents.length === 0) {
    return `【${today} のお世話メモ】\n今日はお世話の予定はありません🌱`;
  }

  const uniqueTaskTypes = Array.from(
    new Set(todayEvents.map((e) => e.task_type))
  );

  const lines = uniqueTaskTypes.map((taskType, index) => {
    const advice = getAdviceText(adviceMap, taskType);
    return `${index + 1}. ${advice.title}`;
  });

  return `【${today} の今日やること】\n${lines.join("\n")}\n\n無理のない範囲で進めましょう🌱`;
}

async function addPlant(formData: FormData) {
  "use server";

  const plantType = String(formData.get("plant_type") || "");
  const plantedAt = String(formData.get("planted_at") || "");

  if (!plantType || !plantedAt) return;

  const { data: plant, error: plantError } = await supabase
    .from("plants")
    .insert([{ plant_type: plantType, planted_at: plantedAt }])
    .select()
    .single();

  if (plantError || !plant) {
    console.error("plants insert error:", plantError);
    return;
  }

  const careRules = await fetchCareRules();
  const events = buildCareEventsFromRules(plant.id, plantType, plantedAt, careRules);

  if (events.length > 0) {
    const { error: eventError } = await supabase.from("care_events").insert(events);
    if (eventError) {
      console.error("care_events insert error:", eventError);
    }
  }
}

async function completeCareEvent(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "");
  if (!eventId) return;

  const { error } = await supabase
    .from("care_events")
    .update({ status: "done" })
    .eq("id", eventId);

  if (error) {
    console.error("complete care event error:", error);
  }
}

async function snoozeCareEvent(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "");
  const scheduledFor = String(formData.get("scheduled_for") || "");

  if (!eventId || !scheduledFor) return;

  const nextDate = addDays(scheduledFor, 1);

  const { error } = await supabase
    .from("care_events")
    .update({ scheduled_for: nextDate })
    .eq("id", eventId);

  if (error) {
    console.error("snooze care event error:", error);
  }
}

export default async function Home() {
  const plantsMaster = await fetchPlantsMaster();

  const enabledPlantOptions = plantsMaster.filter(
    (plant) => String(plant.enabled).toLowerCase() === "true"
  );

  const adviceMessages = await fetchAdviceMessages();
  const adviceMap = buildAdviceMap(adviceMessages);

  const today = todayString();

  const { data: plantsRaw, error: plantsError } = await supabase
    .from("plants")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: careEventsRaw, error: careEventsError } = await supabase
    .from("care_events")
    .select("*")
    .order("scheduled_for", { ascending: true });

  const plants = plantsRaw ?? [];
  const careEvents = careEventsRaw ?? [];

  const plantMap = new Map(plants.map((plant) => [plant.id, plant]));

  const todayEvents = careEvents.filter(
    (event) => event.scheduled_for === today && event.status === "pending"
  );

  const upcomingEvents = careEvents.filter(
    (event) => event.scheduled_for > today && event.status === "pending"
  );

  const plantHasTodayEvent = new Map<string, boolean>(
    plants.map((plant) => [
      plant.id,
      todayEvents.some((e) => e.plant_id === plant.id),
    ])
  );

  const todayLineMessage = buildTodayLineMessage(today, todayEvents, adviceMap);
  const lineShareUrl = `https://line.me/R/msg/text/?${encodeURIComponent(todayLineMessage)}`;

  const fontFamily =
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  return (
    <>
      <style>{`
        /* ─────────────────────────────────────────
           Background
           Replace background-image URL to swap photo.
           e.g. url('https://images.unsplash.com/photo-XXXXX?auto=format&fit=crop&w=1920&q=80')
        ───────────────────────────────────────── */
        .app-bg {
          position: fixed;
          inset: 0;
          z-index: -1;
          background: linear-gradient(160deg, #c8dfc4 0%, #a3c4a0 45%, #7aaa78 100%);
          /* background-image: url('YOUR_PLANT_PHOTO_URL_HERE'); */
          background-size: cover;
          background-position: center;
        }
        .app-bg-overlay {
          position: absolute;
          inset: 0;
          background: rgba(242, 249, 244, 0.91);
        }

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

        /* ─── Column panel (frosted glass) ─── */
        .col-board {
          background: rgba(255, 255, 255, 0.76);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.88);
          border-radius: 14px;
          padding: 18px;
          box-shadow: 0 2px 14px rgba(30, 60, 40, 0.08);
        }

        /* ─── Column heading ─── */
        .col-heading {
          font-size: 13px;
          font-weight: 700;
          color: #1a3d2b;
          margin: 0 0 16px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          padding-left: 10px;
          border-left: 3px solid #4ade80;
          line-height: 1.4;
        }

        /* ─── Plants 2-col grid ─── */
        .plants-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
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
          box-shadow: 0 1px 4px rgba(30, 60, 40, 0.08);
          transition: box-shadow 0.15s;
        }
        .plant-card:hover {
          box-shadow: 0 3px 10px rgba(30, 60, 40, 0.13);
        }
        .plant-photo-area {
          height: 72px;
          background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 55%, #6ee7b7 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .plant-photo-label {
          font-size: 10px;
          font-weight: 600;
          color: rgba(110, 231, 183, 0.9);
          letter-spacing: 1px;
          text-transform: uppercase;
          user-select: none;
        }
        .plant-info {
          padding: 10px 11px 12px;
        }

        /* ─── Generic cards ─── */
        .todo-card,
        .upcoming-card,
        .form-card,
        .line-card {
          background: #ffffff;
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 8px;
          box-shadow: 0 1px 4px rgba(30, 60, 40, 0.07);
        }

        /* ─── Sub-section label ─── */
        .sub-heading {
          font-size: 11px;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin: 20px 0 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid #e5e7eb;
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
          background: #dcfce7;
          color: #166534;
        }

        /* ─── Date input ─── */
        .date-input {
          width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          font-size: 14px;
          box-sizing: border-box;
          font-family: inherit;
        }

        /* ─── Select ─── */
        .plant-select {
          width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          font-size: 14px;
          font-family: inherit;
          cursor: pointer;
        }

        /* ─── QR placeholder ─── */
        .qr-placeholder {
          width: 88px;
          height: 88px;
          background: #f0fdf4;
          border: 2px dashed #86efac;
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
      `}</style>

      {/* Fixed background layer */}
      <div className="app-bg">
        <div className="app-bg-overlay" />
      </div>

      <main
        style={{
          minHeight: "100vh",
          padding: "32px 20px 40px",
          fontFamily,
        }}
      >
        {/* ── Header ── */}
        <header
          style={{
            maxWidth: 1440,
            margin: "0 auto 26px",
            padding: "0 4px",
          }}
        >
          <h1
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: "#1a3d2b",
              margin: 0,
              letterSpacing: -0.8,
              lineHeight: 1.15,
            }}
          >
            Green Care
          </h1>
          <p
            style={{
              color: "#4b7a5a",
              fontSize: 13,
              margin: "6px 0 0",
              fontWeight: 400,
              letterSpacing: 0.15,
            }}
          >
            Keep every balcony plant healthy.
          </p>
        </header>

        {/* ── Board ── */}
        <div
          className="board-grid"
          style={{ maxWidth: 1440, margin: "0 auto" }}
        >
          {/* ════════════════════════════════
              Column 1 — 育てている植物
          ════════════════════════════════ */}
          <div className="col-board">
            <h2 className="col-heading">育てている植物</h2>

            {/* Plant card grid */}
            {plantsError ? (
              <div className="todo-card">
                <p style={{ color: "#b91c1c", margin: 0, fontSize: 13 }}>
                  植物データの取得でエラーが出ました
                </p>
              </div>
            ) : plants.length === 0 ? (
              <div className="todo-card">
                <p style={{ color: "#6b7280", margin: 0, fontSize: 13 }}>
                  まだ植物は登録されていません
                </p>
              </div>
            ) : (
              <div className="plants-grid">
                {plants.map((plant) => {
                  const hasTodayEvent =
                    plantHasTodayEvent.get(plant.id) ?? false;
                  return (
                    <div key={plant.id} className="plant-card">
                      {/* Photo area — replace with <img> when photo upload is ready */}
                      <div className="plant-photo-area">
                        <span className="plant-photo-label">photo</span>
                      </div>

                      <div className="plant-info">
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: "#1a3d2b",
                            marginBottom: 3,
                            lineHeight: 1.3,
                          }}
                        >
                          {getPlantLabel(plant.plant_type)}
                        </div>
                        <div
                          style={{
                            color: "#9ca3af",
                            fontSize: 11,
                            marginBottom: 8,
                          }}
                        >
                          {plant.planted_at}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span
                            className={
                              hasTodayEvent ? "badge-alert" : "badge-ok"
                            }
                          >
                            {hasTodayEvent ? "要対応" : "良好"}
                          </span>
                          {/* Operations — reserved for edit / delete / photo upload */}
                          <span
                            style={{
                              fontSize: 15,
                              color: "#d1d5db",
                              cursor: "default",
                              letterSpacing: 1,
                              userSelect: "none",
                            }}
                          >
                            ···
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add plant form */}
            <div className="form-card" style={{ marginBottom: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#1a3d2b",
                  marginBottom: 12,
                  letterSpacing: 0.3,
                }}
              >
                植物を追加する
              </div>
              <form action={addPlant}>
                <div style={{ marginBottom: 10 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#6b7280",
                      marginBottom: 4,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    植物
                  </label>
                  <select
                    name="plant_type"
                    defaultValue={
                      enabledPlantOptions[0]?.plant_code ?? "tomato"
                    }
                    className="plant-select"
                  >
                    {enabledPlantOptions.map((plant) => (
                      <option key={plant.plant_code} value={plant.plant_code}>
                        {plant.plant_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#6b7280",
                      marginBottom: 4,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    植えた日
                  </label>
                  <input
                    type="date"
                    name="planted_at"
                    defaultValue={today}
                    className="date-input"
                  />
                </div>
                <button
                  type="submit"
                  className="btn"
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    background: "#2d6a4f",
                    color: "#fff",
                    fontSize: 14,
                  }}
                >
                  追加する
                </button>
              </form>
            </div>
          </div>

          {/* ════════════════════════════════
              Column 2 — 今日やること
          ════════════════════════════════ */}
          <div className="col-board">
            <h2 className="col-heading">今日やること</h2>

            {/* Today event cards */}
            {todayEvents.length === 0 ? (
              <div className="todo-card">
                <p style={{ color: "#6b7280", margin: 0, fontSize: 13 }}>
                  今日のお世話の予定はありません
                </p>
              </div>
            ) : (
              todayEvents.map((event) => {
                const advice = getAdviceText(adviceMap, event.task_type);
                const plant = plantMap.get(event.plant_id);
                const plantName = getPlantLabel(plant?.plant_type);
                return (
                  <div key={event.id} className="todo-card">
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: "#1a3d2b",
                        marginBottom: 5,
                      }}
                    >
                      {advice.title}
                    </div>
                    <div
                      style={{
                        color: "#374151",
                        fontSize: 13,
                        lineHeight: 1.65,
                        marginBottom: 7,
                      }}
                    >
                      {advice.message}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#9ca3af",
                        marginBottom: 11,
                      }}
                    >
                      対象: {plantName}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <form action={completeCareEvent}>
                        <input
                          type="hidden"
                          name="event_id"
                          value={event.id}
                        />
                        <button
                          type="submit"
                          className="btn"
                          style={{
                            padding: "6px 14px",
                            background: "#16a34a",
                            color: "#fff",
                            fontSize: 13,
                          }}
                        >
                          やった
                        </button>
                      </form>
                      <form action={snoozeCareEvent}>
                        <input
                          type="hidden"
                          name="event_id"
                          value={event.id}
                        />
                        <input
                          type="hidden"
                          name="scheduled_for"
                          value={event.scheduled_for}
                        />
                        <button
                          type="submit"
                          className="btn"
                          style={{
                            padding: "6px 14px",
                            background: "#f59e0b",
                            color: "#fff",
                            fontSize: 13,
                          }}
                        >
                          あとで
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })
            )}

            {/* Upcoming events */}
            <div className="sub-heading">これからの予定</div>

            {careEventsError ? (
              <div className="upcoming-card">
                <p style={{ color: "#b91c1c", margin: 0, fontSize: 13 }}>
                  予定データの取得でエラーが出ました
                </p>
              </div>
            ) : upcomingEvents.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>
                今後の予定はありません
              </p>
            ) : (
              <>
                {upcomingEvents.slice(0, 5).map((event) => {
                  const advice = getAdviceText(adviceMap, event.task_type);
                  const plant = plantMap.get(event.plant_id);
                  const plantName = getPlantLabel(plant?.plant_type);
                  return (
                    <div key={event.id} className="upcoming-card">
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: "#374151",
                          marginBottom: 2,
                        }}
                      >
                        {advice.title}
                      </div>
                      <div
                        style={{
                          color: "#9ca3af",
                          fontSize: 11,
                          marginBottom: 1,
                        }}
                      >
                        対象: {plantName}
                      </div>
                      <div style={{ color: "#d1d5db", fontSize: 11 }}>
                        {event.scheduled_for}
                      </div>
                    </div>
                  );
                })}
                {upcomingEvents.length > 5 && (
                  <button
                    type="button"
                    className="btn"
                    style={{
                      width: "100%",
                      padding: "8px",
                      background: "transparent",
                      border: "1px solid #e5e7eb",
                      fontSize: 13,
                      color: "#9ca3af",
                      fontWeight: 500,
                      marginTop: 4,
                    }}
                  >
                    View More ({upcomingEvents.length - 5} 件)
                  </button>
                )}
              </>
            )}
          </div>

          {/* ════════════════════════════════
              Column 3 — LINE通知
          ════════════════════════════════ */}
          <div className="col-board">
            <h2 className="col-heading">LINE通知</h2>

            {/* Message preview */}
            <div className="line-card">
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#9ca3af",
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
                  color: "#1a3d2b",
                  lineHeight: 1.75,
                  padding: "12px 14px",
                  background: "#f0fdf4",
                  borderRadius: 8,
                  border: "1px solid #d1fae5",
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
              {/* Last sent timestamp — populated when history feature is added */}
              <div
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  color: "#d1d5db",
                  letterSpacing: 0.2,
                }}
              >
                最終送信日時: —
              </div>
            </div>

            {/* QR / family join section */}
            <div className="line-card" style={{ marginBottom: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#9ca3af",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 14,
                }}
              >
                LINEで受け取る
              </div>
              <div
                style={{ display: "flex", gap: 14, alignItems: "flex-start" }}
              >
                {/* QR placeholder — swap with <QRCode> component when ready */}
                <div className="qr-placeholder">
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#86efac",
                      letterSpacing: 0.5,
                    }}
                  >
                    QR
                  </span>
                </div>
                <div style={{ paddingTop: 2 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#1a3d2b",
                      marginBottom: 5,
                    }}
                  >
                    家族と共有する
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                      margin: 0,
                      lineHeight: 1.65,
                    }}
                  >
                    Family members can join later.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
