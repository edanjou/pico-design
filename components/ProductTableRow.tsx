"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";
import { formatIn } from "@/lib/pdf/units";
import { DownloadIcon, FilePenIcon, TrashIcon } from "@/components/icons";

export default function ProductTableRow({
  product,
  templateName,
  categoryLabel,
  collectionLabel,
  dimensions,
  imageUrl,
  onEdit,
}: {
  product: Product;
  templateName: string;
  categoryLabel: string;
  collectionLabel: string | null;
  dimensions: { width_mm: number; height_mm: number } | null;
  imageUrl: string | null;
  onEdit: (product: Product) => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Supprimer le produit « ${product.name} » ?`)) return;
    setDeleting(true);
    const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
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
      <td className="p-4">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={product.name} className="h-12 w-12 rounded-lg object-cover" />
        ) : (
          <div className="h-12 w-12 rounded-lg bg-neutral-100" />
        )}
      </td>
      <td className="p-4 font-semibold text-pico-black">{product.name}</td>
      <td className="p-4 text-neutral-700">{templateName}</td>
      <td className="p-4 text-neutral-700">
        {dimensions ? `${formatIn(dimensions.width_mm)}×${formatIn(dimensions.height_mm)}` : "—"}
      </td>
      <td className="p-4 text-neutral-500">{categoryLabel}</td>
      <td className="p-4 text-neutral-500">{collectionLabel ?? "—"}</td>
      <td className="p-4 text-right">
        <div className="flex justify-end gap-1">
          {product.pdf_path ? (
            <a
              href={`/api/products/${product.id}/pdf`}
              title="Télécharger le PDF"
              aria-label="Télécharger le PDF"
              className="inline-flex rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-pico-black"
            >
              <DownloadIcon className="h-4 w-4" />
            </a>
          ) : (
            <span
              title="PDF pas encore généré"
              aria-label="PDF pas encore généré"
              className="inline-flex rounded-lg p-1.5 text-neutral-300"
            >
              <DownloadIcon className="h-4 w-4" />
            </span>
          )}
          <button
            onClick={() => onEdit(product)}
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
