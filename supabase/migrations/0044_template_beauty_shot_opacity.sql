-- Intensité (0-100 %) de chaque surcouche du bundle mockup (beauty shot),
-- dans le même ordre que les <gifting:overlay> du XML (ex. [overlay, ombre]).
-- null ou case manquante = 100 % (comportement actuel, inchangé).
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.templates
  add column if not exists beauty_shot_overlay_opacities integer[];
