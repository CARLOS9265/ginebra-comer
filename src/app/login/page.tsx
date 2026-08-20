"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthFormState } from "./actions";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginState, loginAction, loginPending] = useActionState<AuthFormState, FormData>(
    signIn,
    null,
  );
  const [signupState, signupAction, signupPending] = useActionState<AuthFormState, FormData>(
    signUp,
    null,
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-50">Ginebra</h1>
          <p className="mt-1 text-sm text-slate-400">
            Sistema de trazabilidad de mineral
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
          <div className="flex border-b border-slate-800">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-tl-xl px-4 py-3 text-sm font-medium transition ${
                mode === "login"
                  ? "bg-slate-900 text-slate-50"
                  : "bg-slate-950/50 text-slate-500 hover:text-slate-300"
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-tr-xl px-4 py-3 text-sm font-medium transition ${
                mode === "signup"
                  ? "bg-slate-900 text-slate-50"
                  : "bg-slate-950/50 text-slate-500 hover:text-slate-300"
              }`}
            >
              Crear cuenta
            </button>
          </div>

          {mode === "login" ? (
            <form action={loginAction} className="space-y-4 p-6">
              <Field label="Correo" name="email" type="email" autoComplete="email" />
              <Field
                label="Contraseña"
                name="password"
                type="password"
                autoComplete="current-password"
              />
              {loginState?.error && (
                <p className="text-sm text-red-400">{loginState.error}</p>
              )}
              <button
                type="submit"
                disabled={loginPending}
                className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white transition hover:bg-teal-500 disabled:opacity-60"
              >
                {loginPending ? "Entrando..." : "Entrar"}
              </button>
            </form>
          ) : (
            <form action={signupAction} className="space-y-4 p-6">
              <Field label="Nombre completo" name="full_name" type="text" autoComplete="name" />
              <Field label="Correo" name="email" type="email" autoComplete="email" />
              <Field
                label="Contraseña"
                name="password"
                type="password"
                autoComplete="new-password"
                hint="Mínimo 8 caracteres."
              />
              {signupState?.error && (
                <p className="text-sm text-red-400">{signupState.error}</p>
              )}
              {signupState?.message && (
                <p className="text-sm text-teal-400">{signupState.message}</p>
              )}
              <button
                type="submit"
                disabled={signupPending}
                className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white transition hover:bg-teal-500 disabled:opacity-60"
              >
                {signupPending ? "Creando..." : "Crear cuenta"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-600">
          Las cuentas nuevas quedan pendientes de activación por un administrador.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  hint,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
      />
      {hint && <span className="mt-1 block text-xs text-slate-600">{hint}</span>}
    </label>
  );
}
