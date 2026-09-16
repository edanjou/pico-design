"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";

export default function ProductTableRow({
  product,
  templateName,
  imageUrl,
}: {
  product: Product;
  templateName: string;
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
    <tr className="border-t border-neutral-200">
      <td className="p-3">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={product.name} className="h-12 w-12 rounded object-cover" />
        ) : (
          <div className="h-12 w-12 rounded bg-neutral-100" />
        )}
      </td>
      <td className="p-3 font-medium">{product.name}</td>
      <td className="p-3 text-neutral-600">{templateName}</td>
      <td className="p-3 text-right">
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
