import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import TemplateForm from "@/components/TemplateForm";
import type { Template } from "@/lib/types";

export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: template } = await supabase
    .from("templates")
    .select("*")
    .eq("id", params.id)
    .single<Template>();

  if (!template) notFound();

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-pico-black">Modifier « {template.name} »</h1>
      <TemplateForm template={template} />
    </div>
  );
}
