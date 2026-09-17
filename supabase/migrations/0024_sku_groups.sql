-- Remplace le groupe libre (group_label, texte) des SKU par une table
-- `sku_groups` modifiable par les employés (créer/renommer/supprimer),
-- sur le même modèle que `categories` pour les modèles.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

create table if not exists public.sku_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.sku_groups enable row level security;

create policy "Les employés lisent les groupes de skus" on public.sku_groups
  for select using (auth.role() = 'authenticated');
create policy "Les employés créent des groupes de skus" on public.sku_groups
  for insert with check (auth.role() = 'authenticated');
create policy "Les employés modifient des groupes de skus" on public.sku_groups
  for update using (auth.role() = 'authenticated');
create policy "Les employés suppriment des groupes de skus" on public.sku_groups
  for delete using (auth.role() = 'authenticated');

-- Reprend les groupes existants (distincts de group_label) comme lignes de
-- départ, puis bascule les SKU dessus.
insert into public.sku_groups (name)
  select distinct group_label from public.skus
  on conflict (name) do nothing;

alter table public.skus add column if not exists sku_group_id uuid references public.sku_groups(id);

update public.skus set sku_group_id = (select id from public.sku_groups where name = skus.group_label)
  where sku_group_id is null;

alter table public.skus alter column sku_group_id set not null;
alter table public.skus drop column if exists group_label;
