-- Net Physique · esquema inicial
-- Registros privados por usuario (RLS user_id = auth.uid()); catálogos compartidos.

create extension if not exists pg_trgm;

-- ---------- Perfil ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  sex text check (sex in ('male','female')),
  birthdate date,
  height_cm numeric,
  weight_kg numeric,
  activity_level int check (activity_level between 1 and 5) default 2,
  energy_mode text check (energy_mode in ('dynamic','factor','adaptive')) default 'adaptive',
  activity_factor numeric default 1.375,
  protein_g_kg numeric default 2.0,
  fat_g_kg numeric default 0.9,
  deficit_kcal numeric default 400,
  goal_weight_kg numeric,
  theme text check (theme in ('dark','light')) default 'dark',
  kcal_tolerance_pct numeric default 10,
  protein_min_pct numeric default 90,
  steps_goal int default 8000,
  onboarded boolean default false,
  updated_at timestamptz default now()
);

-- ---------- Catálogos compartidos ----------
create table public.products (
  barcode text primary key,
  name text not null,
  brand text,
  image_url text,
  kcal_100g numeric,
  protein_100g numeric,
  carbs_100g numeric,
  sugars_100g numeric,
  fat_100g numeric,
  sat_fat_100g numeric,
  fiber_100g numeric,
  salt_100g numeric,
  serving_g numeric,
  raw_json jsonb,
  source text check (source in ('off','manual')) default 'off',
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz default now()
);
create index products_name_trgm on public.products using gin (name gin_trgm_ops);

create table public.exercises (
  id text primary key,
  name text not null,
  force text,
  level text,
  mechanic text,
  equipment text,
  primary_muscles text[] default '{}',
  secondary_muscles text[] default '{}',
  instructions text[] default '{}',
  category text,
  images text[] default '{}',
  is_custom boolean default false,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz default now()
);
create index exercises_name_trgm on public.exercises using gin (name gin_trgm_ops);
create index exercises_primary on public.exercises using gin (primary_muscles);

-- ---------- Registros privados ----------
create type public.meal as enum ('desayuno','almuerzo','picoteo','comida','merienda','cena');

create table public.food_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  eaten_at timestamptz not null default now(),
  day date not null default current_date,
  meal public.meal not null,
  barcode text references public.products on delete set null,
  name text not null,
  grams numeric not null,
  kcal numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0
);
create index on public.food_logs (user_id, day);

create table public.workouts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null default current_date,
  title text,
  duration_min numeric,
  intensity text check (intensity in ('light','moderate','vigorous')) default 'moderate',
  kcal numeric default 0,
  planned boolean default false,  -- true = planificado, aún no hecho
  notes text,
  created_at timestamptz default now()
);
create index on public.workouts (user_id, day);

create table public.workout_sets (
  id bigint generated always as identity primary key,
  workout_id bigint not null references public.workouts on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  exercise_id text not null references public.exercises,
  position int default 0,
  sets int not null default 3,
  reps int not null default 10,
  weight_kg numeric,
  minutes numeric,              -- para cardio
  done boolean default false
);
create index on public.workout_sets (workout_id);

create table public.steps (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  steps int not null,
  kcal numeric,
  primary key (user_id, day)
);

create table public.weights (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  kg numeric not null,
  created_at timestamptz default now(),
  primary key (user_id, day)
);

create table public.body_fat (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null default current_date,
  method text not null check (method in ('jp3','jp7','navy','bia_foot','bia_hand')),
  inputs jsonb,
  pct numeric not null
);

create table public.photos (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null default current_date,
  path text not null,
  pose text
);

-- Snapshot diario de energía (para el calendario y el factor adaptativo)
create table public.daily_energy (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  bmr numeric,
  tdee numeric,
  target_kcal numeric,
  target_protein numeric,
  primary key (user_id, day)
);

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.exercises enable row level security;
alter table public.food_logs enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
alter table public.steps enable row level security;
alter table public.weights enable row level security;
alter table public.body_fat enable row level security;
alter table public.photos enable row level security;
alter table public.daily_energy enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['food_logs','workouts','workout_sets','steps','weights','body_fat','photos','daily_energy'] loop
    execute format('create policy "own rows" on public.%I for all to authenticated
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- catálogos: leer/insertar cualquier autenticado; editar/borrar solo lo propio
create policy "read products" on public.products for select to authenticated using (true);
create policy "insert products" on public.products for insert to authenticated with check (true);
create policy "update own products" on public.products for update to authenticated using (created_by = auth.uid());
create policy "read exercises" on public.exercises for select to authenticated using (true);
create policy "insert custom exercises" on public.exercises for insert to authenticated
  with check (is_custom and created_by = auth.uid());
create policy "update own exercises" on public.exercises for update to authenticated
  using (is_custom and created_by = auth.uid());
create policy "delete own exercises" on public.exercises for delete to authenticated
  using (is_custom and created_by = auth.uid());

-- perfil vacío automático al crear usuario
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Storage: fotos privadas en progress-photos/{uid}/... ----------
insert into storage.buckets (id, name, public) values ('progress-photos','progress-photos', false)
  on conflict do nothing;

create policy "own photos" on storage.objects for all to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- búsqueda de productos por nombre
create function public.search_products(q text) returns setof public.products
language sql stable as $$
  select * from public.products
  where name ilike '%' || q || '%' or brand ilike '%' || q || '%' or barcode = q
  order by similarity(name, q) desc limit 30
$$;
