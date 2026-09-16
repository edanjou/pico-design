"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";

export default function ProductTableRow({
  product,
  templateName,
  categoryLabel,
  imageUrl,
}: {
  product: Product;
  templateName: string;
  categoryLabel: string;
  imageUrl: string | null;
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
      <td className="p-4 text-neutral-500">{categoryLabel}</td>
      <td className="p-4 text-right">
        <div className="flex justify-end gap-3 text-sm">
          <Link href={`/products/${product.id}/edit`} className="text-pico-black hover:underline">
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
