-- Correctif : recrée les policies RLS de "themes" (voir 0046_themes.sql) —
-- au cas où seule la création de la table aurait été exécutée, sans les
-- policies qui suivent. Sûr à relancer plusieurs fois (chaque policy est
-- supprimée puis recréée à l'identique).
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.themes enable row level security;

drop policy if exists "Les employés lisent les thèmes" on public.themes;
create policy "Les employés lisent les thèmes" on public.themes
  for select using (auth.role() = 'authenticated');

drop policy if exists "Les employés créent des thèmes" on public.themes;
create policy "Les employés créent des thèmes" on public.themes
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "Les employés modifient des thèmes" on public.themes;
create policy "Les employés modifient des thèmes" on public.themes
  for update using (auth.role() = 'authenticated');

drop policy if exists "Les employés suppriment des thèmes" on public.themes;
create policy "Les employés suppriment des thèmes" on public.themes
  for delete using (auth.role() = 'authenticated');
