"use client";

import { useRef, useState, useTransition } from "react";
import { sendMessage, type ChatMessage } from "./actions";

const SUGGESTIONS = [
  "¿Hay algo urgente o pendiente ahora mismo?",
  "¿Cómo van los márgenes este mes?",
  "¿Qué lotes de compra están sin liquidar?",
  "¿Cuándo conviene fijar el precio del muestreo más próximo a vencer?",
];

export function ChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  function submit(text: string) {
    const value = text.trim();
    if (!value || pending) return;
    setInput("");
    setError(null);
    const optimistic = [...messages, { role: "user" as const, text: value }];
    setMessages(optimistic);

    startTransition(async () => {
      const result = await sendMessage(messages, value);
      if (result.error) {
        setError(result.error);
        setMessages(messages);
      } else {
        setMessages(result.history);
      }
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
  }

  return (
    <div className="flex h-[calc(100vh-160px)] flex-col">
      <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm text-slate-500">
              Preguntame sobre lotes, muestreos, márgenes, precios o qué está pendiente.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                  m.role === "user" ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-800"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {pending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-400">Pensando...</div>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribí tu pregunta..."
          disabled={pending}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gold-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-60"
        >
          {pending ? "..." : "Enviar"}
        </button>
      </form>
    </div>
  );
}
