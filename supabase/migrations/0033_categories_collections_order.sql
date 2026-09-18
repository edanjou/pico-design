-- Ordre personnalisé (glisser-déposer) des catégories et des collections
-- (produits, visuels).
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.categories add column if not exists sort_order integer not null default 0;
alter table public.product_collections add column if not exists sort_order integer not null default 0;
alter table public.visual_collections add column if not exists sort_order integer not null default 0;

-- Initialise l'ordre existant sur l'ordre alphabétique actuel, pour que rien
-- ne saute visuellement avant le premier réordonnancement manuel.
with ranked as (
  select id, row_number() over (order by name) - 1 as rn from public.categories
)
update public.categories c set sort_order = ranked.rn from ranked where ranked.id = c.id;

with ranked as (
  select id, row_number() over (order by name) - 1 as rn from public.product_collections
)
update public.product_collections c set sort_order = ranked.rn from ranked where ranked.id = c.id;

with ranked as (
  select id, row_number() over (order by name) - 1 as rn from public.visual_collections
)
update public.visual_collections c set sort_order = ranked.rn from ranked where ranked.id = c.id;
