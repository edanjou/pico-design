-- Module "Paramètres" : secret de signature des webhooks de commande, une
-- ligne par boutique Shopify. Chaque boutique signe ses webhooks avec SA clé
-- (Paramètres > Notifications > Webhooks) : une seule variable
-- SHOPIFY_WEBHOOK_SECRET ne pouvait servir qu'une boutique.
--   * shop_domain : nom-boutique.myshopify.com, tel que Shopify l'envoie dans
--                   l'en-tête X-Shopify-Shop-Domain ;
--   * secret      : la clé de signature.
-- Table à part, et non une colonne d'app_settings : ces réglages-là sont
-- lisibles par tous les employés, un secret ne doit l'être par personne.
-- Aucune politique RLS n'est donc créée : seul le serveur (clé de service)
-- lit et écrit ici, après avoir vérifié que l'appelant est administrateur.
-- La variable SHOPIFY_WEBHOOK_SECRET reste acceptée en plus.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

create table if not exists public.shop_webhook_secrets (
  shop_domain text primary key,
  secret text not null check (length(secret) between 1 and 200),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.shop_webhook_secrets enable row level security;
revoke all on public.shop_webhook_secrets from anon, authenticated;
