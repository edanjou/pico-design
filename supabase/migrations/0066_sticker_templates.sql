-- Module "Autocollants" : modèles de planches d'étiquettes personnalisées.
-- Une planche est préparée par le graphiste (visuel sans le nom) ; Pico Design
-- n'y ajoute que le texte, dans des zones dessinées sur le modèle. Taper un nom
-- produit la planche prête à imprimer et à découper à la Graphtec.
--   * width_mm / height_mm : la feuille de la planche ;
--   * artwork_path : visuel de la planche (imprimé, sous le texte) ;
--   * marks_path   : codes et repères Graphtec (imprimés, par-dessus) ;
--   * guide_path   : gabarit de guidage des découpes (aide au placement des
--                    zones, jamais imprimé ; téléchargeable avec la planche) ;
--   * zones        : zones de texte, en mm depuis le coin haut-gauche de la
--                    feuille (voir lib/stickers/types.ts).
-- Fichiers dans le bucket privé "stickers", sous <id>/.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

create table if not exists public.sticker_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  width_mm numeric not null check (width_mm > 0),
  height_mm numeric not null check (height_mm > 0),
  artwork_path text,
  marks_path text,
  guide_path text,
  zones jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sticker_templates enable row level security;

drop policy if exists "Les employés gèrent les modèles d'autocollants" on public.sticker_templates;
create policy "Les employés gèrent les modèles d'autocollants" on public.sticker_templates
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public)
values ('stickers', 'stickers', false)
on conflict (id) do nothing;

drop policy if exists "Employés lisent/écrivent stickers" on storage.objects;
create policy "Employés lisent/écrivent stickers" on storage.objects
  for all using (bucket_id = 'stickers' and auth.role() = 'authenticated')
  with check (bucket_id = 'stickers' and auth.role() = 'authenticated');
