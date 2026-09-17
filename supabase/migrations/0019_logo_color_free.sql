-- La couleur du logo/pastille est maintenant libre (sélecteur input
-- type="color"), pas seulement la palette Pico — voir lib/logoColors.ts.
-- Les anciennes contraintes n'autorisaient que les hex de la palette et
-- rejetaient tout insert/update avec une couleur hors palette.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.products
  drop constraint if exists products_logo_color_check,
  drop constraint if exists products_logo_secondary_color_check,
  add constraint products_logo_color_check check (logo_color ~* '^#[0-9a-f]{6}$'),
  add constraint products_logo_secondary_color_check check (logo_secondary_color ~* '^#[0-9a-f]{6}$');
