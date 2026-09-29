-- Limitation de débit des routes publiques (lien Shopify).
--
-- Depuis l'ouverture du lien public, /api/design/pdf et ses voisines sont
-- joignables sans compte, et la clé qui y donne accès est visible dans le
-- code source de la boutique. Ces routes composent des images lourdes : rien
-- n'empêchait jusqu'ici d'en demander en boucle.
--
-- Compteur en base plutôt qu'en mémoire : sur Vercel, chaque requête peut
-- tomber sur une instance différente, un compteur en mémoire ne verrait donc
-- qu'une fraction du trafic. Postgres est la seule mémoire partagée de la
-- pile.
-- À exécuter dans Supabase : Dashboard > SQL Editor > coller ce fichier > Run

create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 0,
  expires_at timestamptz not null
);

create index if not exists rate_limits_expires_idx on public.rate_limits (expires_at);

-- Fenêtre glissante simple : le compteur repart à 1 dès que la fenêtre est
-- passée. Tout se fait en UNE instruction, donc sans course entre deux
-- requêtes simultanées — deux appels en parallèle ne peuvent pas lire le
-- même compteur et l'écraser l'un l'autre.
create or replace function public.bump_rate_limit(p_key text, p_window_seconds integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- Ménage occasionnel : le faire à chaque appel coûterait plus cher que le
  -- comptage lui-même, et les lignes périmées sont de toute façon ignorées.
  if random() < 0.01 then
    delete from public.rate_limits where expires_at < now() - interval '1 hour';
  end if;

  insert into public.rate_limits (key, count, expires_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set count = case when rate_limits.expires_at < now() then 1 else rate_limits.count + 1 end,
        expires_at = case
          when rate_limits.expires_at < now() then now() + make_interval(secs => p_window_seconds)
          else rate_limits.expires_at
        end
  returning count into v_count;

  return v_count;
end;
$$;

-- Personne n'accède à cette table directement : les routes passent par la
-- clé de service, et la fonction est en security definer.
alter table public.rate_limits enable row level security;
