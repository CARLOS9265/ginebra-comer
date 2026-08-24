import { ChatClient } from "./ChatClient";

export default function AsistentePage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Asistente</h1>
        <p className="mt-1 text-sm text-slate-500">
          Consulta lotes, muestreos, márgenes, precios y alertas en lenguaje natural.
        </p>
      </div>
      <ChatClient />
    </div>
  );
}
