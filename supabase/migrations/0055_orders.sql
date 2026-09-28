-- Module Commande : le pont entre Shopify et pico-design.
--
-- Parcours : le client choisit son produit, sa quantité et ses options sur
-- Shopify, personnalise le visuel dans l'Outil Shopify, son design est
-- ENREGISTRÉ ici, puis il retourne payer sur Shopify. Le webhook de commande
-- rattache ensuite chaque ligne payée à son design.
--
-- Jusqu'ici l'outil n'enregistrait rien : le client repartait avec son PDF et
-- il n'en restait aucune trace. C'est la pièce qui manquait.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

-- 1. Le design enregistré par un client, AVANT tout paiement. Il peut donc
--    rester orphelin (panier abandonné) : c'est normal, et sans conséquence.
create table if not exists public.design_submissions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id),
  rotated boolean not null default false,
  -- Tous les ingrédients du rendu (calques, cadrage, type de design,
  -- mosaïque, thème…) : exactement ce que DesignReviewOverlay envoie déjà à
  -- /api/design/pdf. Le PDF se fabrique à la demande à partir de là, plutôt
  -- que d'être stocké pour chaque design, payé ou non.
  payload jsonb not null,
  -- Fichiers déposés par le client, dans le bucket « uploads ».
  source_paths jsonb not null default '[]'::jsonb,
  -- Aperçu léger, montré dans le panier Shopify et dans le module.
  mockup_path text,
  -- Contexte Shopify transmis par le lien de personnalisation.
  shopify_variant_id text,
  quantity integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists design_submissions_template_idx on public.design_submissions (template_id);

-- 2. Les commandes, telles que Shopify les annonce.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  shopify_order_id text unique not null,
  order_number text,
  customer_email text,
  financial_status text,
  fulfillment_status text,
  -- Suivi propre à Pico, volontairement distinct des statuts Shopify : il
  -- décrit l'avancement en atelier, pas celui du paiement.
  pico_status text not null default 'recue'
    check (pico_status in ('recue', 'en_production', 'imprimee', 'expediee')),
  -- Charge utile du webhook, conservée telle quelle : elle permet de
  -- rattraper un champ oublié sans redemander quoi que ce soit à Shopify.
  raw jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  -- Null quand la ligne n'a pas de design (un produit non personnalisable,
  -- ou une propriété _design absente).
  design_submission_id uuid references public.design_submissions(id),
  title text,
  quantity integer not null default 1
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- 3. RLS. Lecture et écriture pour les utilisateurs authentifiés, comme les
--    autres tables métier. Rien n'est ouvert à l'anonyme : le client public
--    n'a pas de session, ses écritures passent par les routes serveur avec
--    la clé de service, qui contourne la RLS.
alter table public.design_submissions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['design_submissions', 'orders', 'order_items'] loop
    execute format('drop policy if exists "%1$s_all" on public.%1$I', t);
    execute format(
      'create policy "%1$s_all" on public.%1$I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')',
      t
    );
  end loop;
end $$;
