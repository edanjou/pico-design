-- Pour la pastille : couleur du cercle (logo_color, déjà en place) et
-- couleur de la lettre à l'intérieur (logo_secondary_color), au choix
-- indépendamment.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.products
  add column if not exists logo_secondary_color text not null default '#FFFFFF'
    check (logo_secondary_color in (
      '#000000', '#FFFFFF', '#F8F1E9', '#DBBDF3', '#F4F2EE', '#EADCF9',
      '#631028', '#FF99CC', '#FF6633', '#E9EA93', '#FCC7B0'
    ));
