-- Corregir la unidad (g/ml) de cualquier producto del catálogo compartido.
-- Los datos de Open Food Facts a veces no traen la cantidad del envase; cualquiera de los dos puede ajustarla.
create or replace function public.set_product_unit(p_barcode text, p_unit text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if p_unit not in ('g','ml') then raise exception 'unidad no válida'; end if;
  update public.products set unit = p_unit where barcode = p_barcode;
end $$;

revoke all on function public.set_product_unit(text, text) from public, anon;
grant execute on function public.set_product_unit(text, text) to authenticated;

-- La leche del catálogo no trae cantidad en Open Food Facts: es un líquido
update public.products set unit = 'ml' where barcode = '8480000104953';
