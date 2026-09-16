-- Point focal (0..1) du recadrage de l'image d'un produit dans le cadrage
-- du modèle : 0.5/0.5 = centré (comportement précédent). Ajustable via le
-- formulaire produit, appliqué à l'aperçu et au PDF final.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.products
  add column if not exists image_position_x numeric not null default 0.5
    check (image_position_x >= 0 and image_position_x <= 1),
  add column if not exists image_position_y numeric not null default 0.5
    check (image_position_y >= 0 and image_position_y <= 1);
