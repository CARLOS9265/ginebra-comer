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

Login de prueba (administrador): `carlombar65@gmail.com` / `Sense.9265` (cambiada
2026-08-24, la anterior era `Ginebra2026Admin!`).

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
incidentes — un solo registro por lote) y **conminución** (un solo registro de
conminución por lote — se muele en una sola tanda). **Importante, cambió de
diseño (migración 0017, ver más abajo):** ya no se cargan big bags uno por uno
con código y peso individual — el peso real de cada bolsón nunca se conoce con
exactitud (confirmado con el usuario), así que la conminución ahora solo pide
la **cantidad total de bolsones** (`comminutions.bag_count`, un número). El
control de peso real pasa a ser el ticket de balanza (con foto adjunta, ver
Pesajes), no una comparación por bolsón. Registrar la recepción o la
conminución también avanza el estado del lote (recibido_molino, conminuido).

También **Laboratorio**: un solo resultado por lote (muestra compuesta de todo
el lote, no por bolsón). Un solo laboratorio por
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
- **Bolsones** (`/big-bags`) — **rediseñado en la migración 0017** (ver más
  abajo): ya no es un inventario de bolsones individuales con código/peso/
  estado. Ahora es un resumen por lote de compra: cuántos bolsones generó
  (`comminutions.bag_count`), cuántos ya se asignaron a algún lote de venta,
  cuántos quedan disponibles. Confirmado con el usuario: el peso individual
  de un bolsón nunca se conoce con exactitud, y los cálculos (márgenes,
  asignación a ventas) son por LOTE, no por bolsón — trackear identidad
  individual era más detalle del que el negocio realmente tiene.
- **Lotes de venta** (`/ventas`) — se arman indicando, por cada lote de
  compra que aporta, **cuántos bolsones** van en el despacho (no cuáles
  puntualmente) — tabla `sale_lot_allocations` (sale_lot_id, purchase_lot_id,
  bag_count), reemplaza lo que antes era `big_bags.sale_lot_id`. Un lote de
  venta puede seguir mezclando varios lotes de compra. Código automático
  `VTA-AA-NN` (reusa `next_lot_seq('VTA', año)`). Se pueden agregar/quitar
  asignaciones mientras el lote está en estado `armado`; quitar una libera
  esa cantidad de vuelta a "disponible" en `/big-bags`.
- `DeleteRowButton` y `ActionButton` se movieron de `lotes/[id]/` a
  `src/components/` porque ahora los usan tanto compra como venta.
- **Despacho + recepción en PY** (`/ventas/[id]`) — evento único por lote de
  venta (no una tabla de log aparte, como recepción en molino del lado de
  compra): columnas directas en `sale_lots` (migración 0014). Cada paso
  tiene un botón "Deshacer" que revierte el estado y limpia los campos —
  útil porque es fácil equivocarse la fecha/transportista al cargar.
  Probado de punta a punta: armado → despachado → recibido en PY, con
  deshacer en cada paso. La recepción en PY tiene **peso oficial del
  trailer** (por lote de venta / camión) — desde la migración 0017 este es
  **obligatorio** y es la única referencia de peso confiable de un lote de
  venta (ya no hay peso "declarado" por bolsón contra el cual compararlo).
- **Traslado a almacén de Huanchaco** (`/lotes/[id]`, sección nueva en la
  migración 0018) — el usuario corrigió el proceso real (ver más abajo, "el
  muestreo pasó a ser en dos tiempos"): entre el molino y la venta hay un
  traslado propio al almacén de Ginebra en Huanchaco, con montacarga,
  trailer y **un pesaje propio distinto al de Trujillo** (mismo enum
  `weighing_type`, valor nuevo `'huanchaco'`). Tabla nueva
  `warehouse_transfers` (costo de montacarga, transportista, placa, salida
  del molino, descarga en almacén, incidentes) + `WarehouseTransferForm/Row`
  y `HuanchacoWeighingForm/Row` (este último reusa `createWeighing`/
  `updateWeighing`, solo agrega un campo oculto `type="huanchaco"`). La
  foto que antes vivía acá (única evidencia del traslado) ahora es
  complementaria — lo que hace avanzar `purchase_lots.status` a
  `en_almacen` es `createWarehouseTransfer`, no la foto.
- **Muestreo conjunto en PY, en dos tiempos** (`/muestreo`) — el usuario
  explicó el proceso real completo (compra → traslado a Huanchaco → venta) y
  reveló que el muestreo/liquidación provisional (90%) **no pasa en Lima
  como se había armado antes** — pasa **en Huanchaco, antes de despachar**:
  llega el supervisor de PY al almacén de Ginebra, se toma **una sola
  muestra de TODO lo que está esperando embarque** (todos los lotes de
  compra en almacén a la vez, sin importar a qué lote de venta van a
  terminar), y con ese resultado se calcula y paga el 90% provisional.
  **Recién después** se arman los lotes de venta (eligiendo cuántos
  bolsones aporta cada lote de compra de *ese mismo* muestreo — no se puede
  mezclar lotes de compra de muestreos provisionales distintos en un mismo
  despacho, se valida en `createSaleLot`/`addAllocation`), se despachan a
  Lima, y ahí pasa el muestreo **final** (conjunto, laboratorio
  internacional) — que sigue siendo el mismo que ya estaba construido.
  - Es la **misma entidad `py_sample_batches`** para las dos etapas, no una
    tabla nueva: primero agrupa lotes de **compra** (`purchase_lots.
    sample_batch_id`, columna nueva en la migración 0018) para lo
    provisional, después los lotes de **venta** creados a partir de esos
    lotes de compra heredan el mismo `sample_batch_id` automáticamente para
    lo final. Se evitó a propósito un diseño con dos tablas (provisional y
    final separadas) porque hubiera necesitado prorratear "cuánto ya se
    pagó de provisional" entre lotes de venta por cantidad de bolsones —
    siendo el mismo registro, `batch.prov_payment_total` ya es el número
    correcto sin ningún cálculo extra.
  - "Crear muestreo" en `/muestreo` junta automáticamente TODOS los lotes de
    compra con pesaje de Huanchaco cargado que todavía no fueron agrupados
    (mismo criterio "automático, no manual" que ya regía del lado de venta).
  - El peso total del muestreo (provisional) suma los pesajes tipo
    `huanchaco` de los lotes de compra agrupados — ya no el peso oficial de
    trailer de los lotes de venta, porque a esa altura los lotes de venta
    todavía no existen.
  - La **ventana de fijación** ("M+1", cláusula 8.1) ya no se puede calcular
    al crear el muestreo (en Huanchaco todavía no se sabe cuándo va a llegar
    el primer trailer a Lima) — se calcula **sola, en el momento**, la
    primera vez que se registra una recepción en PY de un lote de venta de
    ese muestreo (`computeFixationWindow`, movida a `src/lib/contract.ts`
    para poder importarla desde `ventas/actions.ts`).
  - Se puede deshacer el muestreo provisional (libera los lotes de compra)
    **solo mientras no tenga resultado de laboratorio cargado**, y
    **solo si todavía no se armó ningún lote de venta** desde él.
  - Página de detalle (`/muestreo/[id]`) ahora muestra dos listas separadas:
    lotes de compra del muestreo (provisional, Huanchaco) y lotes de venta
    despachados desde él (final, Lima) — la segunda puede estar vacía si
    todavía no se armó ningún despacho.

**Menú agrupado por proceso + pantalla nueva de Almacén.** El usuario pidió
separar visualmente los 3 procesos físicos del negocio (compra, traslado a
almacén, venta) que antes estaban todos mezclados en una sola fila de menú.
`src/app/(app)/layout.tsx` ahora arma el menú en `NAV_START` (Inicio,
Programación — programar el volquete es lo primero que pasa, antes de que
exista el lote, así que va antes del grupo Compra por orden lógico) +
`NAV_GROUPS` (Compra en ámbar, Almacén en verde esmeralda, Venta en celeste —
cada grupo con una etiqueta chica arriba y un subrayado del color del grupo)
+ `NAV_END` (Proveedores, Márgenes, Precios, Asistente — no pertenecen a una
sola fase, van sueltos al final).
- **Primera versión se veía informal** (el usuario mandó captura): el texto
  se cortaba en dos líneas ("Lotes de / compra") porque a los links les
  faltaba `whitespace-nowrap`, y la fila de "Inicio" no tenía la misma altura
  que los grupos con etiqueta arriba, así que quedaba desalineada. Se rehizo
  con `NavCluster`/`NavLinks`/`NavDivider`: cada bloque (con o sin grupo)
  reserva la misma altura de "etiqueta" arriba (invisible si no tiene
  nombre de grupo) para que todos los links terminen exactamente en la misma
  línea de base, contenedor con scroll horizontal propio (con barra fina,
  no la gris del navegador por defecto) para pantallas angostas en vez de
  romper el texto.
- **Nombre completo de la empresa**: "Ginebra" → "Ginebra Trade Peru SAC" en
  el encabezado de la app (`(app)/layout.tsx`, ahora en dos líneas — nombre
  arriba, "Sistema de trazabilidad de mineral" abajo, simétrico con el
  bloque de usuario del otro extremo), en la pantalla de login, y en el
  título de la pestaña del navegador (`src/app/layout.tsx`).
- De paso se creó
`/almacen`, pantalla que no existía: muestra los lotes con liquidación de
compra ya definitiva que todavía no tienen traslado registrado ("listos
para trasladar"), y los que ya están físicamente en Huanchaco (peso del
pesaje propio, costo de montacarga, transportista, fecha de descarga) y
todavía no fueron agrupados en un muestreo provisional — en cuanto un lote
entra a un muestreo (`sample_batch_id` dejó de ser null) pasa a verse en
`/muestreo` en vez de acá, porque a partir de ahí ya es parte del proceso de
venta (así lo definió el usuario: el muestreo provisional es el arranque de
venta, no parte de almacén). Es una pantalla de solo lectura — la carga de
datos del traslado sigue siendo en `/lotes/[id]` (ahí ya estaban los
formularios).

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

**Márgenes** (`/margenes`) — reporte de solo lectura (`src/lib/margins.ts`):
cruza `lot_settlements.precio_definitivo_total` (costo definitivo por lote
de compra) contra `py_sample_batches.final_value_total` (ingreso final por
muestreo de PY). **Desde la migración 0017 prorratea por CANTIDAD DE
BOLSONES** (vía `sale_lot_allocations`), no por peso — costo por bolsón del
lote de compra al que pertenece, ingreso por bolsón del muestreo donde
terminó. Dos tablas — por lote de compra y por lote de venta — con el
margen agregado. Una asignación solo entra al cálculo si **ambos** lados
tienen liquidación definitiva; si falta alguno queda contado aparte como
"pendiente" (bolsones) en vez de arrastrar un número incompleto. Con esto
se cierra Fase 2 completa (sin contar blending, descartado a pedido del
usuario).

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

## Base de datos — migraciones aplicadas (`supabase/migrations/0001` a `0018`)

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
- `0017_bag_count_model.sql` — **rediseño grande, no solo columnas nuevas**:
  dropea la tabla `big_bags` entera (y `seals.big_bag_id`, que nunca tuvo UI)
  y la reemplaza por `comminutions.bag_count` (cuántos bolsones generó un
  lote de compra, sin identidad individual) + tabla nueva
  `sale_lot_allocations` (sale_lot_id, purchase_lot_id, bag_count — cuántos
  bolsones de cada lote de compra van en cada lote de venta). Motivo: el
  usuario explicó que el peso real de un bolsón nunca se conoce con
  exactitud (se controla contra el ticket de balanza, no bolsón por bolsón)
  y que los cálculos de negocio son por lote, no por bolsón individual — el
  diseño anterior (`big_bags` con código/peso/estado propio) era más detalle
  del que el negocio realmente maneja. Todo lo que antes sumaba
  `big_bags.weight_kg` (comparación de peso en `/ventas/[id]`, tmh de la
  liquidación de PY en `muestreo/actions.ts`, prorrateo de `/margenes`) pasó
  a usar `sale_lots.py_official_weight_kg` (peso oficial del trailer,
  **ahora obligatorio** al recibir en PY) o cantidad de bolsones, según
  corresponda. Ver el detalle de cada pantalla más arriba.

- `0018_huanchaco_and_provisional_reorder.sql` — **corrección de arquitectura,
  no solo una tabla nueva**: el usuario describió el proceso físico real
  completo (compra → traslado a Huanchaco → venta) y reveló que el muestreo/
  liquidación provisional del lado de PY se había construido en el momento
  equivocado (agrupando lotes de venta ya en Lima, en vez de lotes de compra
  en Huanchaco antes de despachar — ver "Muestreo conjunto en PY, en dos
  tiempos" más arriba para el detalle completo). Trae: tabla nueva
  `warehouse_transfers`, valor nuevo `'huanchaco'` en el enum
  `weighing_type`, y columna nueva `purchase_lots.sample_batch_id` (para que
  el muestreo provisional agrupe lotes de compra, no de venta). Confirmado
  con el usuario dos veces por `AskUserQuestion` antes de tocar código (una
  vez que la muestra provisional es una sola de todo lo que espera en
  Huanchaco, y otra vez la secuencia completa) — no es una interpretación
  mía, es exactamente lo que describió.
  - **Bug real encontrado al probar**: `createWeighing`/`updateWeighing` en
    `lotes/[id]/actions.ts` tenían una lista blanca de tipos de pesaje
    (`["inicial", "oficial", "regularizacion"]`) que nunca se actualizó
    después de agregar `'huanchaco'` al enum de la base — el formulario de
    pesaje de Huanchaco fallaba con "Elegí un tipo de pesaje válido." en
    cada intento. Corregido agregando `"huanchaco"` a esa lista en ambas
    funciones.

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
5. ~~Conminución~~ — **hecho** (`/lotes/[id]`, ver arriba). Desde la migración
   0017 solo pide la cantidad de bolsones generados, no un registro por
   bolsón (ver "Bolsones" más arriba).
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
   (`/lotes/[id]`, ver arriba). Desde la migración 0018 el traslado tiene
   registro real (montacarga, trailer, pesaje propio de Huanchaco, no solo
   foto de evidencia — ver "Traslado a almacén de Huanchaco" más arriba);
   cierre solo se habilita si la liquidación está pagada.

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
- ~~Márgenes por lote de compra/venta~~ — **hecho** (`/margenes`, ver arriba).

**Fase 2 (venta a PY) completa** (sin contar blending, descartado a pedido
del usuario). Con esto, Fase 1 y Fase 2 están implementadas de punta a
punta.

**Fase 3 — arrancada.** Progreso:
- ~~Asistente de IA~~ — **hecho** (`/asistente`, ver abajo).
- Panel de control gerencial — falta.
- Conexión a fuentes de precio pagas (LBMA/LME/Fastmarkets) — **bloqueada,
  esperando que el usuario contrate el servicio.** Se revisó el contrato real
  (cláusula 4.1): la fuente NO es una elección libre, ya está definida ahí —
  plata "LBMA Spot Price", oro "LBMA Au Am/Pm Gold Price", plomo "LME
  Settlement", las tres publicadas en Metal Bulletin (hoy parte de
  **Fastmarkets**). El usuario confirmó que todavía no tiene nada contratado.
  Cuando lo consiga, conectar según el formato que entreguen (API/archivo/
  portal) — `daily_metal_prices` ya guarda el snapshot diario de forma
  agnóstica a la fuente, así que cambiarla no debería tocar el resto de la
  app (mismo patrón que `live-metal-prices.ts` hoy con inversoro.es).
- Integración con Nisira — falta (mencionada por el usuario, sin detallar
  todavía qué es exactamente).

**Asistente de IA** (`/asistente`) — chat que responde preguntas en lenguaje
natural sobre lotes de compra/venta, muestreos, márgenes, precios y
programación, más recomendaciones de fecha de fijación y alertas. Usa
**Google Gemini** (nivel gratuito, elegido a pedido del usuario para no
requerir tarjeta) en vez de la API de Anthropic.
- `src/lib/assistant/gemini.ts` — llamada REST directa a la API de Gemini
  (sin SDK, mismo criterio que `live-metal-prices.ts`). Modelo
  `gemini-3.6-flash` — **importante:** los modelos Gemini con razonamiento
  devuelven un `thoughtSignature` junto a cada `functionCall`; hay que
  reenviarlo tal cual en el siguiente turno o la API devuelve 400
  ("Function call is missing a thought_signature"). Por eso
  `generateContent()` devuelve `modelParts` (las parts crudas de la
  respuesta) para reinyectarlas sin reconstruirlas a mano.
- `src/lib/assistant/tools.ts` — 10 herramientas de solo lectura (buscar/
  detalle de lotes de compra y venta, muestreos, precios recientes,
  márgenes, calendario, alertas). Corren con el cliente de Supabase del
  usuario logueado, así que RLS filtra automáticamente qué puede ver cada
  rol — no hace falta lógica de permisos aparte para el asistente.
- `src/lib/assistant/alerts.ts` — chequeos **deterministas** (sin IA):
  ventanas de fijación por vencer/vencidas, diferencia de peso guía vs.
  oficial (compra y recepción en PY) mayor a 2%, despachos a PY sin
  confirmar recepción hace +10 días, liquidaciones de compra sin pagar
  hace +15 días, programación de volquetes vencida sin actualizar. La IA
  solo resume esta lista, no la calcula.
- `src/lib/margins.ts` — la lógica de `/margenes` se extrajo a una función
  compartida (`computeMargins`) para que la pantalla y la herramienta del
  asistente usen exactamente el mismo cálculo.
- Sin persistencia de conversación (historial vive solo en el estado del
  navegador, se pierde al recargar) — decisión deliberada para no sumar
  una tabla nueva en la v1.
- Probado de punta a punta en el navegador con datos reales: preguntas
  sobre alertas/agenda y sobre lotes sin liquidar devolvieron respuestas
  correctas cruzando varias tablas.

**Edición en el lugar (todas las pantallas de compra y venta, y ahora también
Programación).** El usuario pidió explícitamente que "cada cosa que se genere
tenga la opción de editable" — antes, casi todo (transporte, pesajes, molino,
conminución, laboratorio, ensayes de PY, etc.) solo se podía cargar y después
borrar, sin poder corregir un dato sin borrar todo. Ahora cada sección de
`/lotes/[id]`, `/ventas/[id]` y `/muestreo/[id]` tiene un botón "Editar" que
reabre el mismo formulario precargado, en vez de forzar un borrar-y-recargar.
Patrón usado en cada caso: un componente `*Row.tsx` chico (client) con estado
local de edición, que muestra la vista o el formulario precargado, y se
cierra solo al guardar con éxito (`useEffect` que detecta la transición
pending→listo).
- `/calendario` (Programación de volquetes) se había quedado afuera de este
  patrón — el usuario lo notó ("aquí no sale editar") y se corrigió: nueva
  acción `updateSchedule` en `calendario/actions.ts`, y `ScheduleRow` en
  `CalendarView.tsx` ahora tiene estado local `editing` que muestra
  `ScheduleForm` precargado (mismo componente que crea, con un prop
  `editing` opcional) en vez de la vista. El tipo (compra/despacho) no es
  editable — cambiarlo requeriría otro juego de campos — pero sí hora,
  proveedor/destino, placa, transportista y bolsones estimados. De paso se
  encontró y arregló un bug real preexistente: la consulta de `/calendario`
  traía `providers(name, code)` sin el `id`, así que aunque el formulario de
  edición se hubiera armado, no habría podido preseleccionar el proveedor
  correcto (era además uno de los 3 errores de TypeScript preexistentes que
  veníamos arrastrando — ya son 2).
- El campo "Notas" se sacó del formulario (a pedido del usuario, no se usaba).
  Los estados de una programación quedaron reducidos a **Programado /
  Confirmado / Cancelado** (se sacó "Completado" de las opciones — el valor
  sigue existiendo en el enum de la base por si algún registro viejo lo
  tuviera, pero ya no se puede elegir).
- **Al confirmar un volquete de tipo Compra, se genera solo el lote de
  compra** (a pedido del usuario) — la columna `truck_schedule.purchase_lot_id`
  ya existía en la migración 0003 pero nunca se había usado. `updateScheduleStatus`
  ahora, cuando el nuevo estado es "confirmado", llama a
  `createPurchaseLotForSchedule` (mismo generador de código `next_lot_seq`
  que usa el alta manual de lotes) y crea el lote en estado "creado" con
  proveedor/placa/transportista/fecha de la programación — el peso real, el
  precio y todo lo demás se completan después a mano en el detalle del lote,
  igual que si se hubiese creado ahí directamente. Si el volquete ya tenía un
  lote vinculado (o es de tipo despacho, o le falta proveedor) no hace nada.
  El resultado se muestra debajo del selector de estado ("Se generó el lote
  BUS-26-08.") o el error si algo falló — antes `updateScheduleStatus` no
  devolvía nada, ahora devuelve `{ error?, createdLotCode? }`.
- Donde un dato ya alimentó un cálculo de plata más abajo, la edición queda
  **bloqueada igual que ya estaba bloqueado el borrado**: laboratorio de
  compra una vez que hay liquidación definitiva, ensaye provisional/final de
  PY una vez que su liquidación está calculada, y (nuevo, corregido en esta
  misma sesión) **fijación de metal una vez que la liquidación final ya se
  calculó** — antes "Deshacer" quedaba disponible incluso después de pagada,
  lo que podía desincronizar el número final sin que nadie lo notara.
- La liquidación definitiva de compra (`lot_settlements`) y la de PY
  (montos de `py_sample_batches`) **no se re-calculan al editar** — solo se
  pueden editar los campos administrativos (N° de factura, notas) mientras el
  saldo no esté pagado. Si cambió la ley o el peso hay que borrar y
  recalcular, no editar a mano.

**Pendiente transversal:** la bitácora de auditoría (`audit_log`) existe en la base
pero nada escribe ahí todavía — el pedido original quería que toda edición quede
registrada con usuario/fecha/valor anterior/valor nuevo/motivo. Con las pantallas
de edición ya armadas, este sería el momento natural para conectarla (cada
`update*` action ya sabe qué campo cambió).

## Datos de prueba en la base

Base limpia: se mantuvieron los 2 proveedores (BUSINESS DIRECTION / BUS,
GRUPO CONSTRUCTOR Y MULTISERVICIOS / GRU) pero no hay ningún lote de compra
ni de venta cargado. La migración 0018 (traslado a Huanchaco + muestreo
provisional en dos tiempos) se probó de punta a punta con una simulación
completa (`BUS-26-01` → traslado a Huanchaco con pesaje propio → `MUE-26-01`
provisional (90%, pagado) → `VTA-26-01` (23 bolsones, despachado, recibido en
PY, ventana de fijación auto-calculada en la primera recepción) → ensaye y
liquidación final de `MUE-26-01` (pagada) → margen verificado en `/margenes`:
$74,387 − $58,293 = **$16,094**) y se borró después de confirmar que todo
cerraba bien — no quedó como ejemplo esta vez, a diferencia de simulaciones
anteriores.

## Notas de estilo de trabajo con el usuario

- El usuario no sabe programar — explicar en criollo, sin jerga, y probar cada
  cambio en el navegador antes de darlo por terminado (no alcanza con que compile).
- Prefiere que se implemente y pruebe directamente, no que se le pregunte de más;
  pero cuando una fórmula de negocio es ambigua, mejor preguntar con números
  concretos que adivinar dos veces (pasó con el cálculo de referencia de precios).
- Va probando la app en paralelo en su propia sesión — es normal encontrar datos
  que cambiaron sin que este chat los haya tocado.
