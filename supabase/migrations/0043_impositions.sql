-- Module "Imposition" : impositions enregistrées. Chaque imposition a un nom, sa
-- configuration (feuille, machine, job Duplo, format, sens, fichiers et copies :
-- de quoi la rouvrir et la modifier) et son PDF, stocké dans le bucket privé
-- "imposition" sous impositions/<id>/ (imposition.pdf, et sources/ pour les PDF
-- téléversés). Les commandes et la mise en production viendront plus tard.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

create table if not exists public.impositions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  config jsonb not null,
  pdf_path text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists impositions_updated_at_idx on public.impositions (updated_at desc);

alter table public.impositions enable row level security;

drop policy if exists "Les employés lisent les impositions" on public.impositions;
drop policy if exists "Les employés créent des impositions" on public.impositions;
drop policy if exists "Les employés modifient des impositions" on public.impositions;
drop policy if exists "Les employés suppriment des impositions" on public.impositions;

create policy "Les employés lisent les impositions" on public.impositions
  for select using (auth.role() = 'authenticated');
create policy "Les employés créent des impositions" on public.impositions
  for insert with check (auth.role() = 'authenticated');
create policy "Les employés modifient des impositions" on public.impositions
  for update using (auth.role() = 'authenticated');
create policy "Les employés suppriment des impositions" on public.impositions
  for delete using (auth.role() = 'authenticated');
