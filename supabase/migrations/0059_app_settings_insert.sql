-- Créer le jeu de réglages d'une boutique.
--
-- La migration 0054 n'a posé qu'une politique d'écriture : « update ». Elle
-- suffisait tant qu'il n'existait que deux lignes, créées par la migration
-- elle-même. Depuis la 0058, une boutique peut avoir son propre jeu — mais
-- sa ligne n'existe pas tant qu'on ne lui a rien enregistré, et rien ne
-- permettait de la créer : l'enregistrement échouait sur « Cannot coerce the
-- result to a single JSON object », l'update ne touchant aucune ligne.
--
-- Même restriction que l'update : administrateurs seulement, un réglage ici
-- changeant l'interface de tout le monde.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

drop policy if exists "app_settings_insert" on public.app_settings;
create policy "app_settings_insert" on public.app_settings
  for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
