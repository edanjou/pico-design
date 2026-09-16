import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Template } from "@/lib/types";

export default async function TemplatesPage() {
  const supabase = createServerSupabaseClient();
  const { data: templates } = await supabase
    .from("templates")
    .select("*")
    .order("name", { ascending: true });

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

      <div className="divide-y rounded border border-neutral-200 bg-white">
        {((templates as Template[]) ?? []).map((t) => (
          <div key={t.id} className="p-4">
            <p className="font-medium">{t.name}</p>
            <p className="text-sm text-neutral-500">
              {t.width_mm}×{t.height_mm}mm · fond perdu {t.bleed_mm}mm · {t.dpi} dpi · logo{" "}
              {t.logo_position}
            </p>
          </div>
        ))}
        {(!templates || templates.length === 0) && (
          <p className="p-4 text-sm text-neutral-500">Aucun modèle pour l'instant.</p>
        )}
      </div>
    </div>
  );
}
