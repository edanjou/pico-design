import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import TemplatesTable from "@/components/TemplatesTable";
import type { Template } from "@/lib/types";

export default async function TemplatesPage() {
  const supabase = createServerSupabaseClient();
  const { data: templates } = await supabase
    .from("templates")
    .select("*")
    .order("name", { ascending: true });

  const all = (templates as Template[]) ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-pico-black">Modèles</h1>
          <p className="text-sm text-neutral-500">
            {all.length} modèle{all.length > 1 ? "s" : ""} au catalogue.
          </p>
        </div>
        <Link
          href="/templates/new"
          className="flex items-center gap-2 rounded-lg bg-pico-maroon px-4 py-2 text-sm font-medium text-white hover:bg-pico-maroon-dark"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m-7-7h14" />
          </svg>
          Nouveau modèle
        </Link>
      </div>

      <TemplatesTable templates={all} />
    </div>
  );
}
