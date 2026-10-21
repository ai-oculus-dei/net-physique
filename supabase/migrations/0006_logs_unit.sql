-- Registros anteriores de productos líquidos: la cantidad ya estaba en ml (los valores eran por 100 ml),
-- solo faltaba la etiqueta de unidad.
update public.food_logs l set unit = 'ml'
from public.products p
where p.barcode = l.barcode and p.unit = 'ml' and l.unit <> 'ml';
