-- Filtros por persona (Platos: quién lo creó · Histórico: quién lo ha comido)

-- Nombres de los usuarios de la app (solo id y nombre de pila; los perfiles siguen siendo privados)
create or replace function public.app_users()
returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select u.id, coalesce(nullif(split_part(trim(p.display_name), ' ', 1), ''), split_part(u.email, '@', 1))
  from auth.users u left join public.profiles p on p.id = u.id
  where auth.uid() is not null
  order by u.created_at
$$;
revoke all on function public.app_users() from public, anon;
grant execute on function public.app_users() to authenticated;

-- Histórico compartido: además, quiénes lo han comido
drop function if exists public.shared_recent_products(int);
create function public.shared_recent_products(p_limit int default 60)
returns table (barcode text, last_grams numeric, last_at timestamptz, mine boolean, eaten_by uuid[])
language sql stable security definer set search_path = public as $$
  with ranked as (
    select l.barcode, l.grams, l.eaten_at, l.user_id,
           bool_or(l.user_id = auth.uid()) over (partition by l.barcode) as mine,
           max(l.eaten_at) over (partition by l.barcode) as last_any,
           row_number() over (partition by l.barcode order by (l.user_id = auth.uid()) desc, l.eaten_at desc) as rn
    from public.food_logs l
    where l.barcode is not null and auth.uid() is not null
  ),
  eaters as (
    select barcode, array_agg(distinct user_id) as eaten_by from ranked group by barcode
  )
  select r.barcode, r.grams, r.last_any, r.mine, e.eaten_by
  from ranked r join eaters e using (barcode)
  where r.rn = 1
  order by r.last_any desc
  limit greatest(1, least(p_limit, 300))
$$;
revoke all on function public.shared_recent_products(int) from public, anon;
grant execute on function public.shared_recent_products(int) to authenticated;
