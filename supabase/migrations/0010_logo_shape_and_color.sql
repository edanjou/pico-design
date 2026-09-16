-- Remplace le choix figé de logo (noir/blanc/icon_cercle) par deux axes
-- indépendants : la forme (logo ou pastille) et la couleur (palette de
-- marque), appliquée dynamiquement au SVG plutôt que via des fichiers
-- pré-générés par couleur.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.products
  add column if not exists logo_shape text not null default 'logo'
    check (logo_shape in ('logo', 'pastille')),
  add column if not exists logo_color text not null default '#000000'
    check (logo_color in (
      '#000000', '#FFFFFF', '#F8F1E9', '#DBBDF3', '#F4F2EE', '#EADCF9',
      '#631028', '#FF99CC', '#FF6633', '#E9EA93', '#FCC7B0'
    ));

alter table public.products drop column if exists logo_variant;
