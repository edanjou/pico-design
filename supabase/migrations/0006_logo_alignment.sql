-- Remplace la position du logo (5 positions figées + 1 marge) par un
-- alignement horizontal (gauche/centre/droite) + vertical (haut/bas),
-- avec une marge séparée pour les côtés et pour la hauteur.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

alter table public.templates
  add column if not exists logo_h_align text not null default 'right'
    check (logo_h_align in ('left', 'center', 'right')),
  add column if not exists logo_v_align text not null default 'bottom'
    check (logo_v_align in ('top', 'bottom')),
  add column if not exists logo_margin_x_mm numeric not null default 5,
  add column if not exists logo_margin_y_mm numeric not null default 5;

update public.templates set
  logo_h_align = case logo_position
    when 'top-left' then 'left'
    when 'bottom-left' then 'left'
    when 'top-right' then 'right'
    when 'bottom-right' then 'right'
    when 'center' then 'center'
    else 'right'
  end,
  logo_v_align = case logo_position
    when 'top-left' then 'top'
    when 'top-right' then 'top'
    when 'bottom-left' then 'bottom'
    when 'bottom-right' then 'bottom'
    when 'center' then 'bottom'
    else 'bottom'
  end,
  logo_margin_x_mm = logo_margin_mm,
  logo_margin_y_mm = logo_margin_mm
where logo_position is not null;

alter table public.templates drop column if exists logo_position;
alter table public.templates drop column if exists logo_margin_mm;
