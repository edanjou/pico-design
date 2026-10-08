-- Thèmes : image de fond facultative, posée SOUS les photos du client (le
-- graphisme reste par-dessus). Visible là où il n'y a pas de photo ; sans
-- fond, la page reste blanche comme avant. Même bucket que le graphisme
-- ("overlays", sous themes/<id>/), donc rien à changer côté stockage.
-- Les formes des emplacements (cercle, polygone) vivent dans le JSON
-- `slots` existant : pas de colonne à ajouter pour elles.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.themes add column if not exists background_path text;
