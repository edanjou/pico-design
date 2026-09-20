-- Remplace le duo masque + ombrage par un bundle "beauty shot" : un fichier
-- XML (format Mediaclip gifting:beautyShot) qui décrit le fond, le masque,
-- la zone où placer le visuel du produit et les surcouches (overlay/ombre)
-- avec leur blend mode, accompagné des images qu'il référence. Le XML et
-- les images sont stockés dans le bucket "overlays" existant, comme
-- l'ancien masque/ombrage.
-- mask_path / shading_path restent en base pour les modèles pas encore
-- migrés (repli automatique tant que beauty_shot_xml_path est vide).
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.templates
  add column if not exists beauty_shot_xml_path text;
