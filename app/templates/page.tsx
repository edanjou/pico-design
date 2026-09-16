import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import TemplateRow from "@/components/TemplateRow";
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
        <h1 className="text-xl font-semibold text-pico-black">Modèles de produits</h1>
        <Link
          href="/templates/new"
          className="rounded bg-pico-black px-3 py-1.5 text-sm text-white hover:bg-neutral-800"
        >
          + Nouveau modèle
        </Link>
      </div>

      {all.length === 0 ? (
        <p className="rounded border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
          Aucun modèle pour l&apos;instant.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th className="p-3">Nom</th>
                <th className="p-3">Catégorie</th>
                <th className="p-3">Dimensions</th>
                <th className="p-3">Fond perdu</th>
                <th className="p-3">Résolution</th>
                <th className="p-3">Logo</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {all.map((t) => (
                <TemplateRow key={t.id} template={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
