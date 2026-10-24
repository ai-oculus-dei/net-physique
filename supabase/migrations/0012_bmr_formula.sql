-- Fórmula del metabolismo basal: automática (Katch-McArdle si hay % de grasa de los últimos 60 días; si no, Mifflin-St Jeor),
-- o forzar una de las dos.
alter table public.profiles
  add column if not exists bmr_formula text not null default 'auto' check (bmr_formula in ('auto','mifflin','katch'));
