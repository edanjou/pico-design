"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TEMPLATE_CATEGORY_LABELS, type Template } from "@/lib/types";

export default function TemplateRow({ template }: { template: Template }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Supprimer le modèle « ${template.name} » ?`)) return;
    setDeleting(true);
    const res = await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Erreur lors de la suppression.");
      return;
    }
    router.refresh();
  }

  return (
    <tr className="border-t border-neutral-100 hover:bg-neutral-50">
      <td className="p-4 font-semibold text-pico-black">{template.name}</td>
      <td className="p-4 text-neutral-500">{TEMPLATE_CATEGORY_LABELS[template.category]}</td>
      <td className="p-4 text-neutral-700">
        {template.width_mm}×{template.height_mm}mm
      </td>
      <td className="p-4 text-neutral-700">{template.bleed_mm}mm</td>
      <td className="p-4 text-neutral-700">{template.dpi} dpi</td>
      <td className="p-4 text-neutral-500">{template.logo_position}</td>
      <td className="p-4 text-right">
        <div className="flex justify-end gap-3 text-sm">
          <Link href={`/templates/${template.id}/edit`} className="text-pico-black hover:underline">
            Modifier
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-red-600 hover:underline disabled:opacity-50"
          >
            {deleting ? "..." : "Supprimer"}
          </button>
        </div>
      </td>
    </tr>
  );
}
