-- Module "Imposition" : placer des PDF d'impression sur une feuille selon un
-- format, avec les réglages de la découpeuse.
--   * imposition_sheets  : formats de feuille (ex. 12 x 18 po).
--   * imposition_cutters : profils de découpeuse (marges de la feuille,
--     espacement entre les pièces, décalage de calibration, et un fichier de
--     marques — PDF ou image de la taille de la feuille — superposé au recto).
-- Le fichier de marques est stocké dans le bucket privé "imposition".
-- Toutes les dimensions sont en mm (comme les modèles).
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

create table if not exists public.imposition_sheets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  width_mm numeric not null check (width_mm > 0),
  height_mm numeric not null check (height_mm > 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.imposition_cutters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  margin_top_mm numeric not null default 0 check (margin_top_mm >= 0),
  margin_right_mm numeric not null default 0 check (margin_right_mm >= 0),
  margin_bottom_mm numeric not null default 0 check (margin_bottom_mm >= 0),
  margin_left_mm numeric not null default 0 check (margin_left_mm >= 0),
  gutter_x_mm numeric not null default 0 check (gutter_x_mm >= 0),
  gutter_y_mm numeric not null default 0 check (gutter_y_mm >= 0),
  offset_x_mm numeric not null default 0,
  offset_y_mm numeric not null default 0,
  center_grid boolean not null default true,
  marks_path text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.imposition_sheets enable row level security;
alter table public.imposition_cutters enable row level security;

create policy "Les employés lisent les feuilles" on public.imposition_sheets
  for select using (auth.role() = 'authenticated');
create policy "Les employés créent des feuilles" on public.imposition_sheets
  for insert with check (auth.role() = 'authenticated');
create policy "Les employés modifient des feuilles" on public.imposition_sheets
  for update using (auth.role() = 'authenticated');
create policy "Les employés suppriment des feuilles" on public.imposition_sheets
  for delete using (auth.role() = 'authenticated');

create policy "Les employés lisent les découpeuses" on public.imposition_cutters
  for select using (auth.role() = 'authenticated');
create policy "Les employés créent des découpeuses" on public.imposition_cutters
  for insert with check (auth.role() = 'authenticated');
create policy "Les employés modifient des découpeuses" on public.imposition_cutters
  for update using (auth.role() = 'authenticated');
create policy "Les employés suppriment des découpeuses" on public.imposition_cutters
  for delete using (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public)
values ('imposition', 'imposition', false)
on conflict (id) do nothing;

create policy "Employés lisent/écrivent imposition" on storage.objects
  for all using (bucket_id = 'imposition' and auth.role() = 'authenticated')
  with check (bucket_id = 'imposition' and auth.role() = 'authenticated');

-- Point de départ : la feuille 12 x 18 po (304,8 x 457,2 mm).
insert into public.imposition_sheets (name, width_mm, height_mm)
values ('12 x 18 po', 304.8, 457.2);
