import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProviderForm } from "../../ProviderForm";

export default async function EditProviderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: provider } = await supabase
    .from("providers")
    .select("id, code, name, mine_name, concession")
    .eq("id", id)
    .maybeSingle();

  if (!provider) notFound();

  return (
    <ProviderForm
      mode="edit"
      providerId={provider.id}
      initialValues={{
        code: provider.code,
        name: provider.name,
        mine_name: provider.mine_name ?? "",
        concession: provider.concession ?? "",
      }}
    />
  );
}
