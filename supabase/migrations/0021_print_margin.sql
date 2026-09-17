-- Marge d'impression : bande blanche ajoutée EN PLUS autour de la page
-- normale (fond perdu compris) dans le PDF final — la page est agrandie en
-- conséquence, l'image imprimée garde sa taille normale. Distincte de la
-- marge de protection (safety_margin_*_mm), qui reste un simple guide
-- visuel à l'écran et n'apparaît jamais dans le PDF.
-- Par défaut à 0 : aucun changement pour les modèles existants.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.templates
  add column if not exists print_margin_x_mm numeric not null default 0,
  add column if not exists print_margin_y_mm numeric not null default 0;
