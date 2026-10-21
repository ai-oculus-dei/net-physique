-- Ajuste de tolerancia a erratas: una letra cambiada o de menos da ≈0.5 de parecido (p. ej. "gaspacho" ↔ "gazpacho").
-- Palabras de 5+ letras: parecido ≥ 0.5. Las cortas siguen necesitando coincidir como trozo exacto.
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
            or (length(w) >= 5 and word_similarity(w, public.norm_text(p.name || ' ' || coalesce(p.brand, ''))) >= 0.5)
          )
        ))
  order by (p.barcode = trim(q)) desc,
           word_similarity(t.nq, public.norm_text(p.name)) desc,
           similarity(t.nq, public.norm_text(p.name)) desc
  limit 40
$$;
