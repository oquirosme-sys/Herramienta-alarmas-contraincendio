# Baterías · Alarma contra incendio

Herramienta web (HTML + JS, sin compilación) que reemplaza el libro **Cálculo_baterías_Alarmas.xlsx**:
baterías secundarias, fuentes auxiliares y caída de tensión según **NFPA 72:2022 §10.6.7 / UL 864 / NEC Art. 760**.

## Uso

1. **Proyecto** — datos generales, parámetros NFPA 72 (24 h espera, 5/15 min alarma, FS 20 %, 85 % fin de vida, 16 V mín., 2.4 A NAC) y **niveles del edificio**.
   Con los niveles definidos, «Crear un panel/transponder por nivel» genera una pestaña por nivel (el primero es FACP, los demás TRP).
2. **Pestaña de cada panel / transponder** — tabla de dispositivos: Fabricante → Modelo → Nivel/zona y cantidad.
   Las corrientes salen del catálogo; si se digita un valor unitario, reemplaza al del catálogo (celda amarilla).
   Cada equipo calcula su propia batería y selecciona la capacidad estándar inmediata superior.
3. **Pestaña de cada fuente auxiliar** — igual, más consumo propio y verificación del 80 % de I máx.
4. **Caída de tensión** — una tabla para todo el proyecto, método de carga concentrada.
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
