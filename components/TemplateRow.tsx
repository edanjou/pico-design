"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TEMPLATE_CATEGORY_LABELS, type Template } from "@/lib/types";

export default function TemplateRow({
  template,
  onEdit,
}: {
  template: Template;
  onEdit: (template: Template) => void;
}) {
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
        <div className="flex justify-end gap-1">
          <button
            onClick={() => onEdit(template)}
            title="Modifier"
            aria-label="Modifier"
            className="inline-flex rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-pico-black"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
              />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Supprimer"
            aria-label="Supprimer"
            className="inline-flex rounded-lg p-1.5 text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12"
              />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}
