"use client";

import { useState } from "react";

type Point = { date: string; value: number };

const WIDTH = 640;
const HEIGHT = 200;
const PAD = { top: 16, right: 12, bottom: 24, left: 56 };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const range = max - min;
  const step = range / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

export function PriceChart({
  title,
  unit,
  color,
  points,
}: {
  title: string;
  unit: string;
  color: string;
  points: Point[];
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <p className="mt-6 text-center text-sm text-slate-400">Todavía no hay historial de precios.</p>
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const cushion = (rawMax - rawMin) * 0.1 || rawMax * 0.05 || 1;
  const yMin = rawMin - cushion;
  const yMax = rawMax + cushion;

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const xAt = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const yAt = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.value).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${xAt(points.length - 1).toFixed(1)} ${(PAD.top + plotH).toFixed(1)} L ${xAt(0).toFixed(1)} ${(PAD.top + plotH).toFixed(1)} Z`;

  const yTicks = niceTicks(yMin, yMax, 4);
  const last = points[points.length - 1];
  const hovered = hoverIdx != null ? points[hoverIdx] : null;

  const fmtDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
  const fmtValue = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 2 });

  function handleMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const idx = Math.round(((relX - PAD.left) / plotW) * (points.length - 1));
    setHoverIdx(Math.min(points.length - 1, Math.max(0, idx)));
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className="font-mono text-sm font-semibold" style={{ color }}>
          {fmtValue(last.value)} <span className="text-xs font-normal text-slate-400">{unit}</span>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-2 w-full"
        role="img"
        aria-label={`${title}: ${fmtValue(last.value)} ${unit} al ${fmtDate(last.date)}`}
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke="#e1e0d9" strokeWidth={1} />
            <text x={PAD.left - 8} y={yAt(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#898781">
              {fmtValue(t)}
            </text>
          </g>
        ))}

        {points.length > 1 ? (
          <>
            <text x={xAt(0)} y={HEIGHT - 6} textAnchor="start" fontSize={10} fill="#898781">
              {fmtDate(points[0].date)}
            </text>
            <text x={xAt(points.length - 1)} y={HEIGHT - 6} textAnchor="end" fontSize={10} fill="#898781">
              {fmtDate(last.date)}
            </text>
          </>
        ) : (
          <text x={xAt(0)} y={HEIGHT - 6} textAnchor="middle" fontSize={10} fill="#898781">
            {fmtDate(last.date)}
          </text>
        )}

        <path d={areaPath} fill={color} opacity={0.1} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        <circle cx={xAt(points.length - 1)} cy={yAt(last.value)} r={4} fill={color} stroke="#ffffff" strokeWidth={2} />

        {hovered && hoverIdx != null && (
          <>
            <line
              x1={xAt(hoverIdx)}
              x2={xAt(hoverIdx)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="#c3c2b7"
              strokeWidth={1}
            />
            <circle cx={xAt(hoverIdx)} cy={yAt(hovered.value)} r={4} fill={color} stroke="#ffffff" strokeWidth={2} />
          </>
        )}

        <rect
          x={PAD.left}
          y={PAD.top}
          width={plotW}
          height={plotH}
          fill="transparent"
          onPointerMove={handleMove}
          onPointerLeave={() => setHoverIdx(null)}
        />
      </svg>

      {hovered && (
        <div className="mt-1 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
          <span className="text-slate-500">{fmtDate(hovered.date)}</span>
          <span className="font-mono font-semibold text-slate-800">
            {fmtValue(hovered.value)} {unit}
          </span>
        </div>
      )}
    </div>
  );
}
