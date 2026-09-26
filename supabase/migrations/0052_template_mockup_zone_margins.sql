-- Où le visuel commence et s'arrête À L'INTÉRIEUR du mesh du mockup.
-- Le mesh couvre souvent toute la scène, alors que le produit (défini par le
-- masque) n'en occupe qu'une partie : sans ces marges, le visuel démarre au
-- bord de l'image et non au bord du produit. Exprimées en fraction de la
-- largeur de la zone (0.1 = 10 % rognés à gauche).
-- 0 par défaut = comportement actuel, donc aucun mockup existant ne bouge.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.template_mockups
  add column if not exists margin_left numeric not null default 0;
alter table public.template_mockups
  add column if not exists margin_right numeric not null default 0;

alter table public.template_mockups
  drop constraint if exists template_mockups_margins_check;
-- Chaque marge reste dans [0, 0.9] et, ensemble, elles laissent au moins
-- 10 % de largeur au visuel — sinon il n'y aurait plus rien à afficher.
alter table public.template_mockups
  add constraint template_mockups_margins_check check (
    margin_left >= 0 and margin_left <= 0.9
    and margin_right >= 0 and margin_right <= 0.9
    and margin_left + margin_right <= 0.9
  );
