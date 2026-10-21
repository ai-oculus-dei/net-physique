-- Avisos: peso en ayunas (diario) y % de grasa (cada 2 semanas). Se pueden desactivar en Ajustes.
alter table public.profiles
  add column if not exists remind_weight boolean not null default true,
  add column if not exists remind_bodyfat boolean not null default true;
