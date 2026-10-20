// Importa free-exercise-db (yuhonas, Unlicense) a la tabla exercises.
// Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed:exercises
// La service_role solo se usa aquí, en local; nunca en el frontend.
import { createClient } from '@supabase/supabase-js'

const SRC = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const list = await (await fetch(SRC)).json()
const rows = list.map((e) => ({
  id: e.id,
  name: e.name,
  force: e.force,
  level: e.level,
  mechanic: e.mechanic,
  equipment: e.equipment,
  primary_muscles: e.primaryMuscles,
  secondary_muscles: e.secondaryMuscles,
  instructions: e.instructions,
  category: e.category,
  images: e.images,
  is_custom: false,
  created_by: null,
}))

for (let i = 0; i < rows.length; i += 200) {
  const { error } = await supabase.from('exercises').upsert(rows.slice(i, i + 200))
  if (error) throw error
  console.log(`${Math.min(i + 200, rows.length)}/${rows.length}`)
}
console.log('Ejercicios importados ✔')
