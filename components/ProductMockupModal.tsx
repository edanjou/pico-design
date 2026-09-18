"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { SpinnerIcon } from "@/components/icons";

export default function ProductMockupModal({
  productId,
  productName,
  onClose,
}: {
  productId: string;
  productName: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function load() {
      const res = await fetch(`/api/products/${productId}/mockup`);
      if (cancelled) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erreur lors de la génération du mockup.");
        setLoading(false);
        return;
      }
      const blob = await res.blob();
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      setLoading(false);
    }
    load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [productId]);

  return (
    <Modal title={`Mockup — ${productName}`} onClose={onClose}>
      {loading ? (
        <div className="flex items-center justify-center py-16 text-neutral-400">
          <SpinnerIcon className="h-6 w-6" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`Mockup de ${productName}`} className="mx-auto max-h-[70vh] rounded-lg" />
      ) : null}
    </Modal>
  );
}
