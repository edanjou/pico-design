-- Gabarit de guidage (ex. position des caméras sur un étui de téléphone) :
-- une image affichée par-dessus l'aperçu pour visualiser des repères
-- physiques du produit. Uniquement pour l'aperçu — jamais inclus dans le
-- PDF imprimé.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

insert into storage.buckets (id, name, public)
values ('overlays', 'overlays', false)
on conflict (id) do nothing;

create policy "Employés lisent/écrivent overlays" on storage.objects
  for all using (bucket_id = 'overlays' and auth.role() = 'authenticated')
  with check (bucket_id = 'overlays' and auth.role() = 'authenticated');

alter table public.templates
  add column if not exists overlay_path text;
