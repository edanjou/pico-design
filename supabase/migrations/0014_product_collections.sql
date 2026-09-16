-- Collections de produits (regroupement optionnel, ex. quand plusieurs
-- produits sont créés d'un coup à partir d'un même visuel appliqué à
-- plusieurs modèles).
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

create table if not exists public.product_collections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.product_collections enable row level security;

create policy "Les employés lisent les collections de produits" on public.product_collections
  for select using (auth.role() = 'authenticated');
create policy "Les employés créent des collections de produits" on public.product_collections
  for insert with check (auth.role() = 'authenticated');
create policy "Les employés modifient des collections de produits" on public.product_collections
  for update using (auth.role() = 'authenticated');
create policy "Les employés suppriment des collections de produits" on public.product_collections
  for delete using (auth.role() = 'authenticated');

alter table public.products
  add column if not exists collection_id uuid references public.product_collections(id) on delete set null;
