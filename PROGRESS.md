# Ginebra ERP — estado del proyecto

Sistema de trazabilidad de mineral para Ginebra (Perú). Next.js 16 (App Router,
Turbopack) + TypeScript + Tailwind + Supabase (Postgres, Auth, Storage, RLS).

Repo: `C:\Users\Carlos\OneDrive\Desktop\FINANZAS\ginebra-erp` (git inicializado,
commits incrementales con mensajes descriptivos — revisar `git log` para el detalle
de cada paso).

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

**Programación / calendario** (`/calendario`) — grilla mensual, dos tipos de
programación de volquete: *compra* (llegada de mina, celeste) y *despacho* (venta a
PY en Lima, violeta), con estado (programado/confirmado/completado/cancelado) y
borrado manual.

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

## Base de datos — migraciones aplicadas (`supabase/migrations/0001` a `0010`)

- `0001_init.sql` — profiles/roles, providers, purchase_lots, seals, comminutions,
  big_bags, transport_events, weighings, mill_receptions, documents, audit_log,
  generador de código de lote (`next_lot_seq`), RLS por rol en todo.
- `0002_lots_config.sql` — `contract_settings` (bandas del contrato con PY: Ag/Au/Pb,
  merma, costos, % adelantos) + columnas de aprobación en purchase_lots. **Ojo: esta
  tabla y la lógica de aprobación por precio máximo quedaron sin usar** después de
  simplificar el formulario de lote — están reservadas para la etapa de valorización
  final (venta a PY), no para la compra inicial.
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

`src/lib/contract.ts` tiene la fórmula de valorización completa del contrato con PY
(bandas de ley, pagables, humedad, merma) que se armó en la conversación original de
ChatGPT — **no está conectada a ninguna pantalla todavía**; es para la etapa
posterior (venta a PY), no para la compra al proveedor.

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
7. Valorización definitiva de compra — usar ley real + `contract_settings` /
   `lib/contract.ts` (ya construidos, sin conectar) para la segunda fijación /
   liquidación del proveedor. **Regla de negocio del usuario para tener en
   cuenta acá:** cada ley de laboratorio debería ser mayor o igual a la ley
   provisional estimada — si no, es una señal de que revisar (ya implementado
   como aviso en la sección de Laboratorio, ver arriba).
8. Adelanto y liquidación del proveedor — separar precio final, adelanto entregado,
   saldo, facturas y notas de crédito/débito.
9. Traslado al almacén de Ginebra + cierre de compra.

**Fase 2 (venta a PY):** inventario de big bags, diseño de blending, lote de venta,
despacho/recepción en PY, muestreo conjunto, liquidación provisional (90%) y final de
PY, fijaciones de precio por metal, márgenes por lote de compra/venta.

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
