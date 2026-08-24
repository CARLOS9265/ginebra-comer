import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewSealForm } from "./NewSealForm";
import { SealRowActions } from "./SealRowActions";

const STATUS_LABELS: Record<string, string> = {
  disponible: "Disponible",
  colocado: "Colocado",
  verificado: "Verificado",
  abierto: "Abierto",
  anulado: "Anulado",
};

const STATUS_COLORS: Record<string, string> = {
  disponible: "bg-slate-100 text-slate-400",
  colocado: "bg-sky-100 text-sky-700",
  verificado: "bg-gold-100 text-gold-700",
  abierto: "bg-amber-100 text-amber-700",
  anulado: "bg-red-100 text-red-600",
};

const TABS = ["todos", "disponible", "colocado", "verificado", "abierto", "anulado"] as const;

export default async function SealsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("seals")
    .select("id, code, status, opened_reason, updated_at, purchase_lots(code)")
    .order("updated_at", { ascending: false });

  if (estado && estado !== "todos") {
    query = query.eq("status", estado);
  }

  const { data: seals } = await query;

  const { data: openLots } = await supabase
    .from("purchase_lots")
    .select("id, code")
    .neq("status", "cerrado")
    .order("code");

  const lots = openLots ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Precintos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Control documental: colocación, verificación previa a la salida del volquete y apertura
          en molino.
        </p>
      </div>

      <NewSealForm lots={lots} />

      <div className="mt-6 mb-4 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <Link
            key={t}
            href={t === "todos" ? "/precintos" : `/precintos?estado=${t}`}
            className={`rounded-lg px-3 py-1.5 text-xs ${
              (estado ?? "todos") === t
                ? "bg-navy-800 text-white"
                : "bg-white text-slate-500 hover:bg-slate-100"
            }`}
          >
            {t === "todos" ? "Todos" : STATUS_LABELS[t]}
          </Link>
        ))}
      </div>

      {!seals || seals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          No hay precintos en este estado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Lote</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Actualizado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {seals.map((s) => {
                const lot = Array.isArray(s.purchase_lots) ? s.purchase_lots[0] : s.purchase_lots;
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-700">{s.code}</td>
                    <td className="px-4 py-3 text-slate-400">{lot?.code ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          STATUS_COLORS[s.status] ?? "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {STATUS_LABELS[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{s.opened_reason ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(s.updated_at).toLocaleString("es-PE")}
                    </td>
                    <td className="px-4 py-3">
                      <SealRowActions id={s.id} status={s.status} lots={lots} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
