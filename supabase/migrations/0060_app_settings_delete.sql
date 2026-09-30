-- Retirer le jeu de réglages d'une boutique.
--
-- Les migrations précédentes ont posé « select » (0054), « update » (0054) et
-- « insert » (0059). Il manquait « delete » : on pouvait ajouter une boutique
-- depuis le module Paramètres, jamais en retirer une — une boutique ajoutée
-- par erreur, ou une boutique fermée, restait là pour toujours.
--
-- Même restriction que les autres écritures : administrateurs seulement.
-- Les deux jeux historiques (« admin », « tool ») ne sont PAS protégés ici
-- mais dans la route : la RLS dit qui peut supprimer, pas quoi — et un
-- garde-fou lisible, avec un message clair, vaut mieux qu'un refus opaque.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

drop policy if exists "app_settings_delete" on public.app_settings;
create policy "app_settings_delete" on public.app_settings
  for delete using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
