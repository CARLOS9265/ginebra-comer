"use client";

import { useRef, useState } from "react";
import { extractLabAnalysis, type LabAnalysisExtraction } from "@/app/(app)/lotes/[id]/actions";

// Mismo patrón que TicketScanInput (pesajes): sube una foto, captura de
// pantalla o PDF del informe/resultados de laboratorio, lo manda a leer con
// Gemini y devuelve los valores para prellenar el formulario — nunca guarda
// ni envía nada solo, el usuario siempre revisa y confirma.
export function LabReportScanInput({ onExtracted }: { onExtracted: (data: LabAnalysisExtraction) => void }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setScanning(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await extractLabAnalysis(base64, file.type || "image/jpeg");
      if ("error" in result) {
        setError(result.error);
      } else {
        onExtracted(result.data);
      }
    } catch {
      setError("No se pudo leer el archivo.");
    } finally {
      setScanning(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-gold-300 bg-gold-50 p-3">
      <label className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-gold-700">
          Leer informe de laboratorio automáticamente (foto, captura o PDF)
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          disabled={scanning}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="text-xs text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-navy-800 file:px-2.5 file:py-1 file:text-xs file:text-white"
        />
        {scanning && <span className="text-xs text-slate-500">Leyendo...</span>}
      </label>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      <p className="mt-1.5 text-xs text-slate-400">
        Completa los campos abajo — revisalos antes de guardar, la lectura puede fallar.
      </p>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
