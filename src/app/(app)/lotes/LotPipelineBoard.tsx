import Link from "next/link";
import type { LotStatus } from "@/lib/lot-status";

type Provider = { name: string; code: string };
type PipelineLot = {
  id: string;
  code: string;
  status: string;
  providers: Provider | Provider[] | null;
};

type Stage = {
  title: string;
  statuses: LotStatus[];
};

const STAGES: Stage[] = [
  { title: "Cargado", statuses: ["creado"] },
  { title: "En tránsito", statuses: ["en_transito"] },
  { title: "En el molino", statuses: ["pesado", "recibido_molino"] },
  { title: "Molido / en laboratorio", statuses: ["conminuido", "en_laboratorio"] },
  { title: "Listo para trasladar", statuses: ["valorizado"] },
  { title: "En almacén (listo para Lima)", statuses: ["en_almacen"] },
];

function providerOf(l: PipelineLot): Provider | null {
  if (!l.providers) return null;
  return Array.isArray(l.providers) ? (l.providers[0] ?? null) : l.providers;
}

export function LotPipelineBoard({ lots }: { lots: PipelineLot[] }) {
  const active = lots.filter((l) => l.status !== "cerrado");
  if (active.length === 0) return null;

  return (
    <div className="mb-6 overflow-x-auto">
      <div className="flex gap-3" style={{ minWidth: `${STAGES.length * 220}px` }}>
        {STAGES.map((stage) => {
          const stageLots = active.filter((l) => stage.statuses.includes(l.status as LotStatus));
          return (
            <div key={stage.title} className="flex-1 rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stage.title}</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                  {stageLots.length}
                </span>
              </div>
              {stageLots.length === 0 ? (
                <p className="text-xs text-slate-300">—</p>
              ) : (
                <div className="space-y-1.5">
                  {stageLots.map((l) => {
                    const provider = providerOf(l);
                    return (
                      <Link
                        key={l.id}
                        href={`/lotes/${l.id}`}
                        className="block rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 hover:border-gold-300 hover:bg-gold-50"
                      >
                        <div className="font-mono text-xs font-medium text-slate-700">{l.code}</div>
                        {provider && <div className="truncate text-[11px] text-slate-400">{provider.name}</div>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
