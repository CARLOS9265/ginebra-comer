"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export type PriceFormState = { error?: string } | null;

const ALLOWED_ROLES = ["compras", "comercial", "gerencia", "administrador"];

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function upsertDailyPrice(
  _prevState: PriceFormState,
  formData: FormData,
): Promise<PriceFormState> {
  const { profile } = await getCurrentUser();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: "Tu rol no puede cargar precios." };
  }

  const priceDate = String(formData.get("price_date") ?? "").trim();
  const gold = num(formData, "gold_usd_oz");
  const silver = num(formData, "silver_usd_oz");
  const lead = num(formData, "lead_usd_ton");
  const referencePct = num(formData, "reference_pct") ?? 40;

  if (!priceDate || gold == null || silver == null) {
    return { error: "Completá al menos la fecha, el oro y la plata." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("daily_metal_prices").upsert(
    {
      price_date: priceDate,
      gold_usd_oz: gold,
      silver_usd_oz: silver,
      lead_usd_ton: lead,
      reference_pct: referencePct,
      entered_by: profile.id,
    },
    { onConflict: "price_date" },
  );

  if (error) return { error: error.message };

  revalidatePath("/precios");
  revalidatePath("/lotes/nuevo");
  return null;
}
