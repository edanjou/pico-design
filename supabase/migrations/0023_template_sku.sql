-- Associe (facultativement) un modèle à un SKU du référentiel — un modèle
-- n'a pas forcément de SKU assigné, et supprimer le SKU ne supprime pas le
-- modèle (juste l'association).
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.templates
  add column if not exists sku_id uuid references public.skus(id) on delete set null;
