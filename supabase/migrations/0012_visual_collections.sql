-- Collections de visuels : regroupement optionnel (ex. "Automne 2026",
-- "Motifs floraux") pour organiser la banque de visuels.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

create table if not exists public.visual_collections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.visual_collections enable row level security;

create policy "Les employés lisent les collections" on public.visual_collections
  for select using (auth.role() = 'authenticated');
create policy "Les employés créent des collections" on public.visual_collections
  for insert with check (auth.role() = 'authenticated');
create policy "Les employés modifient des collections" on public.visual_collections
  for update using (auth.role() = 'authenticated');
create policy "Les employés suppriment des collections" on public.visual_collections
  for delete using (auth.role() = 'authenticated');

-- Optionnelle : un visuel peut ne pas être classé dans une collection.
alter table public.visuals
  add column if not exists collection_id uuid references public.visual_collections(id) on delete set null;
