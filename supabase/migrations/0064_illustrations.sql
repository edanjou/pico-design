-- Module "Illustrations" : banque d'illustrations que le client de l'Outil
-- Shopify pose sur son design comme un calque (déplacé, redimensionné,
-- pivoté), imprimées telles quelles. Distinct des Visuels, qui servent de
-- FOND au produit.
--   * name      : affiché dans la banque, et cherché par le client ;
--   * file_path : le fichier, dans le bucket privé "illustrations" ;
--   * mime_type : PNG, JPEG, WebP ou SVG, lu dans le contenu du fichier.
-- Les fichiers ne sont jamais publics : l'Outil Shopify les reçoit en URL
-- signées, y compris en mode public (lien de personnalisation).
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

create table if not exists public.illustrations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  file_path text not null,
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.illustrations enable row level security;

drop policy if exists "Les employés gèrent les illustrations" on public.illustrations;
create policy "Les employés gèrent les illustrations" on public.illustrations
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public)
values ('illustrations', 'illustrations', false)
on conflict (id) do nothing;

drop policy if exists "Employés lisent/écrivent illustrations" on storage.objects;
create policy "Employés lisent/écrivent illustrations" on storage.objects
  for all using (bucket_id = 'illustrations' and auth.role() = 'authenticated')
  with check (bucket_id = 'illustrations' and auth.role() = 'authenticated');
