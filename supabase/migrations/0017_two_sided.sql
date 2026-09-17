-- Recto/recto-verso : certains modèles peuvent avoir un verso (ex. cartes,
-- signets), d'autres non (ex. étuis de téléphone). "two_sided" active la
-- configuration d'une image de verso sur les produits basés sur ce modèle,
-- ajoutée comme deuxième page du PDF généré (le verso n'a pas de logo).
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.templates
  add column if not exists two_sided boolean not null default false;

alter table public.products
  add column if not exists back_image_path text,
  add column if not exists back_visual_id uuid references public.visuals(id) on delete set null,
  add column if not exists back_visual_mode text check (back_visual_mode in ('full', 'tile')),
  add column if not exists back_tile_size_mm numeric,
  add column if not exists back_image_position_x numeric not null default 0.5
    check (back_image_position_x >= 0 and back_image_position_x <= 1),
  add column if not exists back_image_position_y numeric not null default 0.5
    check (back_image_position_y >= 0 and back_image_position_y <= 1);
