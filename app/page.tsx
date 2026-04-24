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
      {
        title: row.title,
        message: row.message,
      },
    ])
  );
}

function getAdviceText(
  adviceMap: Map<string, { title: string; message: string }>,
  taskType: string | null | undefined
) {
  const advice = adviceMap.get(taskType ?? "");

  if (!advice) {
    return {
      title: "植物のお世話",
      message: "植物のお世話をしましょう",
    };
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
    return `【${today} のお世話メモ】
今日はお世話の予定はありません🌱`;
  }

  const uniqueTaskTypes = Array.from(
    new Set(todayEvents.map((e) => e.task_type))
  );

  const lines = uniqueTaskTypes.map((taskType, index) => {
    const advice = getAdviceText(adviceMap, taskType);
    return `${index + 1}. ${advice.title}`;
  });

  return `【${today} の今日やること】
${lines.join("\n")}

無理のない範囲で進めましょう🌱`;
}

async function addPlant(formData: FormData) {
  "use server";

  const plantType = String(formData.get("plant_type") || "");
  const plantedAt = String(formData.get("planted_at") || "");

  if (!plantType || !plantedAt) return;

  const { data: plant, error: plantError } = await supabase
    .from("plants")
    .insert([
      {
        plant_type: plantType,
        planted_at: plantedAt,
      },
    ])
    .select()
    .single();

  if (plantError || !plant) {
    console.error("plants insert error:", plantError);
    return;
  }

  const careRules = await fetchCareRules();

  const events = buildCareEventsFromRules(
    plant.id,
    plantType,
    plantedAt,
    careRules
  );

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
  const lineShareUrl = `https://line.me/R/msg/text/?${encodeURIComponent(
    todayLineMessage
  )}`;

  const fontFamily =
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  return (
    <>
      <style>{`
        .board-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 960px) {
          .board-grid {
            grid-template-columns: 1fr;
          }
        }
        .plant-card,
        .todo-card,
        .upcoming-card {
          background: #ffffff;
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }
        .date-input {
          width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
          background: #fff;
          font-size: 14px;
          box-sizing: border-box;
        }
      `}</style>

      <main
        style={{
          background: "#dde3ea",
          minHeight: "100vh",
          padding: "20px 16px",
          fontFamily,
        }}
      >
        {/* Header */}
        <div style={{ maxWidth: 1440, margin: "0 auto 16px" }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#1e293b",
              margin: 0,
            }}
          >
            plant-line-bot
          </h1>
          <p style={{ color: "#64748b", fontSize: 14, margin: "4px 0 0" }}>
            植物を登録して、お世話の予定を確認できます
          </p>
        </div>

        {/* Board */}
        <div className="board-grid" style={{ maxWidth: 1440, margin: "0 auto" }}>

          {/* ── Column 1: 育てている植物 ── */}
          <div
            style={{
              background: "#ebecf0",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#172b4d",
                margin: "0 0 12px",
                letterSpacing: 0.3,
              }}
            >
              育てている植物
            </h2>

            {/* Plant cards */}
            {plantsError ? (
              <div className="plant-card">
                <p style={{ color: "#b91c1c", margin: 0, fontSize: 14 }}>
                  植物データの取得でエラーが出ました
                </p>
              </div>
            ) : plants.length === 0 ? (
              <div className="plant-card">
                <p style={{ color: "#64748b", margin: 0, fontSize: 14 }}>
                  まだ植物は登録されていません
                </p>
              </div>
            ) : (
              plants.map((plant) => {
                const hasTodayEvent = plantHasTodayEvent.get(plant.id) ?? false;
                return (
                  <div key={plant.id} className="plant-card">
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 15,
                        color: "#172b4d",
                        marginBottom: 4,
                      }}
                    >
                      {getPlantLabel(plant.plant_type)}
                    </div>
                    <div
                      style={{
                        color: "#64748b",
                        fontSize: 13,
                        marginBottom: 10,
                      }}
                    >
                      植えた日: {plant.planted_at}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          background: hasTodayEvent ? "#fef3c7" : "#dcfce7",
                          color: hasTodayEvent ? "#92400e" : "#166534",
                        }}
                      >
                        {hasTodayEvent ? "要対応" : "良好"}
                      </span>
                      {/* Operations area (reserved for future use) */}
                      <div style={{ fontSize: 18, color: "#cbd5e1", cursor: "default" }}>
                        ···
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Add plant form */}
            <div
              style={{
                marginTop: 12,
                background: "#ffffff",
                borderRadius: 10,
                padding: 14,
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#172b4d",
                  marginBottom: 12,
                }}
              >
                植物を追加する
              </div>
              <form action={addPlant}>
                <div style={{ marginBottom: 10 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#374151",
                      marginBottom: 4,
                    }}
                  >
                    植物
                  </label>
                  <select
                    name="plant_type"
                    defaultValue={enabledPlantOptions[0]?.plant_code ?? "tomato"}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      background: "#fff",
                      fontSize: 14,
                    }}
                  >
                    {enabledPlantOptions.map((plant) => (
                      <option key={plant.plant_code} value={plant.plant_code}>
                        {plant.plant_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#374151",
                      marginBottom: 4,
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
                  style={{
                    width: "100%",
                    padding: "9px 16px",
                    background: "#0052cc",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  追加する
                </button>
              </form>
            </div>
          </div>

          {/* ── Column 2: 今日やること ── */}
          <div
            style={{
              background: "#ebecf0",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#172b4d",
                margin: "0 0 12px",
                letterSpacing: 0.3,
              }}
            >
              今日やること
            </h2>

            {/* Today event cards */}
            {todayEvents.length === 0 ? (
              <div className="todo-card">
                <p style={{ color: "#64748b", margin: 0, fontSize: 14 }}>
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
                        fontSize: 15,
                        color: "#172b4d",
                        marginBottom: 4,
                      }}
                    >
                      {advice.title}
                    </div>
                    <div
                      style={{
                        color: "#374151",
                        fontSize: 13,
                        lineHeight: 1.6,
                        marginBottom: 6,
                      }}
                    >
                      {advice.message}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#64748b",
                        marginBottom: 10,
                      }}
                    >
                      対象: {plantName}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <form action={completeCareEvent}>
                        <input type="hidden" name="event_id" value={event.id} />
                        <button
                          type="submit"
                          style={{
                            padding: "6px 12px",
                            background: "#16a34a",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          やった
                        </button>
                      </form>
                      <form action={snoozeCareEvent}>
                        <input type="hidden" name="event_id" value={event.id} />
                        <input
                          type="hidden"
                          name="scheduled_for"
                          value={event.scheduled_for}
                        />
                        <button
                          type="submit"
                          style={{
                            padding: "6px 12px",
                            background: "#f59e0b",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontWeight: 700,
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
            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#172b4d",
                  marginBottom: 10,
                  paddingBottom: 6,
                  borderBottom: "2px solid #d1d5db",
                }}
              >
                これからの予定
              </div>
              {careEventsError ? (
                <div className="upcoming-card">
                  <p style={{ color: "#b91c1c", margin: 0, fontSize: 13 }}>
                    予定データの取得でエラーが出ました
                  </p>
                </div>
              ) : upcomingEvents.length === 0 ? (
                <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
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
                            color: "#172b4d",
                            marginBottom: 2,
                          }}
                        >
                          {advice.title}
                        </div>
                        <div style={{ color: "#64748b", fontSize: 12, marginBottom: 2 }}>
                          対象: {plantName}
                        </div>
                        <div style={{ color: "#94a3b8", fontSize: 12 }}>
                          {event.scheduled_for}
                        </div>
                      </div>
                    );
                  })}
                  {upcomingEvents.length > 5 && (
                    <button
                      type="button"
                      style={{
                        width: "100%",
                        padding: "8px",
                        background: "transparent",
                        border: "1px solid #94a3b8",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 13,
                        color: "#475569",
                        marginTop: 4,
                        fontFamily,
                      }}
                    >
                      View More ({upcomingEvents.length - 5} 件)
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Column 3: LINE通知 ── */}
          <div
            style={{
              background: "#ebecf0",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#172b4d",
                margin: "0 0 12px",
                letterSpacing: 0.3,
              }}
            >
              LINE通知
            </h2>

            {/* Message preview card */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: 10,
                padding: 14,
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  marginBottom: 10,
                }}
              >
                最新メッセージのプレビュー
              </div>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 14,
                  color: "#172b4d",
                  lineHeight: 1.7,
                  padding: "12px",
                  background: "#f8fafc",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
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
                  padding: "9px 16px",
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
            </div>

            {/* Last sent placeholder */}
            <div
              style={{
                padding: "10px 14px",
                background: "#f1f5f9",
                borderRadius: 8,
                fontSize: 13,
                color: "#94a3b8",
              }}
            >
              最終送信日時: —
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
