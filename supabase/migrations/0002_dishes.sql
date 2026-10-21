-- Platos cocinados: se guardan como productos (source = 'dish') con valores por 100 g
-- calculados de sus ingredientes. Compartidos entre ambos usuarios (se cocina juntos).

alter table public.products drop constraint if exists products_source_check;
alter table public.products add constraint products_source_check check (source in ('off','manual','dish'));
-- peso final del plato cocinado (si se pesa la olla); null = suma de ingredientes
alter table public.products add column if not exists dish_total_g numeric;
alter table public.products add column if not exists updated_at timestamptz default now();

create table public.dish_ingredients (
  id bigint generated always as identity primary key,
  dish_barcode text not null references public.products on delete cascade,
  position int not null default 0,
  barcode text references public.products on delete set null,
  name text not null,
  amount numeric not null,
  unit text not null default 'g' check (unit in ('g','ml','cda','cdta','ud')),
  grams numeric not null,
  kcal numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0
);
create index on public.dish_ingredients (dish_barcode);
alter table public.dish_ingredients enable row level security;

create policy "read dish ingredients" on public.dish_ingredients for select to authenticated using (true);
create policy "write dish ingredients" on public.dish_ingredients for all to authenticated
  using (exists (select 1 from public.products p where p.barcode = dish_barcode and p.source = 'dish'))
  with check (exists (select 1 from public.products p where p.barcode = dish_barcode and p.source = 'dish'));

-- los platos los puede editar o borrar cualquiera de los dos
create policy "update dishes" on public.products for update to authenticated using (source = 'dish') with check (source = 'dish');
create policy "delete dishes" on public.products for delete to authenticated using (source = 'dish');
