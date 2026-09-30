-- Un jeu de couleurs par boutique.
--
-- app_settings n'acceptait que deux jeux : « admin » (l'administration
-- interne) et « tool » (l'Outil Shopify). On autorise maintenant un jeu par
-- domaine de boutique, pour qu'un client venant de telle boutique voie ses
-- couleurs à elle.
--
-- « tool » reste le jeu par défaut : une boutique sans réglages propres en
-- hérite, et on n'a donc rien à créer pour chaque nouvelle boutique.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.app_settings
  drop constraint if exists app_settings_scope_check;

-- Soit l'un des deux jeux historiques, soit un nom de domaine.
alter table public.app_settings
  add constraint app_settings_scope_check check (
    scope in ('admin', 'tool')
    or scope ~ '^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$'
  );
