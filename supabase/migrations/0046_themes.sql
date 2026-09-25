-- Thèmes : visuels préfaits (un graphisme, avec transparence) attribués à
-- UN modèle précis, affichés PAR-DESSUS les photos du client. Le graphisme
-- laisse 1 à 3 emplacements (`slots`) où les photos du client viennent se
-- placer (recadrées pour remplir exactement chaque emplacement) — le reste
-- du graphisme (cadre, décor) reste visible par-dessus.
-- Réutilise le bucket de stockage "overlays" (déjà utilisé par les
-- gabarits/masques/ombrages de Modèles), sous themes/<id>/... — pas de
-- nouveau bucket ni de nouvelles policies de stockage nécessaires.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

create table if not exists public.themes (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  name text not null,
  overlay_path text not null,
  -- Tableau de 1 à 3 emplacements, chacun {positionX, positionY (centre,
  -- 0-1), widthRatio, heightRatio (0-1, relatifs à la page)} — voir
  -- lib/pdf/theme.ts (composeThemeImage) pour leur interprétation exacte.
  slots jsonb not null default '[]',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.themes enable row level security;

create policy "Les employés lisent les thèmes" on public.themes
  for select using (auth.role() = 'authenticated');
create policy "Les employés créent des thèmes" on public.themes
  for insert with check (auth.role() = 'authenticated');
create policy "Les employés modifient des thèmes" on public.themes
  for update using (auth.role() = 'authenticated');
create policy "Les employés suppriment des thèmes" on public.themes
  for delete using (auth.role() = 'authenticated');
