-- Boutique d'origine d'une commande.
--
-- Le domaine vient de l'en-tête X-Shopify-Shop-Domain du webhook, et non de
-- SHOPIFY_SHOP_DOMAIN : la variable d'environnement décrit UNE boutique,
-- alors que l'en-tête dit laquelle a réellement envoyé la commande. C'est ce
-- qui permettra d'en brancher plusieurs sans rien changer.
--
-- Null pour les commandes reçues avant cette migration.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.orders
  add column if not exists shop_domain text;
