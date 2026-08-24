# Ginebra ERP — estado del proyecto

Sistema de trazabilidad de mineral para Ginebra (Perú). Next.js 16 (App Router,
Turbopack) + TypeScript + Tailwind + Supabase (Postgres, Auth, Storage, RLS).

Repo: `C:\Users\Carlos\OneDrive\Desktop\FINANZAS\ginebra-erp` (git inicializado,
commits incrementales con mensajes descriptivos — revisar `git log` para el detalle
de cada paso).

## Diseño / marca

Paleta rehecha a pedido del usuario para que se parezca al logo de Ginebra
Trade Peru: azul marino + dorado, fondo claro, vista simple (antes era un
tema oscuro slate/teal). Tokens `navy-*` y `gold-*` definidos en
`src/app/globals.css` vía el bloque `@theme` de Tailwind v4 — **usar estas
clases (`bg-navy-800`, `text-gold-700`, etc.) en pantallas nuevas, no volver
a los tonos slate/teal oscuros de antes.** El header de `(app)/layout.tsx` es
la única franja oscura (navy, texto blanco); el resto de la app es clara.

## Cómo levantarlo

```bash
cd ginebra-erp
npm run dev                                   # servidor local, puerto 3000
node --env-file=.env.local scripts/migrate.mjs  # aplicar migraciones nuevas (o: npm run db:migrate)
```

`.env.local` (gitignored) ya tiene `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, y `SUPABASE_DB_HOST/PORT/NAME/USER/PASSWORD`
(conexión directa a Postgres, usada solo por los scripts de migración).
**Nunca pedirle al usuario la contraseña de la base de datos por chat** — si hace
falta, que la pegue directo en `.env.local` con un editor.

Login de prueba (administrador): `carlombar65@gmail.com` / `Ginebra2026Admin!`.

Proyecto Supabase: `ginebra-erp`, ref `bebaxicsoftxqnegwsuf`.

## Qué hay construido y probado en el navegador

**Auth y roles** — login/registro con email+contraseña. Cuentas nuevas quedan
inactivas hasta que un administrador les asigna rol (tabla `profiles`, roles:
operaciones, compras, calidad, comercial, contabilidad, gerencia, administrador).
Primer admin se activó con `scripts/bootstrap-admin.mjs`. Middleware renombrado a
`src/proxy.ts` (convención Next.js 16, ya no `middleware.ts`).

**Proveedores** (`/proveedores`) — alta, edición, baja (bloqueada si el proveedor
tiene lotes o programaciones asociadas).

**Lotes de compra** (`/lotes`) — alta, edición, baja (solo si `status='creado'`).
- Código automático `PROVEEDOR-AA-NN` (ej. `BUS-26-01`), editable a mano si hace falta.
- Formulario (`LotForm.tsx`, compartido entre nuevo/editar) cubre **solo** transporte,
  peso y negociación — sin mina de origen ni conductor (se sacaron a pedido del
  usuario), sin ley de laboratorio (no existe a esta altura del proceso).
- Transportista es un selector fijo (`src/lib/carriers.ts`): Jose Miguel Rodriguez /
  Laurion Company — únicos dos transportistas reales del negocio.
- Panel "Pago provisional sugerido": lee oro/plata **en vivo** (ver abajo) + plomo
  cargado a mano, y con una **ley estimada** (Au g/t, Ag g/t, Pb % — no es de
  laboratorio, es un supuesto para el pago inicial) calcula el prorrateo real que usa
  el negocio: `precio_por_gramo × %pagable_inicial × ley` por metal, sumado da el
  precio unitario USD/TMH, × TMH da el total. Fórmula verificada contra un ejemplo
  real que dio el usuario (Au 4 g/t, Ag 900 g/t, Pb 0.5%, 35 TMH → coincide). Botón
  "Usar sugerido" copia el precio unitario al campo de precio provisional.
- La ley estimada y el % pagable inicial son totalmente editables por lote.

**Precintos** (`/precintos`) — alta (asignado a un lote o "en stock"), y la
cadena de estados completa: disponible → colocado → verificado → abierto (con
motivo) / anulado (con motivo) en cualquier punto. Filtro por estado. Roles
permitidos calcados de la política RLS de `seals` (operaciones, calidad,
gerencia, administrador — **no** compras, a diferencia de lotes).

**Detalle de lote / transporte / pesaje** (`/lotes/[id]`) — el código del lote en
la lista ahora lleva acá en vez de a texto plano. Muestra precintos asignados
(solo lectura, con link a `/precintos` para gestionarlos), eventos de transporte
(salida, transportista, tarifa S/ por TMH, seguridad, incidentes) y pesajes
(inicial/oficial/regularización, con cálculo automático de neto = bruto − tara si
no se carga a mano, y una comparación automática oficial vs. inicial). Registrar
una salida o un pesaje oficial **avanza automáticamente** `purchase_lots.status`
(creado → en_transito → pesado), nunca hacia atrás. `src/lib/lot-status.ts` tiene
el orden y las etiquetas de estado, compartido entre la lista y el detalle.

También en `/lotes/[id]`: **recepción en molino** (supervisor, ubicación,
incidentes — un solo registro por lote) y **conminución + big bags** (un solo
registro de conminución por lote — así lo confirmó el usuario, se muele en una
sola tanda — con big bags cargados uno por uno a medida que salen del molino,
~1.5 TM cada uno con margen de fallo; se pesan individualmente, no se reparte un
total). Código de big bag automático `GIN-<CÓDIGO_LOTE>-BBnn` (ej.
`GIN-BUS-26-05-BB01`), secuencial por lote. Muestra el total cargado en big bags
vs. lo que declaró el molino (`processed_tons`) con una diferencia resaltada en
rojo si supera 50 kg — es un chequeo de control, no bloquea nada. Registrar la
recepción o la conminución también avanza el estado del lote (recibido_molino,
conminuido).

También **Laboratorio**: un solo resultado por lote (muestra compuesta de todo
el lote, no por big bag — confirmado con el usuario). Un solo laboratorio por
ahora, sin comparación entre dos laboratorios (si más adelante se manda la
misma muestra a dos labs, hay que agregar esa lógica). Au/Ag/Pb del
laboratorio se muestran junto a la ley estimada del lote, con un aviso (no
bloqueo) si el resultado real da **menor** al estimado — regla de negocio del
usuario: la ley real debería ser siempre mayor o igual a la que se usó para
el pago provisional. As/Sb/S/humedad se registran pero no afectan el pago al
proveedor en esta etapa (la humedad sí importa para la venta a PY, más
adelante). Tabla nueva: `lab_analyses` (migración 0010). Registrar el
resultado avanza el estado del lote a `en_laboratorio`.

También **Valorización definitiva y liquidación** — la fórmula real (confirmada
con el usuario): se reusa `lib/contract.ts` (`estimateLot()`), con la ley REAL
de laboratorio en vez de la estimada, y el mismo precio de metales que se usó
en el pago provisional (no uno nuevo del día de la liquidación). El resultado
es literalmente "valor de venta a PY − costos hasta la venta − margen objetivo
(`ganancia_objetivo_usd`, hoy USD 400/TM)" — eso es lo que se le paga al
proveedor. El saldo pendiente resta el precio provisional **completo** ya
pagado (no un adelanto parcial). Un solo registro por lote (persistido, para
auditoría), con vista previa antes de guardar. Tabla nueva: `lot_settlements`
(migración 0011). Roles distintos a las demás secciones: compras, contabilidad,
gerencia, administrador (no operaciones/calidad — es cierre financiero).
Registrar la liquidación avanza el estado del lote a `valorizado`.

Ojo con dos cosas que se descubrieron construyendo esto:
- Las columnas `estimated_price_au/ag/pb` de `purchase_lots` existían desde la
  migración 0004 pero **nunca se llenaban** — `LotForm` ahora sí las guarda
  (precio de oro/plata/plomo del momento de la carga). Los lotes viejos no
  tienen este dato salvo que se los edite y regrabe una vez (rellena con el
  precio en vivo del momento de la edición, no el original — más o menos
  razonable si no cambió mucho el precio).
- Los botones "Eliminar" de esta pantalla (transporte, pesaje, molino,
  conminución, big bag, laboratorio, liquidación) **tragaban los errores en
  silencio** — si el borrado fallaba (ej. borrar un análisis de laboratorio
  que una liquidación todavía referencia), no pasaba nada visible y parecía
  que el botón no hacía nada. Ya está resuelto: ahora se muestra el motivo
  debajo del botón.

También **Traslado a almacén** y **Cierre de compra** — con esto se completó
el flujo de compra entero (Fase 1, ver "Qué falta" más abajo). Traslado a
almacén es solo evidencia fotográfica (confirmado con el usuario, sin
formulario): sube a un bucket privado de Supabase Storage (`lot-photos`) y
queda registrada en la tabla genérica `documents` ya existente
(`entity_type='purchase_lot'`, `doc_type='foto_almacen'`); se muestra con URLs
firmadas (1 hora) porque el bucket no es público. Subir la primera foto avanza
el lote a `en_almacen`. El cierre de compra es manual y **solo se habilita si
la liquidación ya está marcada como pagada** (`lot_settlements.paid_at`,
seteado con un botón "Marcar como pagado" — no hay fecha editable, es "ahora").
No hay forma de reabrir un lote cerrado desde la UI a propósito. Migración
0012: bucket + políticas de Storage, `DELETE` para `documents` (tenía
SELECT/INSERT/UPDATE desde 0001 pero le faltaba, mismo patrón de siempre), y
las columnas `paid_at`/`paid_by` en `lot_settlements`.

**Con esto, los 9 puntos de la Fase 1 (compra) están completos** — probado de
punta a punta: lote → precintos → transporte → pesaje → molino → conminución →
laboratorio → valorización → almacén → cierre, cada paso avanzando el estado
del lote correctamente.

**Programación / calendario** (`/calendario`) — grilla mensual, dos tipos de
programación de volquete: *compra* (llegada de mina, celeste) y *despacho* (venta a
PY en Lima, violeta), con estado (programado/confirmado/completado/cancelado) y
borrado manual.

**Fase 2 (venta a PY) — arrancada.** El usuario pidió saltear blending por
completo. Hecho hasta ahora:
- **Big bags** (`/big-bags`) — inventario global de todos los bolsones
  (cualquier lote de compra), filtrable por estado (disponible/reservado/
  despachado/recibido_py/liquidado). Mismo patrón visual que `/precintos`.
- **Lotes de venta** (`/ventas`) — se arman a mano: se tildan big bags
  disponibles de la lista (**pueden ser de distintos lotes de compra**,
  confirmado con el usuario) y se crea el lote de venta con código
  automático `VTA-AA-NN` (reusa `next_lot_seq('VTA', año)`, el mismo
  generador de código de los lotes de compra). Se pueden sacar/agregar big
  bags mientras el lote está en estado `armado`; borrar el lote libera los
  bolsones de vuelta a `disponible`. Tabla nueva: `sale_lots` (migración
  0013), con `sale_lot_id` agregado a `big_bags`.
- `DeleteRowButton` y `ActionButton` se movieron de `lotes/[id]/` a
  `src/components/` porque ahora los usan tanto compra como venta.
- **Despacho + recepción en PY** (`/ventas/[id]`) — evento único por lote de
  venta (no una tabla de log aparte, como recepción en molino del lado de
  compra): columnas directas en `sale_lots` (migración 0014). Cada paso
  tiene un botón "Deshacer" que revierte el estado y limpia los campos —
  útil porque es fácil equivocarse la fecha/transportista al cargar.
  Despachar/recibir sincroniza el estado de todos los big bags del lote
  (`reservado` → `despachado` → `recibido_py`), así `/big-bags` queda al
  día. Probado de punta a punta: armado → despachado → recibido en PY,
  con deshacer en cada paso. La recepción en PY también tiene **peso
  oficial del trailer** (por lote de venta / camión), comparado contra la
  suma de big bags que Ginebra ya tenía — mismo control que el pesaje de
  Trujillo del lado de compra.
- **Muestreo conjunto en PY** (`/muestreo`) — el usuario explicó el proceso
  real: al llegar a Lima se pesan los trailers, se rompen los big bags en
  una plataforma y se **mezclan** — varios lotes de venta se convierten en
  uno solo para el muestreo. Por eso la agrupación es **automática, no
  manual**: "Crear muestreo" junta TODOS los lotes de venta en estado
  `recibido_py` que todavía no fueron muestreados (confirmado con el
  usuario — así es como funciona en la realidad, no hay selección de a
  uno). El resultado de laboratorio usa los mismos elementos que ya se
  cargan del lado de compra (Au/Ag/Pb + As/Sb/S/humedad). Tabla nueva:
  `py_sample_batches` (migración 0015), código `MUE-AA-NN`. Se puede
  deshacer el muestreo (libera los lotes de venta) **solo mientras no
  tenga resultado de laboratorio cargado** — después de eso es un
  registro de laboratorio real, no se borra.

**El contrato real con PY** (`PYCP-202656 - XXXXX - AG ORES _Vs 30.06.26 (1).docx`,
en la carpeta del proyecto, **no está en git a propósito** — es un documento
comercial sensible, no se sube) **se leyó con permiso del usuario** y confirmó
que `contract_settings` ya tenía los números reales del contrato (no eran
de prueba): Ag 72.5%/74.5% (banda 900 g/t), Au 68.5%/70.5% (banda 6 g/t), Pb
60% con descuento previo de 3.5%, merma 0.30%. El "lote" que menciona el
contrato para ensayes ("lote por lote para plata y oro") es, según el
usuario, la carga mensual completa — coincide con como ya funciona
`/muestreo` (todo mezclado, un solo resultado), no hizo falta cambiar nada
ahí.

**Liquidación de PY** (`/muestreo/[id]`) — construido directamente del texto
del contrato:
- **Ensaye provisional** (renombrado desde el resultado único que había
  antes, prefijo `prov_`) — laboratorio local, rápido (cláusula 11.1).
- **Liquidación provisional (90%)** — el usuario pidió ser fiel al contrato:
  el precio de cada metal es el **promedio de los últimos 5 días** de
  `daily_metal_prices` anteriores a la fecha de factura (no el precio del
  día, cláusula 5.1). Con poco historial usa los días que haya (se degrada
  bien, no rompe). El pago es 90% del valor estimado total (`adelanto_py_pct`
  de `contract_settings`, que ya estaba en la base sin usar — resultó ser
  exactamente esto). Botón para marcar como pagado.
- **Ensaye final** — conjunto (Ginebra + PY), laboratorio internacional
  (Alex Stewart o Alfred H Knight, cláusula 11.2). Campos `final_*`
  paralelos a los `prov_*`.
- **Ventana de fijación** — 30 días calendario desde el lunes de la semana
  siguiente a la entrega ("M+1", cláusula 8.1), calculada sola al crear el
  muestreo (usando la fecha de recepción en PY más antigua de los lotes
  agrupados) pero **editable** — es mi interpretación de un texto de
  contrato ambiguo, así que si no coincide con la práctica real se puede
  corregir a mano sin tocar código.
- **Fijación por metal** — Au, Ag y Pb se fijan de forma independiente
  (fecha + precio) dentro de la ventana. Si la ventana venció sin fijar, un
  botón "Fijar con cierre de ventana" toma el precio de `daily_metal_prices`
  más cercano al último día de la ventana (cláusula 8.1, PY fija si el
  proveedor no lo hizo). Se puede deshacer una fijación.
- **Liquidación final** — reusa `estimateLot()` (la misma fórmula ya
  verificada del lado de compra) con la ley final y los tres precios
  fijados; el saldo resta el pago provisional ya hecho. Botón para marcar
  como pagado.
- Probado de punta a punta con números reales del contrato: los cálculos
  cierran exactos (ej. $2,988 valor 100% → $2,689 provisional 90% →
  $2,909 final → $220 de saldo a favor de Ginebra).
- Los borrados de ensaye/muestreo están bloqueados una vez que hay una
  liquidación calculada sobre ellos (no se puede borrar un registro
  financiero real por accidente) — a propósito, no es un bug.

**Falta de Fase 2** (sin blending, por pedido del usuario): márgenes por
lote de compra/venta (comparar lo pagado al proveedor vs. lo cobrado a PY,
cruzando por los big bags de cada lote de venta).

**Precios internacionales** (`/precios`) — oro y plata se leen **en vivo** de
inversoro.es (la fuente que pidió el usuario) en cada carga de página. Plomo se
carga a mano (esa fuente no lo tiene). Guarda un snapshot diario en
`daily_metal_prices` con un `% de referencia` configurable (default 40%).

### Detalle técnico importante: precios en vivo

`src/lib/live-metal-prices.ts` lee inversoro.es reproduciendo la llamada JSON que
usa su propio widget (`/charts/data/<token>/?xignite_code=XAU|XAG&...`, token que se
extrae de la página en cada llamada). **El `fetch()` nativo de Node es bloqueado por
esa web (huella TLS de Cloudflare), pero `curl` no** — por eso el código hace
`execFile("curl", ...)` en vez de usar `fetch()`. Funciona bien en Windows local
(`curl.exe` está en System32). **Si el proyecto se despliega en un hosting sin curl
disponible (algunos entornos serverless), esto va a fallar silenciosamente y hay que
revisarlo** — probablemente haya que buscar una librería HTTP con huella TLS de
navegador real, o mover este fetch a un cron/edge function con otro runtime.

## Base de datos — migraciones aplicadas (`supabase/migrations/0001` a `0016`)

- `0001_init.sql` — profiles/roles, providers, purchase_lots, seals, comminutions,
  big_bags, transport_events, weighings, mill_receptions, documents, audit_log,
  generador de código de lote (`next_lot_seq`), RLS por rol en todo.
- `0002_lots_config.sql` — `contract_settings` (bandas del contrato con PY: Ag/Au/Pb,
  merma, costos, % adelantos) + columnas de aprobación en purchase_lots. La tabla
  `contract_settings` ahora sí se usa (valorización definitiva, punto 7 de "qué
  falta"). Las columnas de aprobación por precio máximo en purchase_lots
  (`requires_approval`, `approved_at`) siguen sin usar — quedaron de una versión
  anterior del formulario de lote, antes de simplificarlo.
- `0003_truck_schedule.sql` — calendario de volquetes.
- `0004_lot_edit_support.sql` — columnas de precios de metal usados en la proyección.
- `0005_lot_updated_by.sql` — columna `updated_by` en purchase_lots.
- `0006_daily_metal_prices.sql` — precios diarios (oro/plata/plomo + % referencia).
- `0007_delete_policies.sql` — **fix de un bug preexistente**: a `providers`,
  `purchase_lots` y `seals` les faltaba la política RLS de `DELETE`. Los botones
  "Eliminar" de proveedores y lotes nunca daban error, pero tampoco borraban
  nada — Postgres corría el `delete` y afectaba 0 filas en silencio, y la
  pantalla se refrescaba como si hubiese funcionado. Se detectó al construir
  la pantalla de precintos (mismo problema ahí) y se corrigió para las tres
  tablas. **Si notaste que "Eliminar" en proveedores o lotes no hacía nada,
  era este bug — ya está resuelto.**
- `0008_transport_weighing_delete_policies.sql` — mismo fix que 0007, esta vez
  para `transport_events` y `weighings` (se detectó de nuevo al construir esa UI).
- `0009_mill_delete_policies.sql` — mismo fix otra vez, para `mill_receptions`,
  `comminutions` y `big_bags`. **Patrón para recordar: cualquier tabla nueva que
  se le agregue UI necesita que se revise si tiene política de DELETE — el
  loop genérico de 0001_init.sql nunca las creó para ninguna tabla operativa.**
- `0010_lab_analyses.sql` — tabla nueva `lab_analyses` (ley real del lote:
  Au/Ag/Pb + As/Sb/S/humedad), con su política de DELETE incluida desde el
  arranque (aprendiendo del patrón de 0007-0009).
- `0011_lot_settlements.sql` — tabla nueva `lot_settlements` (valorización
  definitiva + liquidación al proveedor). También con DELETE desde el
  arranque. Roles de escritura distintos al resto: compras/contabilidad/
  gerencia/administrador (no operaciones/calidad).
- `0012_warehouse_and_payment.sql` — bucket privado de Storage `lot-photos` +
  políticas de RLS sobre `storage.objects`, `DELETE` para `documents`
  (tenía SELECT/INSERT/UPDATE desde 0001 pero no DELETE), y columnas
  `paid_at`/`paid_by` en `lot_settlements` (para poder cerrar la compra
  solo cuando el saldo esté pagado).
- `0013_sale_lots.sql` — tabla nueva `sale_lots` (lotes de venta a PY, Fase
  2), columna `sale_lot_id` en `big_bags`, y una política extra de UPDATE
  en `big_bags` para que el rol comercial pueda reservar bolsones.
- `0014_sale_lot_dispatch.sql` — columnas de despacho y recepción en PY
  directo en `sale_lots` (sin tabla de log aparte).
- `0015_py_sample_batches.sql` — tabla nueva `py_sample_batches` (muestreo
  conjunto en PY, agrupa varios lotes de venta), columnas
  `py_official_weight_kg` y `sample_batch_id` en `sale_lots`. DELETE
  incluido desde el arranque.
- `0016_py_settlement.sql` — renombra los campos de ensayo de
  `py_sample_batches` con prefijo `prov_` y agrega: ensaye final
  (`final_*`), liquidación provisional (90%, precios promedio 5 días),
  ventana de fijación + fijación por metal (Au/Ag/Pb), liquidación final.
  Números y reglas sacados del contrato real PYCP-202656 (ver arriba).

`src/lib/contract.ts` tiene la fórmula de valorización completa del contrato con PY
(bandas de ley, pagables, humedad, merma) que se armó en la conversación original de
ChatGPT. **Ya está conectada** — se usa en `/lotes/[id]` para la valorización
definitiva (punto 7). Las bandas de `contract_settings` son las mismas que
definen cuánto se le paga al proveedor: no hay una fórmula separada — el
precio al proveedor sale de "lo que PY pagaría con la ley real, menos costos,
menos el margen objetivo" (confirmado con el usuario).

## Qué falta (siguiendo el pedido original de 24 puntos)

**Resto de la Fase 1 (compra, secciones 3–13 del pedido original):**
1. ~~Control documental y precintos~~ — **hecho** (`/precintos`, ver arriba).
2. ~~Seguimiento de transporte~~ — **hecho** (`/lotes/[id]`, ver arriba).
3. ~~Pesaje oficial en Trujillo~~ — **hecho** (`/lotes/[id]`, comparación
   guía vs. oficial incluida). El tipo "regularización" ya está en el
   formulario con un campo de motivo, pero no hay todavía un flujo que pida
   segunda guía/factura — si hace falta algo más formal que "cargar un
   pesaje más con motivo", avisar.
4. ~~Recepción en molino~~ — **hecho** (`/lotes/[id]`, ver arriba).
5. ~~Conminución~~ — **hecho** (`/lotes/[id]`, ver arriba). Big bags con código
   `GIN-<LOTE>-BBnn` y comparación contra lo declarado por el molino.
6. ~~Muestreo y laboratorio~~ — **hecho** (`/lotes/[id]`, ver arriba). Sin
   tolerancia entre dos laboratorios (no aplica todavía, según el usuario).
7. ~~Valorización definitiva de compra~~ — **hecho** (`/lotes/[id]`, ver
   arriba). `contract_settings` / `lib/contract.ts` **sí es** para esto (no
   solo para la venta a PY — confirmado con el usuario, corrigiendo lo que
   decía antes esta nota).
8. ~~Adelanto y liquidación del proveedor~~ — **hecho** (`/lotes/[id]`, ver
   arriba: mismo registro `lot_settlements` del punto 7 — precio final,
   saldo pendiente, N° de factura final, N° de nota de crédito/débito, y
   ahora también `paid_at`/`paid_by` para saber si el saldo ya se pagó de
   verdad). El campo `advance_pct` del lote se sacó del formulario (a
   pedido del usuario, no se usaba en ningún cálculo) — hoy el pago
   provisional se asume 100% de una vez, no por partes.
9. ~~Traslado al almacén de Ginebra + cierre de compra~~ — **hecho**
   (`/lotes/[id]`, ver arriba). Traslado es solo foto de evidencia; cierre
   solo se habilita si la liquidación está pagada.

**Fase 1 (compra) completa — los 9 puntos del pedido original están
implementados y probados de punta a punta.** Lo que sigue es Fase 2 (venta a
PY, abajo) o volver a pulir/corregir cosas de Fase 1 si aparecen mientras se
usa en el día a día.

**Fase 2 (venta a PY)** — **blending descartado a pedido del usuario**, no se va a
hacer. Progreso:
- ~~Inventario de big bags~~ — **hecho** (`/big-bags`, ver arriba).
- ~~Lote de venta~~ — **hecho** (`/ventas`, ver arriba). Selección manual,
  mezcla lotes de compra libremente.
- ~~Despacho del lote de venta + recepción en PY~~ — **hecho** (`/ventas/[id]`, ver arriba).
- ~~Muestreo conjunto (ley real del lado de PY)~~ — **hecho** (`/muestreo`, ver arriba).
- ~~Liquidación provisional (90%) y final de PY~~ — **hecho** (`/muestreo/[id]`, ver arriba).
- ~~Fijaciones de precio por metal~~ — **hecho**, junto con lo anterior.
- Márgenes por lote de compra/venta — falta. Es lo último que queda de
  Fase 2 (sin contar blending, descartado).

**Fase 3 (después, según lo acordado):** panel de control gerencial, asistente de
IA, conexión a fuentes de precio pagas (LBMA/LME/Fastmarkets), integración con Nisira
(mencionada por el usuario, sin detallar todavía qué es exactamente).

**Pendiente transversal:** la bitácora de auditoría (`audit_log`) existe en la base
pero nada escribe ahí todavía — el pedido original quería que toda edición quede
registrada con usuario/fecha/valor anterior/valor nuevo/motivo.

## Datos de prueba en la base

Proveedores "BUSINESS DIRECTION" (BUS) y "GRUPO CONSTRUCTOR Y MULTISERVICIOS" (GRU),
lotes `BUS-26-01` a `BUS-26-05` (y uno viejo `GIN-BUS-2026-0001` del formato de
código anterior). El usuario pidió dejarlos como referencia — se pueden borrar a
mano después desde `/lotes` o el panel de Supabase.

## Notas de estilo de trabajo con el usuario

- El usuario no sabe programar — explicar en criollo, sin jerga, y probar cada
  cambio en el navegador antes de darlo por terminado (no alcanza con que compile).
- Prefiere que se implemente y pruebe directamente, no que se le pregunte de más;
  pero cuando una fórmula de negocio es ambigua, mejor preguntar con números
  concretos que adivinar dos veces (pasó con el cálculo de referencia de precios).
- Va probando la app en paralelo en su propia sesión — es normal encontrar datos
  que cambiaron sin que este chat los haya tocado.
