-- Schéma initial pour Pico Design
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run
-- (ou via `supabase db push` si tu utilises la CLI Supabase)

-- 1. Profils employés, liés à auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'employee' check (role in ('admin', 'employee')),
  created_at timestamptz not null default now()
);

-- Crée automatiquement un profil à l'inscription d'un utilisateur
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Modèles de produits (dimensions d'impression, fond perdu, logo)
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  width_mm numeric not null,
  height_mm numeric not null,
  bleed_mm numeric not null default 0,
  dpi integer not null default 300,
  logo_position text not null default 'bottom-right'
    check (logo_position in ('top-left', 'top-right', 'bottom-left', 'bottom-right', 'center')),
  logo_width_mm numeric not null default 20,
  logo_margin_mm numeric not null default 5,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 3. Jobs de génération (historique)
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id),
  source_image_path text not null,
  output_pdf_path text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'error')),
  error_message text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 4. Row Level Security — tous les employés connectés peuvent lire/écrire
--    (une seule "organisation" Pico ; pas de séparation multi-tenant pour l'instant)
alter table public.profiles enable row level security;
alter table public.templates enable row level security;
alter table public.jobs enable row level security;

create policy "Les employés voient tous les profils" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "Les employés lisent les modèles" on public.templates
  for select using (auth.role() = 'authenticated');
create policy "Les employés créent des modèles" on public.templates
  for insert with check (auth.role() = 'authenticated');
create policy "Les employés modifient des modèles" on public.templates
  for update using (auth.role() = 'authenticated');

create policy "Les employés voient les jobs" on public.jobs
  for select using (auth.role() = 'authenticated');
create policy "Les employés créent des jobs" on public.jobs
  for insert with check (auth.role() = 'authenticated');
create policy "Les employés modifient les jobs" on public.jobs
  for update using (auth.role() = 'authenticated');

-- 5. Buckets de stockage
--    uploads : images sources envoyées par les employés
--    outputs : PDF générés, prêts pour impression
--    assets  : logo Pico et autres fichiers fixes
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('outputs', 'outputs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do nothing;

create policy "Employés lisent/écrivent uploads" on storage.objects
  for all using (bucket_id = 'uploads' and auth.role() = 'authenticated')
  with check (bucket_id = 'uploads' and auth.role() = 'authenticated');

create policy "Employés lisent/écrivent outputs" on storage.objects
  for all using (bucket_id = 'outputs' and auth.role() = 'authenticated')
  with check (bucket_id = 'outputs' and auth.role() = 'authenticated');

create policy "Employés lisent assets" on storage.objects
  for select using (bucket_id = 'assets' and auth.role() = 'authenticated');

-- 6. Quelques modèles de départ, à ajuster selon le catalogue Pico réel
--    (dimensions au fini + fond perdu standard de 3mm)
insert into public.templates (name, width_mm, height_mm, bleed_mm, dpi, logo_position, logo_width_mm, logo_margin_mm)
values
  ('Cartes d''affaires 90×50mm', 90, 50, 3, 300, 'bottom-right', 15, 4),
  ('Impression photo 10×15cm (4×6po)', 100, 150, 0, 300, 'bottom-right', 20, 5),
  ('Affiche 12×18po', 304.8, 457.2, 5, 300, 'bottom-right', 40, 10)
on conflict do nothing;
