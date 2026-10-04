-- Module "Commandes" : retirer une commande de l'outil.
-- Une commande n'est pas SUPPRIMÉE : le webhook Shopify la recréerait au
-- prochain `orders/updated` (expédition, remboursement…). Elle est masquée :
--   * archived_at : date du retrait, null = commande visible.
-- Le webhook n'écrit jamais cette colonne (son upsert ne la nomme pas) : une
-- commande retirée le reste quand Shopify la met à jour. On peut la remettre
-- dans la liste depuis l'écran des commandes.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.orders
  add column if not exists archived_at timestamptz;
