-- Module "Commandes" : vendre un produit Pico déjà fait, tel quel.
-- Le client achète le produit sur Shopify sans passer par l'outil de design :
-- pas de design enregistré, mais la ligne de commande doit quand même dire
-- quoi imprimer. Le thème pose l'id du produit Pico (métachamp « Produit
-- Pico », custom.pico_product) en propriété de ligne `_pico_product` ; le
-- webhook le range ici, et l'écran des commandes propose le PDF du produit.
--   * product_id : le produit Pico de la ligne, null s'il n'y en a pas.
-- Un produit supprimé ne supprime pas la ligne : elle perd seulement son lien.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.order_items
  add column if not exists product_id uuid references public.products(id) on delete set null;
