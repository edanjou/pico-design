"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Template } from "@/lib/types";
import { mmToIn } from "@/lib/pdf/units";
import { FilePenIcon, TrashIcon } from "@/components/icons";

function formatIn(mm: number): string {
  return `${Math.round(mmToIn(mm) * 100) / 100}"`;
}

export default function TemplateRow({
  template,
  categoryName,
  onEdit,
}: {
  template: Template;
  categoryName: string;
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
      <td className="p-4 text-neutral-500">{categoryName}</td>
      <td className="p-4 text-neutral-700">
        {formatIn(template.width_mm)}×{formatIn(template.height_mm)}
      </td>
      <td className="p-4 text-right">
        <div className="flex justify-end gap-1">
          <button
            onClick={() => onEdit(template)}
            title="Modifier"
            aria-label="Modifier"
            className="inline-flex rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-pico-black"
          >
            <FilePenIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Supprimer"
            aria-label="Supprimer"
            className="inline-flex rounded-lg p-1.5 text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
