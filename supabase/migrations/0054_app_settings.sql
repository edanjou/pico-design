-- Identité visuelle réglable depuis le module Paramètres : couleurs,
-- typographie et logos, en DEUX jeux indépendants — « admin » pour
-- l'administration interne, « tool » pour l'Outil Shopify vu par les clients.
-- Une ligne par jeu ; les deux sont créées vides, et un jeu vide rend
-- exactement l'habillage actuel (les valeurs par défaut vivent dans
-- lib/appSettings.ts, reprises de app/globals.css).
--
-- colors/typography en jsonb plutôt qu'une colonne par réglage : la liste va
-- bouger, et chaque ajout coûterait sinon une migration.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

create table if not exists public.app_settings (
  scope text primary key check (scope in ('admin', 'tool')),
  colors jsonb not null default '{}'::jsonb,
  typography jsonb not null default '{}'::jsonb,
  -- Chemins dans le bucket « assets » (privé : servis par
  -- /api/settings/[scope]/asset/[slot], jamais par une URL publique).
  logo_path text,
  favicon_path text,
  share_image_path text,
  -- Polices d'interface téléversées (corps et titres). Fichiers au même
  -- endroit que les images ci-dessus, d'où des colonnes plutôt qu'une entrée
  -- dans `typography`, qui ne contient que des nombres.
  font_body_path text,
  font_heading_path text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.app_settings (scope)
values ('admin'), ('tool')
on conflict (scope) do nothing;

alter table public.app_settings enable row level security;

-- Lecture : tout utilisateur authentifié — l'habillage est lu à chaque rendu
-- de page, y compris par un designer ou un gestionnaire.
drop policy if exists "app_settings_select" on public.app_settings;
create policy "app_settings_select" on public.app_settings
  for select using (auth.role() = 'authenticated');

-- Écriture : administrateurs seulement. Première table du projet à
-- restreindre par rôle — les autres s'arrêtent à « authenticated » — parce
-- qu'un réglage ici change l'interface de tout le monde.
drop policy if exists "app_settings_update" on public.app_settings;
create policy "app_settings_update" on public.app_settings
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
