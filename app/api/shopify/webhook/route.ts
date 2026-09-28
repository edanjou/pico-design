import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { designIdOfLineItem, verifyWebhookSignature, type ShopifyOrder } from "@/lib/shopify";

export const runtime = "nodejs";

/**
 * Webhook des commandes Shopify (`orders/create` et `orders/updated`).
 *
 * La signature est vérifiée sur le CORPS BRUT avant toute lecture : sans
 * elle, cette URL publique permettrait de fabriquer des commandes de toutes
 * pièces. Une charge non signée, mal signée, ou reçue alors qu'aucun secret
 * n'est configuré, est refusée.
 *
 * Réponses : 401 si la signature ne va pas, 200 dans tous les autres cas où
 * la charge a été traitée — Shopify réessaie sur toute réponse non-2xx, et
 * une commande dont une ligne est bancale ne doit pas provoquer une boucle
 * de réessais.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-shopify-hmac-sha256");
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
  }

  let order: ShopifyOrder;
  try {
    order = JSON.parse(rawBody) as ShopifyOrder;
  } catch {
    return NextResponse.json({ error: "Charge illisible." }, { status: 400 });
  }
  if (!order?.id) return NextResponse.json({ error: "Commande sans identifiant." }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const shopifyOrderId = String(order.id);

  // upsert : `orders/updated` repasse sur la même commande, et Shopify peut
  // renvoyer deux fois le même événement (livraison au moins une fois).
  const { data: saved, error } = await admin
    .from("orders")
    .upsert(
      {
        shopify_order_id: shopifyOrderId,
        order_number: order.name ?? (order.order_number ? `#${order.order_number}` : null),
        customer_email: order.email ?? order.contact_email ?? null,
        financial_status: order.financial_status ?? null,
        fulfillment_status: order.fulfillment_status ?? null,
        raw: order,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "shopify_order_id" }
    )
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const orderId = (saved as { id: string }).id;

  // Les lignes sont réécrites à chaque réception : c'est la charge utile qui
  // fait foi, et ça évite les doublons sur un `orders/updated`.
  await admin.from("order_items").delete().eq("order_id", orderId);

  const items = (order.line_items ?? []).map((item) => ({
    order_id: orderId,
    design_submission_id: designIdOfLineItem(item),
    title: item.title ?? null,
    quantity: item.quantity ?? 1,
  }));

  if (items.length > 0) {
    // Un design référencé mais absent (lien forgé, base réinitialisée) ferait
    // échouer la clé étrangère : on ne garde que les identifiants existants.
    const referenced = items.map((i) => i.design_submission_id).filter((v): v is string => Boolean(v));
    const known = new Set<string>();
    if (referenced.length > 0) {
      const { data: rows } = await admin.from("design_submissions").select("id").in("id", referenced);
      for (const row of (rows as { id: string }[]) ?? []) known.add(row.id);
    }
    const { error: itemsError } = await admin
      .from("order_items")
      .insert(items.map((i) => ({ ...i, design_submission_id: i.design_submission_id && known.has(i.design_submission_id) ? i.design_submission_id : null })));
    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, lignes: items.length });
}
