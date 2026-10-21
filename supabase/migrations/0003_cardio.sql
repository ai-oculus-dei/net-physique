-- Cardio: actividades propias con cálculo de kcal por potencia, pulsaciones, distancia o MET.

-- Datos opcionales de cada actividad de cardio en un entreno
alter table public.workout_sets
  add column if not exists intensity text check (intensity in ('light','moderate','vigorous')),
  add column if not exists distance_km numeric,
  add column if not exists avg_watts numeric,
  add column if not exists avg_hr int,
  add column if not exists machine_kcal numeric,
  -- kcal netas calculadas de esta actividad (solo cardio; la fuerza se calcula por sesión)
  add column if not exists kcal numeric,
  add column if not exists kcal_method text;

-- Las 7 actividades de cardio de la app (fijas, no editables)
insert into public.exercises (id, name, force, level, mechanic, equipment, primary_muscles, secondary_muscles, instructions, category, images, is_custom, created_by)
values
  ('cardio_running', 'Running', null, 'beginner', null, 'body only',
    '{quadriceps,hamstrings,calves}', '{glutes}',
    '{"Con km y tiempo se calcula el ritmo y las kcal salen más precisas.","Si llevas pulsómetro, la FC media afina aún más."}', 'cardio', '{}', false, null),
  ('cardio_eliptica', 'Elíptica', null, 'beginner', null, 'machine',
    '{quadriceps,glutes}', '{hamstrings,calves}',
    '{"Las kcal de la máquina suelen sobrestimar; si llevas pulsómetro, usa la FC media."}', 'cardio', '{}', false, null),
  ('cardio_bici', 'Bici estática', null, 'beginner', null, 'machine',
    '{quadriceps}', '{glutes,hamstrings,calves}',
    '{"Si la bici muestra vatios medios, es el dato más fiable para calcular las kcal."}', 'cardio', '{}', false, null),
  ('cardio_assault', 'Assault Bike', null, 'intermediate', null, 'machine',
    '{quadriceps}', '{glutes,shoulders,chest,triceps}',
    '{"Usa los vatios medios de la pantalla si los tiene; si no, las kcal que marca la máquina."}', 'cardio', '{}', false, null),
  ('cardio_remo', 'Remo (ergómetro)', null, 'beginner', null, 'machine',
    '{lats,middle back,quadriceps}', '{hamstrings,biceps,glutes}',
    '{"Concept2: introduce los vatios medios de la sesión (o el ritmo convertido en vatios)."}', 'cardio', '{}', false, null),
  ('cardio_skierg', 'SkiErg', null, 'intermediate', null, 'machine',
    '{lats,triceps}', '{abdominals,shoulders}',
    '{"Introduce los vatios medios de la pantalla para un cálculo preciso."}', 'cardio', '{}', false, null),
  ('cardio_padel', 'Pádel', null, 'beginner', null, 'other',
    '{shoulders,quadriceps}', '{forearms,calves,abdominals}',
    '{"Elige la intensidad del partido; con pulsómetro, la FC media da un cálculo más personal."}', 'cardio', '{}', false, null)
on conflict (id) do update set
  name = excluded.name, primary_muscles = excluded.primary_muscles, secondary_muscles = excluded.secondary_muscles,
  instructions = excluded.instructions, category = excluded.category, equipment = excluded.equipment;
