import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const SHEET_URL =
    "https://docs.google.com/spreadsheets/d/1XmNK_IFrsQfZ7D65ECBKLDHEHJ7VK9TTFCdwa7_mjrk";

  const fetchSheet = async (sheetName: string) => {
    const url = `${SHEET_URL}/gviz/tq?tqx=out:json&sheet=${sheetName}`;
    const res = await fetch(url);
    const text = await res.text();

    const json = JSON.parse(text.substring(47, text.length - 2));
    return json.table.rows.map((row: any) =>
      row.c.map((cell: any) => cell?.v ?? null)
    );
  };

  // plants_master
  const plants = await fetchSheet("plants_master");
  await supabase.from("plants_master").upsert(
    plants.map(([plant_code, plant_name, enabled]: any) => ({
      plant_code,
      plant_name,
      enabled,
    }))
  );

  // care_rules
  const rules = await fetchSheet("care_rules");
  await supabase.from("care_rules").upsert(
    rules.map(
      ([plant_code, event_code, days, repeat, is_repeat, enabled]: any) => ({
        plant_code,
        event_code,
        days_after_planting: days,
        repeat_every_days: repeat,
        is_repeat,
        enabled,
      })
    )
  );

  // advice_messages
  const advice = await fetchSheet("advice_messages");
  await supabase.from("advice_messages").upsert(
    advice.map(([event_code, title, message]: any) => ({
      event_code,
      title,
      message,
    }))
  );

  return NextResponse.json({ ok: true });
}