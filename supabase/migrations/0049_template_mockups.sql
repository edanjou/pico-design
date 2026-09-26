-- Plusieurs mockups (bundles « beauty shot ») par modèle : jusqu'ici un
-- modèle n'en avait qu'un seul, posé directement sur `templates`
-- (beauty_shot_xml_path + beauty_shot_overlay_opacities), avec un chemin de
-- stockage calé sur l'id du modèle (<templateId>/beautyshot.xml) — donc un
-- deuxième bundle écrasait le premier. Une table dédiée permet d'en avoir
-- autant qu'on veut (une tasse vue de gauche et de droite, un produit sous
-- plusieurs angles...), chacun avec son XML et ses images.
--
-- `xml_path` est la source de vérité : les images du bundle vivent TOUJOURS
-- dans le même dossier que son XML (voir beautyShotFolderOf, lib/pdf/
-- beautyShot.ts). C'est ce qui permet de reprendre les bundles existants
-- sans déplacer aucun fichier : leur ligne pointe simplement sur le chemin
-- actuel (<templateId>/beautyshot.xml), pendant que les nouveaux vont dans
-- mockups/<mockupId>/.
--
-- Les colonnes beauty_shot_* de `templates` restent en place (repli tant
-- que tout n'est pas migré), tout comme mask_path/shading_path (ancien
-- mockup masque+ombrage, laissé mono-mockup).
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

create table if not exists public.template_mockups (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  -- Libellé affiché au client et dans l'admin (« Vue de gauche »...).
  name text not null,
  -- Ordre d'affichage/navigation entre les mockups d'un même modèle.
  sort_order integer not null default 0,
  xml_path text not null,
  -- Opacité par surcouche, positionnelle et dans l'ordre des <overlay> du
  -- XML — même sémantique que templates.beauty_shot_overlay_opacities
  -- (voir 0044) : null/case manquante = 100 %.
  overlay_opacities integer[],
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists template_mockups_template_id_idx
  on public.template_mockups (template_id, sort_order);

alter table public.template_mockups enable row level security;

drop policy if exists "Les employés lisent les mockups" on public.template_mockups;
create policy "Les employés lisent les mockups" on public.template_mockups
  for select using (auth.role() = 'authenticated');

drop policy if exists "Les employés créent des mockups" on public.template_mockups;
create policy "Les employés créent des mockups" on public.template_mockups
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "Les employés modifient des mockups" on public.template_mockups;
create policy "Les employés modifient des mockups" on public.template_mockups
  for update using (auth.role() = 'authenticated');

drop policy if exists "Les employés suppriment des mockups" on public.template_mockups;
create policy "Les employés suppriment des mockups" on public.template_mockups
  for delete using (auth.role() = 'authenticated');

-- Reprise des bundles déjà configurés : une ligne par modèle qui en a un,
-- pointant sur les fichiers existants (aucun déplacement). `where not
-- exists` rend la migration rejouable sans créer de doublon.
insert into public.template_mockups (template_id, name, sort_order, xml_path, overlay_opacities)
select t.id, 'Mockup', 0, t.beauty_shot_xml_path, t.beauty_shot_overlay_opacities
from public.templates t
where t.beauty_shot_xml_path is not null
  and not exists (
    select 1 from public.template_mockups m where m.template_id = t.id
  );
