-- Dépôt temporaire des fichiers de l'outil de design (photos du client),
-- envoyés DIRECTEMENT du navigateur au stockage : Vercel refuse toute
-- requête de plus de 4,5 Mo avant même d'atteindre la route, et un design
-- recto verso avec des photos de téléphone dépasse vite cette taille.
-- L'outil dépose les fichiers ici par une adresse d'envoi signée (voir
-- app/api/design/stage), puis n'envoie que leur chemin aux routes de rendu,
-- qui les relisent (voir lib/design/stagedFiles.ts).
--
-- Bucket privé, sans policy : on n'y écrit que par adresse signée, et on
-- n'y lit que par la clé de service. 40 Mo par fichier, comme
-- lib/uploadLimits.ts ; images et PDF seulement.
-- Fichiers rangés par jour (<AAAA-MM-JJ>/<uuid>) : les anciens dossiers
-- peuvent être vidés sans risque.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('design-staging', 'design-staging', false, 41943040, array['image/*', 'application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
