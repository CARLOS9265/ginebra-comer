import { createClient } from "@/lib/supabase/server";
import { monthRange, parseMonthParam } from "@/lib/calendar";
import { CalendarView } from "./CalendarView";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const { year, month } = parseMonthParam(monthParam);
  const { start, end } = monthRange(year, month);

  const supabase = await createClient();
  const [{ data: schedule }, { data: providers }] = await Promise.all([
    supabase
      .from("truck_schedule")
      .select(
        "id, type, scheduled_date, scheduled_time, status, destination, estimated_big_bags, truck_plate, carrier_name, notes, providers(name, code)",
      )
      .gte("scheduled_date", start)
      .lte("scheduled_date", end)
      .order("scheduled_time", { ascending: true, nullsFirst: false }),
    supabase.from("providers").select("id, code, name").order("name"),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Programación de volquetes</h1>
      <p className="mt-1 text-sm text-slate-500">
        Llegadas de mina para compra y despachos hacia Lima (venta a PY).
      </p>

      <div className="mt-6">
        <CalendarView
          year={year}
          month={month}
          schedule={schedule ?? []}
          providers={providers ?? []}
        />
      </div>
    </div>
  );
}
