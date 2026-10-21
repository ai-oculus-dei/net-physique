-- 1) Búsqueda de productos más tolerante: sin tildes, palabra a palabra (en cualquier orden) y con erratas.
-- 2) Histórico compartido: productos usados por cualquiera de los dos usuarios.

create extension if not exists unaccent;

-- unaccent no es IMMUTABLE; envoltorio para poder usarlo en índices y funciones
create or replace function public.f_unaccent(t text) returns text
language sql immutable parallel safe strict as $$ select public.unaccent('public.unaccent'::regdictionary, t) $$;

create or replace function public.norm_text(t text) returns text
language sql immutable parallel safe as $$
  select trim(regexp_replace(lower(public.f_unaccent(coalesce(t, ''))), '[^a-z0-9ñ]+', ' ', 'g'))
$$;

create index if not exists products_search_trgm on public.products
  using gin (public.norm_text(name || ' ' || coalesce(brand, '')) gin_trgm_ops);

-- Cada palabra buscada debe aparecer (como trozo) o parecerse mucho (erratas) a alguna palabra del nombre/marca.
-- Ordena por parecido con el nombre.
create or replace function public.search_products(q text) returns setof public.products
language sql stable as $$
  with t as (
    select public.norm_text(q) as nq,
           array_remove(regexp_split_to_array(public.norm_text(q), ' '), '') as words
  )
  select p.* from public.products p, t
  where p.barcode = trim(q)
     or (array_length(t.words, 1) > 0 and not exists (
          select 1 from unnest(t.words) w
          where not (
            public.norm_text(p.name || ' ' || coalesce(p.brand, '')) like '%' || w || '%'
            or (length(w) >= 4 and word_similarity(w, public.norm_text(p.name || ' ' || coalesce(p.brand, ''))) >= 0.6)
          )
        ))
  order by (p.barcode = trim(q)) desc,
           word_similarity(t.nq, public.norm_text(p.name)) desc,
           similarity(t.nq, public.norm_text(p.name)) desc
  limit 40
$$;

-- Histórico compartido: último uso de cada producto por cualquiera de los dos.
-- Solo expone código y cantidad (los registros siguen siendo privados).
-- La cantidad sugerida es la propia más reciente; si nunca lo comiste, la del otro.
create or replace function public.shared_recent_products(p_limit int default 60)
returns table (barcode text, last_grams numeric, last_at timestamptz, mine boolean)
language sql stable security definer set search_path = public as $$
  with ranked as (
    select l.barcode, l.grams, l.eaten_at,
           bool_or(l.user_id = auth.uid()) over (partition by l.barcode) as mine,
           max(l.eaten_at) over (partition by l.barcode) as last_any,
           row_number() over (partition by l.barcode order by (l.user_id = auth.uid()) desc, l.eaten_at desc) as rn
    from public.food_logs l
    where l.barcode is not null and auth.uid() is not null
  )
  select barcode, grams, last_any, mine from ranked where rn = 1
  order by last_any desc
  limit greatest(1, least(p_limit, 300))
$$;

revoke all on function public.shared_recent_products(int) from public, anon;
grant execute on function public.shared_recent_products(int) to authenticated;
