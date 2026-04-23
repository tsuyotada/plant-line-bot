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

function getPlantLabel(plantType: string | null) {
  switch (plantType) {
    case "tomato":
      return "トマト";
    case "coriander":
      return "コリアンダー";
    default:
      return "植物";
  }
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

  const groupedTodayTasks = Array.from(
    new Set(todayEvents.map((e) => e.task_type))
  );

  const upcomingEvents = careEvents.filter(
    (event) => event.scheduled_for > today && event.status === "pending"
  );

  const todayLineMessage = buildTodayLineMessage(today, todayEvents, adviceMap);
  const lineShareUrl = `https://line.me/R/msg/text/?${encodeURIComponent(
    todayLineMessage
  )}`;

  return (
    <main
      style={{
        padding: 24,
        maxWidth: 820,
        margin: "0 auto",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        background: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 800,
            marginBottom: 8,
            color: "#111827",
          }}
        >
          plant-line-bot
        </h1>
        <p
          style={{
            color: "#6b7280",
            fontSize: 15,
            lineHeight: 1.6,
          }}
        >
          植物を登録して、お世話の予定を確認できます
        </p>
      </div>

      <section
        style={{
          marginBottom: 24,
          padding: 20,
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#ffffff",
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 16,
            color: "#111827",
          }}
        >
          植物を登録する
        </h2>

        <form action={addPlant}>
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 600,
                color: "#374151",
                marginBottom: 6,
              }}
            >
              植物
            </label>
            <select
              name="plant_type"
              defaultValue={enabledPlantOptions[0]?.plant_code ?? "tomato"}
              style={{
                width: "100%",
                maxWidth: 280,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: "#fff",
                fontSize: 15,
              }}
            >
              {enabledPlantOptions.map((plant) => (
                <option key={plant.plant_code} value={plant.plant_code}>
                  {plant.plant_name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 600,
                color: "#374151",
                marginBottom: 6,
              }}
            >
              植えた日
            </label>
            <input
              type="date"
              name="planted_at"
              defaultValue={today}
              style={{
                width: "100%",
                maxWidth: 280,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: "#fff",
                fontSize: 15,
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              padding: "12px 18px",
              backgroundColor: "#111827",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            植物を追加
          </button>
        </form>
      </section>

      <section
        style={{
          marginBottom: 24,
          padding: 20,
          border: "1px solid #bbf7d0",
          borderRadius: 16,
          background: "#ecfdf5",
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 16,
            color: "#166534",
          }}
        >
          LINEに送る文章
        </h2>

        <div
          style={{
            whiteSpace: "pre-wrap",
            padding: 16,
            borderRadius: 12,
            background: "#ffffff",
            border: "1px solid #dcfce7",
            color: "#111827",
            lineHeight: 1.7,
            fontSize: 15,
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
            padding: "10px 14px",
            backgroundColor: "#16a34a",
            color: "#ffffff",
            textDecoration: "none",
            borderRadius: 10,
            fontWeight: 700,
          }}
        >
          LINEで開く
        </a>
      </section>

      <section
        style={{
          marginBottom: 24,
          padding: 20,
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#f0fdf4",
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 16,
            color: "#166534",
          }}
        >
          今日やること
        </h2>

        {todayEvents.length === 0 ? (
          <p style={{ color: "#4b5563", margin: 0 }}>今日は予定はありません</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {groupedTodayTasks.map((taskType, index) => {
              const advice = getAdviceText(adviceMap, taskType);

              return (
                <li
                  key={taskType}
                  style={{
                    padding: 16,
                    marginBottom: 12,
                    background: "#ffffff",
                    border: "1px solid #dcfce7",
                    borderRadius: 12,
                    listStyle: "none",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 16,
                      color: "#111827",
                      marginBottom: 6,
                    }}
                  >
                    {index + 1}. {advice.title}
                  </div>

                  <div
                    style={{
                      color: "#374151",
                      fontSize: 14,
                      marginBottom: 12,
                      lineHeight: 1.6,
                    }}
                  >
                    {advice.message}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {todayEvents
                      .filter((event) => event.task_type === taskType)
                      .map((event) => (
                        <div
                          key={event.id}
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <form action={completeCareEvent}>
                            <input type="hidden" name="event_id" value={event.id} />
                            <button
                              type="submit"
                              style={{
                                padding: "8px 12px",
                                backgroundColor: "#16a34a",
                                color: "#fff",
                                border: "none",
                                borderRadius: 8,
                                cursor: "pointer",
                                fontWeight: 700,
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
                                padding: "8px 12px",
                                backgroundColor: "#f59e0b",
                                color: "#fff",
                                border: "none",
                                borderRadius: 8,
                                cursor: "pointer",
                                fontWeight: 700,
                              }}
                            >
                              あとで
                            </button>
                          </form>
                        </div>
                      ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section
        style={{
          marginBottom: 24,
          padding: 20,
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#ffffff",
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 16,
            color: "#111827",
          }}
        >
          育てている植物
        </h2>

        {plantsError ? (
          <p style={{ color: "#b91c1c" }}>植物データの取得でエラーが出ました</p>
        ) : plants.length === 0 ? (
          <p style={{ color: "#4b5563" }}>まだ植物は登録されていません</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {plants.map((plant) => (
              <li
                key={plant.id}
                style={{
                  padding: 14,
                  marginBottom: 10,
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  background: "#fafafa",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    color: "#111827",
                    marginBottom: 4,
                  }}
                >
                  {getPlantLabel(plant.plant_type)}
                </div>
                <div style={{ color: "#6b7280", fontSize: 14 }}>
                  植えた日: {plant.planted_at}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        style={{
          padding: 20,
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#ffffff",
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 16,
            color: "#111827",
          }}
        >
          これからの予定
        </h2>

        {careEventsError ? (
          <p style={{ color: "#b91c1c" }}>予定データの取得でエラーが出ました</p>
        ) : upcomingEvents.length === 0 ? (
          <p style={{ color: "#4b5563" }}>今後の予定はありません</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {upcomingEvents.slice(0, 10).map((event) => {
              const advice = getAdviceText(adviceMap, event.task_type);

              return (
                <li
                  key={event.id}
                  style={{
                    padding: 14,
                    marginBottom: 10,
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    background: "#fafafa",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 16,
                      color: "#111827",
                      marginBottom: 4,
                    }}
                  >
                    {advice.title}
                  </div>

                  <div
                    style={{
                      color: "#374151",
                      fontSize: 14,
                      marginBottom: 6,
                      lineHeight: 1.6,
                    }}
                  >
                    {advice.message}
                  </div>

                  <div style={{ color: "#6b7280", fontSize: 14 }}>
                    予定日: {event.scheduled_for}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}