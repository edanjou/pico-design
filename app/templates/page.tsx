import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import TemplateRow from "@/components/TemplateRow";
import { TEMPLATE_CATEGORY_LABELS, type Template, type TemplateCategory } from "@/lib/types";

const CATEGORY_ORDER = Object.keys(TEMPLATE_CATEGORY_LABELS) as TemplateCategory[];

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
        <h1 className="text-xl font-semibold text-pico-black">Modèles de produits</h1>
        <Link
          href="/templates/new"
          className="rounded bg-pico-black px-3 py-1.5 text-sm text-white hover:bg-neutral-800"
        >
          + Nouveau modèle
        </Link>
      </div>

      {all.length === 0 && (
        <p className="rounded border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
          Aucun modèle pour l&apos;instant.
        </p>
      )}

      <div className="space-y-8">
        {CATEGORY_ORDER.map((category) => {
          const items = all.filter((t) => t.category === category);
          if (items.length === 0) return null;
          return (
            <div key={category}>
              <h2 className="mb-2 text-xs font-semibold tracking-widest text-neutral-500">
                {TEMPLATE_CATEGORY_LABELS[category].toUpperCase()}
              </h2>
              <div className="divide-y rounded border border-neutral-200 bg-white">
                {items.map((t) => (
                  <TemplateRow key={t.id} template={t} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
