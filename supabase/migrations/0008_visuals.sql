-- Ajoute la "Banque de visuels" : des patterns/images réutilisables
-- (SVG, PNG, JPG) qui peuvent être appliqués à un produit soit en plein
-- format (couvre toute la page), soit en mosaïque répétée (comme un
-- motif tissu/papier cadeau).
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

create table if not exists public.visuals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  file_path text not null,
  mime_type text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.visuals enable row level security;

create policy "Les employés lisent les visuels" on public.visuals
  for select using (auth.role() = 'authenticated');
create policy "Les employés créent des visuels" on public.visuals
  for insert with check (auth.role() = 'authenticated');
create policy "Les employés modifient des visuels" on public.visuals
  for update using (auth.role() = 'authenticated');
create policy "Les employés suppriment des visuels" on public.visuals
  for delete using (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public)
values ('visuals', 'visuals', false)
on conflict (id) do nothing;

create policy "Employés lisent/écrivent visuals" on storage.objects
  for all using (bucket_id = 'visuals' and auth.role() = 'authenticated')
  with check (bucket_id = 'visuals' and auth.role() = 'authenticated');

-- Un produit peut désormais être généré à partir d'un visuel de la
-- banque (plein format ou mosaïque) plutôt que d'un upload direct.
-- image_path reste la source réelle utilisée par la génération de PDF :
-- quand un visuel est appliqué, l'image composée (mise à l'échelle du
-- modèle) y est enregistrée une fois, comme s'il s'agissait d'un upload.
alter table public.products
  add column if not exists visual_id uuid references public.visuals(id) on delete set null,
  add column if not exists visual_mode text check (visual_mode in ('full', 'tile')),
  add column if not exists tile_size_mm numeric;
