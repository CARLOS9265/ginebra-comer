import { getCurrentUser, ROLE_LABELS } from "@/lib/auth";

export default async function DashboardPage() {
  const { profile } = await getCurrentUser();
  if (!profile) return null;

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-50">
        Hola, {profile.full_name.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-slate-400">
        Rol: {ROLE_LABELS[profile.role]}. Esta es la base del sistema — el registro de lotes de
        compra se agrega en el próximo paso.
      </p>
    </div>
  );
}
