# 🧬 Net Physique

PWA personal para gestionar dieta, entreno y físico. React + Vite + TypeScript, desplegada en GitHub Pages, con datos en Supabase.

- 🥗 **Diet** — escáner de código de barras, búsqueda (caché propia → Open Food Facts), histórico, registro por comida, kcal y macros vs objetivo. **Platos cocinados**: receta con ingredientes (g, ml, cucharadas, raciones) y peso final opcional → kcal y macros por 100 g; se registran como un alimento más.
- 🏋️ **Training** — catálogo de free-exercise-db + ejercicios propios, series/reps/peso, planificación con checkbox, mapa de calor muscular semanal, pasos, estimación de kcal (MET).
- 🧬 **Physique** — peso en ayunas diario, media semanal y tendencia, % grasa (Jackson-Pollock 3/7, US Navy, impedancia), calendario de cumplimiento, fotos privadas.
- ⚙️ **Ajustes** — tema oscuro/claro, datos personales, modo de gasto (dinámico / factor fijo / adaptativo), objetivos.

## Puesta en marcha

### 1. Supabase
1. Crea un proyecto en <https://supabase.com>.
2. **SQL Editor** → pega y ejecuta [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
3. **Authentication → Providers → Email**: desactiva *Allow new users to sign up* (y *Confirm email*).
4. **Authentication → Users → Add user** (marca *Auto confirm*):
   - `alvaro@netphysique.app` + contraseña
   - `lauri@netphysique.app` + contraseña
   En la app basta con escribir `alvaro` o `lauri` como usuario.
5. Edge Function (proxy a Open Food Facts con User-Agent y caché):
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase secrets set OFF_USER_AGENT="NetPhysique/1.0 (tu@email.com)"
   npx supabase functions deploy food-lookup
   ```
6. Importa los ejercicios (una vez, desde tu PC; la service_role **nunca** va al frontend):
   ```bash
   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service_role> npm run seed:exercises
   ```

### 2. Local
```bash
cp .env.example .env.local   # rellena URL y anon key
npm install
npm run dev
npm test
```

### 3. GitHub Pages
1. Repo → **Settings → Secrets and variables → Actions**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
2. **Settings → Pages → Source: GitHub Actions**.
3. Cada push a `main` ejecuta tests, compila y publica en `https://<usuario>.github.io/<repo>/`.
4. En el móvil: abrir la URL → *Compartir → Añadir a pantalla de inicio* → iniciar sesión **dentro** de la app instalada (en iOS la app instalada no comparte sesión con Safari).

## Seguridad
- RLS en todas las tablas: cada usuario solo lee/escribe sus registros (`user_id = auth.uid()`).
- `products` y `exercises` son catálogos compartidos (lectura/alta para autenticados; edición solo de lo propio).
- Fotos en bucket privado `progress-photos/{uid}/…`, servidas con URLs firmadas de 1 h.
- La anon key es pública por diseño; sin sesión no se puede leer nada.

## Fórmulas
| Cálculo | Fórmula |
|---|---|
| Basal | Mifflin-St Jeor; Katch-McArdle si hay % grasa de los últimos 60 días |
| Gasto dinámico | basal × 1.2 + kcal pasos + kcal entreno |
| Factor adaptativo | media 14 d de (gasto dinámico / basal), acotada [1.2, 2.0], mín. 7 días con pasos |
| Entreno | MET × kg × h (Compendium 2024); fuerza 3.5/5/6, duración estimada = series × (reps × 3 s + 90 s) |
| Pasos | zancada = altura × 0.415; 0.5 kcal/kg/km |
| Macros | P y G en g/kg; C = (kcal − 4P − 9G) / 4 |
| % grasa | Jackson-Pollock 3/7 + Siri; US Navy; impedancia manual |
| Peso | media semanal (L-D) + tendencia EWMA α = 0.1 |

Créditos: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense) · [Open Food Facts](https://world.openfoodfacts.org) (ODbL).
