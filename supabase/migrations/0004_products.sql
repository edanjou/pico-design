-- Ajoute les "Produits" : un produit = un modèle + une image de référence
-- réutilisable, à partir duquel on génère des PDF (potentiellement
-- plusieurs fois). Remplace le flux d'upload ad-hoc de /generate.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_id uuid not null references public.templates(id),
  image_path text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.jobs
  add column if not exists product_id uuid references public.products(id) on delete set null;

alter table public.products enable row level security;

create policy "Les employés lisent les produits" on public.products
  for select using (auth.role() = 'authenticated');
create policy "Les employés créent des produits" on public.products
  for insert with check (auth.role() = 'authenticated');
create policy "Les employés modifient des produits" on public.products
  for update using (auth.role() = 'authenticated');
create policy "Les employés suppriment des produits" on public.products
  for delete using (auth.role() = 'authenticated');
