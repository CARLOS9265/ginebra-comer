"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createProvider, updateProvider, type ProviderFormState } from "./actions";

export type ProviderInitialValues = {
  code: string;
  name: string;
  mine_name: string;
  concession: string;
};

export function ProviderForm({
  mode,
  providerId,
  initialValues,
}: {
  mode: "create" | "edit";
  providerId?: string;
  initialValues?: ProviderInitialValues;
}) {
  const boundAction =
    mode === "edit" && providerId ? updateProvider.bind(null, providerId) : createProvider;
  const [state, action, pending] = useActionState<ProviderFormState, FormData>(boundAction, null);

  return (
    <div className="max-w-lg">
      <Link href="/proveedores" className="text-sm text-slate-500 hover:text-slate-300">
        ← Proveedores
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-50">
        {mode === "edit" ? "Editar proveedor" : "Nuevo proveedor"}
      </h1>

      <form action={action} className="mt-6 space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <Field
          label="Código corto"
          name="code"
          hint="Se usa en el código de cada lote, ej. GIN-BUS-2026-0001."
          placeholder="BUS"
          defaultValue={initialValues?.code}
        />
        <Field label="Nombre" name="name" placeholder="Business SAC" defaultValue={initialValues?.name} />
        <Field label="Mina" name="mine_name" placeholder="Opcional" required={false} defaultValue={initialValues?.mine_name} />
        <Field label="Concesión" name="concession" placeholder="Opcional" required={false} defaultValue={initialValues?.concession} />

        {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-60"
        >
          {pending ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Guardar proveedor"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  hint,
  placeholder,
  required = true,
  defaultValue,
}: {
  label: string;
  name: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      <input
        name={name}
        type="text"
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-teal-500"
      />
      {hint && <span className="mt-1 block text-xs text-slate-600">{hint}</span>}
    </label>
  );
}
