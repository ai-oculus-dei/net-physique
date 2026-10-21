-- Unidad de referencia de los valores nutricionales: por 100 g (sólidos) o por 100 ml (líquidos).
-- Open Food Facts guarda ambos en los campos *_100g; la unidad se deduce de la cantidad del envase.
alter table public.products add column if not exists unit text not null default 'g' check (unit in ('g','ml'));
-- unidad en la que se registró la cantidad (food_logs.grams guarda la cantidad en esa unidad)
alter table public.food_logs add column if not exists unit text not null default 'g' check (unit in ('g','ml'));
