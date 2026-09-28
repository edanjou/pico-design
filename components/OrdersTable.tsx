"use client";

import { useState } from "react";
import { DownloadIcon, SpinnerIcon } from "@/components/icons";

export interface OrderRow {
  id: string;
  shopify_order_id: string;
  order_number: string | null;
  customer_email: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  pico_status: string;
  created_at: string;
  order_items: {
    id: string;
    title: string | null;
    quantity: number;
    design_submission_id: string | null;
  }[];
}

const PICO_STATUSES: { value: string; label: string }[] = [
  { value: "recue", label: "Reçue" },
  { value: "en_production", label: "En production" },
  { value: "imprimee", label: "Imprimée" },
  { value: "expediee", label: "Expédiée" },
];

/**
 * Les commandes Shopify et leurs designs. Le statut « Pico » suit
 * l'avancement en atelier : il est volontairement distinct des statuts
 * Shopify, qui décrivent le paiement et l'expédition.
 */
export default function OrdersTable({ orders, shopDomain }: { orders: OrderRow[]; shopDomain: string | null }) {
  const [rows, setRows] = useState(orders);
  const [busy, setBusy] = useState<string | null>(null);

  async function changeStatus(orderId: string, picoStatus: string) {
    setRows((all) => all.map((o) => (o.id === orderId ? { ...o, pico_status: picoStatus } : o)));
    await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ picoStatus }),
    });
  }

  if (rows.length === 0) {
    return (
      <div>
        <h1 className="font-display text-page-title text-text">Commandes</h1>
        <p className="mt-4 rounded-xl border border-border bg-surface-muted p-4 text-sm text-text-muted">
          Aucune commande reçue. Les commandes arrivent par le webhook Shopify ; tant qu&apos;il n&apos;est pas
          configuré (variable <code>SHOPIFY_WEBHOOK_SECRET</code>), cet écran reste vide.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-page-title text-text">Commandes</h1>
      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-text-subtle">
            <tr>
              <th className="px-4 py-3">Commande</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Paiement</th>
              <th className="px-4 py-3">Suivi Pico</th>
              <th className="px-4 py-3">Designs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((order) => (
              <tr key={order.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  {shopDomain ? (
                    <a
                      href={`https://${shopDomain}/admin/orders/${order.shopify_order_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary underline"
                    >
                      {order.order_number ?? order.shopify_order_id}
                    </a>
                  ) : (
                    <span className="font-medium">{order.order_number ?? order.shopify_order_id}</span>
                  )}
                  <div className="text-xs text-text-subtle">
                    {new Date(order.created_at).toLocaleDateString("fr-CA")}
                  </div>
                </td>
                <td className="px-4 py-3 text-text-muted">{order.customer_email ?? "—"}</td>
                <td className="px-4 py-3 text-text-muted">{order.financial_status ?? "—"}</td>
                <td className="px-4 py-3">
                  <select
                    value={order.pico_status}
                    onChange={(e) => changeStatus(order.id, e.target.value)}
                    className="rounded-lg border border-border px-2 py-1 text-xs"
                  >
                    {PICO_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    {order.order_items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <span className="text-text-muted">
                          {item.quantity} × {item.title ?? "Article"}
                        </span>
                        {item.design_submission_id ? (
                          <a
                            href={`/api/orders/${item.design_submission_id}/pdf`}
                            onClick={() => setBusy(item.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-text-muted hover:text-text"
                          >
                            {busy === item.id ? (
                              <SpinnerIcon className="h-3.5 w-3.5" />
                            ) : (
                              <DownloadIcon className="h-3.5 w-3.5" />
                            )}
                            PDF
                          </a>
                        ) : (
                          <span className="text-xs text-text-subtle">sans design</span>
                        )}
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
