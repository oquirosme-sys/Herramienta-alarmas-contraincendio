# Baterías · Alarma contra incendio

Herramienta web (HTML + JS, sin compilación) que reemplaza el libro **Cálculo_baterías_Alarmas.xlsx**:
baterías secundarias, fuentes auxiliares y caída de tensión según **NFPA 72:2022 §10.6.7 / UL 864 / NEC Art. 760**.

## Uso

1. **Proyecto** — datos generales, parámetros NFPA 72 (24 h espera, 5/15 min alarma, FS 20 %, 85 % fin de vida, 16 V mín., 2.4 A NAC) y **niveles del edificio**.
   Un proyecto nuevo arranca con **un solo nivel** (y su panel principal FACP). Los demás se agregan uno a uno con el botón **«+ Nivel»**
   (en la barra de pestañas o en la tarjeta Niveles): cada nivel nuevo crea su pestaña con un transponder (TRP). También hay «Agregar varios niveles…».
2. **Pestaña de cada panel / transponder** — primero el cuadro **«Lazos y salidas»**: se definen los SLC, NAC, IDNAC, 24 VDC, voceo e IDC que salen del equipo
   (con nombre, nivel, cable y longitud; el cable por defecto sale de la simbología: 5220UL, voceo 5220FL). Después la tabla de dispositivos:
   Fabricante → Modelo → **Nivel** → **Lazo / salida** → Cantidad (desde la fila también se puede crear un lazo nuevo; el tipo se sugiere según el dispositivo).
   Las corrientes unitarias salen del catálogo; si se digita un valor, reemplaza el de catálogo (amarillo). Un detector SLC en un NAC (o al revés) se avisa.
   Cada equipo calcula su propia batería y selecciona la capacidad estándar inmediata superior.
3. **Pestaña de cada fuente auxiliar** — igual, más consumo propio y verificación del 80 % de I máx.
4. **Caída de tensión** — una tabla con todos los lazos del proyecto; la corriente de cada lazo sale de los dispositivos asignados (+ «otros» en mA), método de carga concentrada.
5. **Memoria de cálculo** — criterios, metodología, resumen por panel, fuentes, caída de tensión, resumen de dispositivos por equipo,
   observaciones automáticas y anexo con el detalle de cargas. «Imprimir / PDF» la emite en carta.
6. **Administración** (botón 🔒, requiere PIN) — catálogos de fabricantes/marcas, dispositivos, cables y baterías
   (equivalen a las hojas ocultas BD_DISPOSITIVOS, BD_CABLES y BD_BATERIAS). Exportar/importar/restablecer catálogo.

El menú **Proyecto ▾** permite crear, duplicar, exportar/importar (.json) y eliminar proyectos.
«Nuevo proyecto de ejemplo» recrea los datos del Excel original para verificar resultados
(FACP-01 = 102.59 Ah → 110 Ah; TRP = 12.46 Ah → 12.7 Ah; RPS-01 = 5.05 Ah → 6.2 Ah; 1 circuito con error de caída).

### Diferencia intencional con el Excel
Si el Ah requerido supera la mayor batería del catálogo, el Excel devolvía en silencio la batería **más pequeña** (6.2 Ah).
La herramienta lo marca como **REVISAR — excede catálogo**.

## Aspecto y formato Sinergia

- **Sinergia Suite** (`css/suite-*.css`): barra de vidrio con tesela, «← Suite» primero a la izquierda, secciones segmentadas y color por aplicación
  (`<body data-app="alarmas-ci">`). Los colores de estado (rojo, ámbar, verde) no se tocan. Tipografía Montserrat.
  **Pendiente:** el color `alarmas-ci` (violeta) es provisional — conciliarlo con el registro oficial del Suite (`paleta.md`) — y falta definir `suiteUrl` en `js/config.js`.
- **Memoria de cálculo impresa** (formato Sinergia): hoja carta, márgenes 3,0 / 2,5 cm, logo y dirección en el encabezado, pie de tres celdas
  (nombre del documento · web y correo · página), Montserrat 11 pt justificado, títulos en negrita sin regla, tablas «Tabla No. N» con solo reglas horizontales,
  anchos declarados, sin celdas en blanco («—») y color solo en la criticidad. Se verificó en el PDF (no en pantalla).
- Enlace directo a una sección: `index.html#memoria` (también `#caida`, `#proyecto`).

## Validación contra la simbología CDCLH-001S

El catálogo se validó contra la lámina de simbología de Circuito S.A. (versiones Simplex y Notifier): se agregaron los dispositivos que faltaban
(detectores de haz de luz, convencionales, bases audibles, protección de sobretensiones SS, fuentes remotas, anunciador, teléfono de bomberos, etc.)
y el cable 6x14 STP del anunciador. Cada tipo muestra la sigla del símbolo (AIM, AOM, WF, VS, IM, SS, RPS, AMP, FAA…).
Las corrientes de los dispositivos agregados se tomaron de **fichas de fabricante** (la ficha y las condiciones quedan anotadas en la columna de observación de cada dispositivo;
donde la ficha da un máximo se usa el máximo, y las equivalencias de código no confirmadas llevan la marca «CONFIRMAR»).
Seis dispositivos siguen sin corriente publicada (2098-9806, 4099-9006 y -9006SP, 4009-9401, DAA2 + BDA y DVC + DVC-KD): la fila se marca **REVISAR**
hasta que se digite la corriente (en la fila, o en Administración → Dispositivos).

## Versión en Excel (copia local)

La carpeta `excel/` contiene el mismo cálculo como libro de Excel con fórmulas vivas, listas desplegables dependientes
(fabricante → «código · qué es — descripción»), **lazo y nivel por dispositivo**, caída de tensión por lazo, catálogos en hojas ocultas y memoria de cálculo:

- `Calculo_baterias_Alarmas_PLANTILLA.xlsx` — **limpia**: un nivel y un panel sin datos; las casillas de entrada en verde claro y, al seleccionar cada una,
  aparece un ejemplo tenue (más una línea de ejemplo en gris sobre la tabla de dispositivos).
- `Calculo_baterias_Alarmas_EJEMPLO.xlsx` — datos del Excel original (resultados de referencia: FACP-01 102.59 Ah → 110 Ah; TRP 12.46 → 12.7 Ah; RPS-01 5.05 → 6.2 Ah).
- `generar_excel.py` — regenera ambos libros desde `js/catalogo-base.js` (`python excel/generar_excel.py`); después abrirlos en Excel y guardar para que queden los valores calculados.

Los lazos se definen en la hoja `CAIDA_TENSION` (panel, nombre, tipo, nivel, cable, longitud); en cada hoja de equipo, la columna **LAZO / SALIDA** asigna el dispositivo a su lazo.
El libro es independiente de la web (no se sincronizan los datos). Instrucciones de uso dentro del libro, hoja `INSTRUCCIONES`.

## Estructura

```
index.html
css/styles.css
js/catalogo-base.js   catálogo semilla generado desde las hojas BD_* del Excel
js/calc.js            motor de cálculo (funciones puras, réplica de las fórmulas)
js/store.js           capa de datos (fase 1: localStorage del navegador)
js/auth.js            permisos de administrador (modo local: PIN)
js/config.js          URL y clave anon de Supabase (vacío = modo local)
js/supabase.js        Store/Auth contra Supabase (se activa con config.js)
js/app.js             interfaz
supabase/             01_esquema.sql, 02_semilla_catalogo.sql
```

## Publicar en GitHub Pages

Subir la carpeta al repositorio y activar *Settings → Pages* (rama `main`, carpeta raíz o `/docs`).
No requiere servidor ni dependencias. Para probar localmente: `python -m http.server` dentro de la carpeta y abrir `http://localhost:8000`.

> **Sin configurar Supabase** (estado por defecto, `js/config.js` vacío) la herramienta trabaja en modo local:
> proyectos y catálogo en el `localStorage` del navegador y PIN de administrador solo de interfaz (no es seguridad real).

## Fase 2 — Supabase

Con la URL y la clave configuradas, `js/supabase.js` reemplaza `Store` y `Auth` (misma interfaz); `app.js` y `calc.js` no cambian.

### Puesta en marcha

1. **Crear el proyecto** en <https://supabase.com> (región cercana, p. ej. us-east).
2. **SQL Editor** → ejecutar en orden `supabase/01_esquema.sql` y luego `supabase/02_semilla_catalogo.sql`
   (la semilla también puede cargarse desde la app: Administración → «Cargar catálogo base a Supabase»).
3. **Authentication → URL Configuration**: *Site URL* = la dirección de GitHub Pages
   (p. ej. `https://usuario.github.io/repositorio/baterias-alarmas/`) y la misma en *Redirect URLs*.
   (Authentication → Providers → Email: puede desactivar «Confirm email» si no quiere confirmar por correo.)
4. **Project Settings → API**: copiar *Project URL* y la clave *anon public* en `js/config.js`. **Nunca** la `service_role`.
5. Publicar en GitHub Pages y **registrarse**: el primer usuario con correo `@sinergia.co.cr` queda como **administrador**.
6. Desde ese usuario: botón de sesión → «Subir a Supabase los proyectos guardados en este navegador» (migra los de la fase 1).

### Modelo de datos (`supabase/01_esquema.sql`)

| Tabla | Contenido |
|---|---|
| `perfiles` | usuario (`auth.users`), `nombre`, `rol` (`admin` / `usuario`), `activo` |
| `fabricantes`, `dispositivos`, `cables`, `baterias` | catálogos (hojas ocultas BD_* del Excel) |
| `proyectos` | cabecera (`numero`, `nombre`) + `datos jsonb` con todo el proyecto (parámetros, niveles, paneles, filas, circuitos), `version`, autoría |

### Permisos (RLS)

- Registro: correos `@sinergia.co.cr` quedan **activos**; otros dominios quedan **pendientes** hasta que un admin los active (Administración → Usuarios). El dominio se cambia en la función `crear_perfil`.
- Catálogos: leen todos los miembros; **solo el admin escribe** (marcas, tipos, cables, baterías, dispositivos).
- Proyectos: leen y editan todos los miembros; elimina el creador o un admin.
- Un admin no puede quitarse a sí mismo el rol ni desactivarse.
- **Trabajo simultáneo:** cada guardado incrementa `version`; si otra persona guardó el mismo proyecto mientras se editaba, la app ofrece guardar los cambios propios como copia o cargar la versión nueva (no se pisan datos en silencio).

## Láminas DXF (DU · matriz · cálculos)

Pestaña **Diagrama unifilar**: genera tres láminas con los datos del proyecto y las descarga como **DXF** (capas `FA-*`, unidades mm) para abrirlas en AutoCAD, guardarlas como DWG o pegarlas en la lámina del proyecto (`COPYCLIP` / `PEGARCLIP`).

- **Diagrama unifilar (DU)**: estructura de la lámina ED-6200 — FACP con módulos SLC/NAC, montantes por tipo de circuito (SLC verde, NAC café, voceo azul, 24 VDC rojo), una fila por nivel con la cadena de dispositivos (símbolo, cantidad y número de llamada), tablas de simbología, cableado y notas.
- **Matriz de entradas / salidas**: estructura de la lámina ED-6201. Casillas por señal de entrada × función de salida, notas generales y numeradas. Se puede **importar el estándar del proyecto o de la marca** (PDF, Excel, Word o CSV; ver abajo) y se editan filas, columnas y notas.
- **Cálculos**: tablas de caída de tensión por fuente/panel y tarjeta de batería (NFPA 72 §10.6.7) de cada panel y fuente auxiliar, con los mismos resultados de la memoria.

**Símbolos**: NFPA 170 (2018) cap. 8 — `js/simbolos-nfpa170.js` (184 símbolos) se genera con `python excel/extraer_simbolos_nfpa170.py <NFPA170_Cap8….dxf>` (requiere `pip install ezdxf`). La correspondencia TAG del catálogo → símbolo está en `SIM_TAG` de `js/lamina.js`.

**Importación de la matriz**: busca la tabla con marcas «X» (o «X(4)»); la columna con más texto es la acción, una columna de números entre paréntesis es la nota, los encabezados son las señales de entrada, el texto encima son notas generales y las líneas «(n) …» debajo son las notas numeradas. Excel y Word se leen por celdas; el PDF se reconstruye por posición del texto (mejor esfuerzo: revise lo importado). Las librerías (SheetJS, mammoth, pdf.js) se cargan bajo demanda desde cdnjs, por lo que se requiere Internet al importar.

## Dispositivos con doble conexión (SLC + 24 VDC)

El catálogo tiene el campo opcional **«2.º circuito (24 VDC)»** (`circuito2`). Los dispositivos que lo tienen (bases sonoras SB, detectores CO con base audible y detectores de haz de luz) muestran **dos selectores de lazo** en la fila: el SLC (arriba) y el lazo de 24 VDC (abajo). El SLC cuenta el dispositivo; la corriente del catálogo se carga al lazo de 24 VDC para la caída de tensión. Si falta alguno de los dos lazos, la fila avisa. El administrador puede marcar otros dispositivos desde Administración → Dispositivos. Pendiente: el libro de Excel todavía no tiene la segunda columna de lazo.

### Láminas de 1100 × 750 mm con cajetín Sinergia
Desde la pestaña **Diagrama unifilar**: **DXF en láminas con cajetín** y **PDF en láminas con cajetín**. Usa la geometría del parche `parche-cajetin-1100x750` (marco, tira de cajetín de 127 mm, área de dibujo 911 × 724 mm). El dibujo se reparte en las láminas necesarias con una sola escala (máx. 1:1), cortando entre niveles (DU) o entre equipos (cálculos); las líneas que cruzan el corte se recortan. En el DXF las láminas quedan una al lado de otra (separación 100 mm) y el logo va como texto; el PDF lleva el logo real: en el cuadro de impresión elegir «Guardar como PDF», tamaño 1100 × 750 mm (o A0), márgenes «Ninguno» y sin encabezados. Los datos del cajetín salen del proyecto (cliente, fecha, revisión); lámina `AI-01…03`, dibujo «SI», emisión para revisión: ajustar en `hojas()` de `js/lamina.js`.

### Segundo lazo, amplificadores y sensor de CO
- **Doble conexión generalizada**: `circuito2` admite `24VDC`, `VOCEO` o `NAC`. Marcados de fábrica con SLC + 24 VDC: bases sonoras, CO con base audible, haz de luz, módulos AOM/relay/zona y detectores de ducto. Los parlantes con estrobo (`NAC+VOCEO`) van a un NAC y a un lazo de voceo, o a **un solo lazo NAC+Voceo** (misma tubería).
- **Amplificadores**: los parlantes (circuito VOCEO) asignados a un lazo de voceo de un amplificador se **cargan a ese amplificador** y no al panel donde se digitaron; su corriente de alarma = consumo propio + carga de voceo (si no hay parlantes se usa la I máx. de ficha) y avisa si excede su capacidad. El estrobo de un parlante con estrobo sigue en el NAC del panel.
- **Sensor de CO**: base `4098-9771` (CO-B, SLC + 24 VDC, símbolo NFPA 170 de detector de CO) y módulo temporal código 4 `4905-9835` (TC4). La corriente del TC4 no está en las fuentes consultadas: queda sin dato hasta digitarla de la ficha S4905-0006.
- El Excel todavía no tiene la segunda columna de lazo ni la carga de voceo al amplificador.

### «Alimentado por» y pestañas verticales
- Cada lazo de tipo VOCEO, NAC, IDNAC, 24VDC o NAC+VOCEO tiene la columna **Alimentado por** (en la pestaña del panel y en Caída de tensión): se elige la fuente auxiliar o el amplificador que lo alimenta. Los dispositivos de esos lazos (de cualquier nivel o panel) se **cargan a ese equipo** (batería, capacidad y 80 % de la fuente) y no al panel donde se digitaron; a un amplificador solo van los de voceo. La pestaña de la fuente/amplificador lista los lazos que carga y el diagrama dibuja el montante desde ese equipo.
- El botón **☰ Pestañas verticales / ⇄ Pestañas horizontales** (al final de la lista de pestañas) cambia la lista a una columna lateral; se recuerda la elección en el navegador.

### Clase A / B, cruces y especificación de cableado en el diagrama
- Cada lazo (menos 24 VDC) tiene la columna **Clase** (A o B) y se pregunta al crearlo. En el diagrama, un lazo **clase A** regresa al panel por un segundo camino (línea de retorno con su montante paralelo hasta el equipo); uno clase B termina en el último dispositivo (con RFL en notificación/zona). El cálculo de caída de tensión no cambia.
- Los montantes se **ordenan automáticamente para minimizar cruces** y los cruces que quedan se dibujan con un **salto** (arco) sobre el montante.
- La tabla «Cableado» sigue la **especificación de la ED-6200**: lazo de iniciación (verde, SLC/IDC), notificación y voceo (café), 24 VDC permanentes (negro), más red y teléfonos (apagados por defecto). Los textos son editables con casilla en «Notas del diagrama»; `{SLC}`, `{IDC}`, `{NAC}`, `{VOCEO}`, `{24VDC}` se reemplazan por el cable elegido en los lazos de ese tipo (exteriores: West Penn AQ225).

### Simbología CDCLH-001S
- `js/simbologia-cdclh.js` (generado con `python excel/generar_simbologia.py <Simplex.pdf> <Notifier.pdf>`) trae las **25 filas de la simbología CDCLH-001S** (descripción y referencia de cada fabricante) enlazadas con el símbolo NFPA 170 y con los dispositivos del catálogo (por tipo/tag).
- La leyenda del diagrama agrupa por fila de la simbología: usa la descripción de la lámina y la referencia del fabricante, **completada con los modelos cargados en el catálogo** (los usados en el proyecto; los del fabricante del proyecto en las filas que se fuerzan a mostrar). Numeración de llamadas por fila.
- Pestaña **Diagrama unifilar → Simbología**: lámina con toda la simbología (DXF/PDF/láminas con cajetín `AI-04`) y, debajo del dibujo, el editor: por fila «Automático / Siempre / Nunca», descripción y referencia editables (referencia vacía = automática). Se guarda en el proyecto.
- Revisión en línea (2026-11): Notifier FSP-851/FST-851 → serie 951 (ya cargada), y la 951 figura descontinuada sin sucesor publicado (anotado en el catálogo); 49AV-WRF aparece como reemplazo de la 4906-9227 de Simplex. No se encontraron otros modelos nuevos que cambien el catálogo; confirmar con el distribuidor.

- «Alimentado por» ofrece **fuentes auxiliares (RPS) y amplificadores** en todos los lazos (primero los que corresponden al tipo: voceo → amplificadores; NAC/IDNAC/24 VDC → fuentes). Con una asignación explícita se cargan al equipo elegido todos los dispositivos del lazo; sin asignar, un lazo propio de un amplificador solo le carga los de voceo.

### Textos del diagrama, red de comunicación y buscador de modelos
- **Textos**: una sola tipografía (Century Gothic; en DXF, estilo `CENTURY`/GOTHIC.TTF), altura mínima **2.2 mm** en el dibujo (nunca menos de 2 mm tras la escala de la lámina) y rótulos **siempre horizontales** en el diagrama (los de los montantes se escalonan para no encimarse). En la vista previa se puede **arrastrar** un texto (rótulos de lazo, líneas de datos, cantidades, montantes, niveles, red) y la posición se guarda en el proyecto (`duMov`); «Restablecer textos» la devuelve. Las posiciones también salen en DXF/PDF.
- **Red de comunicación**: el diagrama dibuja la red (capa `FA-RED`, azul claro, según la especificación) del FACP a cada transponder, fuente auxiliar y amplificador de los demás niveles; si la fuente/amplificador se alimenta desde otro panel («Alimentada desde»), se rotula «desde TRP-xx». La especificación de «red o comunicación» queda activa por defecto en la tabla de cableado.
- **Modelos**: en «Dispositivos conectados», el modelo se elige **escribiendo** (filtra por fabricante, modelo, tag, tipo y descripción; varias palabras a la vez, p. ej. «jack», «co sb 4098»); ↑↓ y Enter, o clic. Al elegir un modelo de otro fabricante, la fila cambia de fabricante sola.

### Diagrama: recorte de líneas, textos dentro del marco y lazos por varios niveles
- Las líneas de lazo se **cortan (trim)** alrededor de cada símbolo: entran por un lado del dispositivo/módulo y salen por el otro, sin atravesarlo.
- El ancho de los textos se calcula con el de **Century Gothic en mayúsculas** (más anchas que lo supuesto antes); tablas, notas, leyenda y notas junto al FACP se ajustan a su caja y nada sale del marco/cajetín (se verificó en las 4 láminas). En el DXF, los símbolos que la fuente no trae (×, ·, —, →, Δ, Ω…) salen como equivalentes ASCII para no verse como «?».
- Un lazo (también clase A) se dibuja en **todos los niveles donde tiene dispositivos** (según el nivel de cada fila): un renglón por nivel, con su retorno propio si es clase A; los datos de cálculo (disp., mA, longitud, cable, ΔV) van en el renglón del nivel principal del lazo y los demás indican cuántos dispositivos tiene ese nivel.
