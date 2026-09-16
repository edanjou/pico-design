"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Template } from "@/lib/types";

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
    <div className="flex items-center justify-between gap-4 p-4">
      <div>
        <p className="font-medium">{template.name}</p>
        <p className="text-sm text-neutral-500">
          {template.width_mm}×{template.height_mm}mm · fond perdu {template.bleed_mm}mm ·{" "}
          {template.dpi} dpi · logo {template.logo_position}
        </p>
      </div>
      <div className="flex shrink-0 gap-3 text-sm">
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
    </div>
  );
}
