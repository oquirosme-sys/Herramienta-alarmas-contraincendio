-- =====================================================================
-- Baterías · Alarma contra incendio — esquema Supabase (Postgres)
-- Ejecutar UNA vez en Supabase → SQL Editor (es re-ejecutable: usa IF NOT EXISTS / OR REPLACE).
-- Después ejecutar 02_semilla_catalogo.sql para cargar el catálogo del Excel.
--
-- Modelo de permisos (RLS):
--   · Solo usuarios con correo @sinergia.co.cr quedan ACTIVOS al registrarse (los demás quedan pendientes).
--   · El PRIMER usuario activo que se registra queda como ADMINISTRADOR.
--   · Catálogos (fabricantes, dispositivos, cables, baterías): todos los miembros leen; solo admin escribe.
--   · Proyectos: todos los miembros leen y editan (trabajo en equipo); elimina el creador o un admin.
--   · Perfiles: los miembros ven la lista (nombres); solo el admin edita rol / activo.
-- =====================================================================

-- ---------- Perfiles y roles ----------
create table if not exists public.perfiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  nombre     text,
  rol        text not null default 'usuario' check (rol in ('admin', 'usuario')),
  activo     boolean not null default false,
  creado_en  timestamptz not null default now()
);

create or replace function public.es_miembro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where user_id = auth.uid() and activo);
$$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where user_id = auth.uid() and activo and rol = 'admin');
$$;

-- Al registrarse un usuario en Supabase Auth se crea su perfil
create or replace function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  dominio_ok boolean := lower(split_part(new.email, '@', 2)) = 'sinergia.co.cr';  -- ← dominio permitido
begin
  insert into public.perfiles (user_id, email, nombre, activo, rol)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(new.email, '@', 1)),
    dominio_ok,
    case when dominio_ok and not exists (select 1 from public.perfiles where rol = 'admin') then 'admin' else 'usuario' end
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.crear_perfil();

-- Un administrador no puede quitarse a sí mismo el rol ni desactivarse (evita quedarse sin admin)
create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id = auth.uid() and (new.rol <> old.rol or new.activo <> old.activo) then
    raise exception 'No puede cambiar su propio rol ni desactivarse';
  end if;
  new.email := old.email;
  return new;
end $$;

drop trigger if exists proteger_perfil on public.perfiles;
create trigger proteger_perfil before update on public.perfiles
  for each row execute function public.proteger_perfil();

-- ---------- Columnas de auditoría comunes ----------
create or replace function public.tocar_auditoria() returns trigger
language plpgsql as $$
begin
  new.actualizado_en := now();
  new.actualizado_por := auth.uid();
  return new;
end $$;

-- ---------- Catálogos (equivalen a las hojas ocultas BD_* del Excel) ----------
create table if not exists public.fabricantes (
  id               text primary key,
  nombre           text not null,
  orden            int  not null default 0,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid default auth.uid()
);

create table if not exists public.dispositivos (
  id               text primary key,
  fabricante_id    text not null references public.fabricantes (id) on update cascade on delete restrict,
  modelo           text not null default '',
  tag              text not null default '',
  descripcion      text not null default '',
  i_espera_ma      numeric,            -- mA a 24 VDC
  i_alarma_ma      numeric,            -- mA a 24 VDC
  circuito         text not null default '',
  obs              text not null default '',
  orden            int  not null default 0,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid default auth.uid()
);
create index if not exists dispositivos_fabricante_idx on public.dispositivos (fabricante_id);

create table if not exists public.cables (
  id               text primary key,
  fabricante       text not null default '',
  modelo           text not null default '',
  awg              numeric,
  conductores      numeric,
  pantalla         text not null default '',
  listado          text not null default '',
  r_ohm_km         numeric,            -- Ω/km por conductor a 20 °C
  uso              text not null default '',
  obs              text not null default '',
  orden            int  not null default 0,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid default auth.uid()
);

create table if not exists public.baterias (
  id               text primary key,
  ah               numeric,            -- 12 V SLA, 2 en serie = 24 V
  ref_simplex      text not null default '',
  ref_notifier     text not null default '',
  ref_generica     text not null default '',
  obs              text not null default '',
  orden            int  not null default 0,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid default auth.uid()
);

-- ---------- Proyectos ----------
-- El proyecto completo (parámetros, niveles, paneles, filas, circuitos) se guarda como documento JSON
-- en «datos»; numero/nombre se repiten en columnas para listar y buscar.
-- «version» se incrementa en cada guardado: la app la usa para detectar si otro usuario
-- modificó el proyecto al mismo tiempo (control de concurrencia optimista).
create table if not exists public.proyectos (
  id               text primary key,
  numero           text not null default '',
  nombre           text not null default '',
  datos            jsonb not null,
  version          int  not null default 1,
  creado_por       uuid default auth.uid() references public.perfiles (user_id) on delete set null,
  creado_en        timestamptz not null default now(),
  actualizado_por  uuid default auth.uid() references public.perfiles (user_id) on delete set null,
  actualizado_en   timestamptz not null default now()
);
create index if not exists proyectos_actualizado_idx on public.proyectos (actualizado_en desc);

create or replace function public.versionar_proyecto() returns trigger
language plpgsql as $$
begin
  new.version := old.version + 1;
  new.creado_por := old.creado_por;
  new.creado_en := old.creado_en;
  return new;
end $$;

-- Triggers de auditoría
do $$
declare t text;
begin
  foreach t in array array['fabricantes', 'dispositivos', 'cables', 'baterias', 'proyectos'] loop
    execute format('drop trigger if exists auditoria on public.%I', t);
    execute format('create trigger auditoria before update on public.%I for each row execute function public.tocar_auditoria()', t);
  end loop;
end $$;

drop trigger if exists versionar on public.proyectos;
create trigger versionar before update on public.proyectos
  for each row execute function public.versionar_proyecto();

-- ---------- Seguridad a nivel de fila (RLS) ----------
alter table public.perfiles     enable row level security;
alter table public.fabricantes  enable row level security;
alter table public.dispositivos enable row level security;
alter table public.cables       enable row level security;
alter table public.baterias     enable row level security;
alter table public.proyectos    enable row level security;

-- Perfiles
drop policy if exists perfiles_leer on public.perfiles;
create policy perfiles_leer on public.perfiles for select to authenticated
  using (user_id = auth.uid() or public.es_miembro());   -- los miembros ven nombres de colegas («editado por»)
drop policy if exists perfiles_admin on public.perfiles;
create policy perfiles_admin on public.perfiles for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Catálogos: leen miembros, escribe admin
do $$
declare t text;
begin
  foreach t in array array['fabricantes', 'dispositivos', 'cables', 'baterias'] loop
    execute format('drop policy if exists %I on public.%I', t || '_leer', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.es_miembro())', t || '_leer', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.es_admin()) with check (public.es_admin())', t || '_admin', t);
  end loop;
end $$;

-- Proyectos
drop policy if exists proyectos_leer on public.proyectos;
create policy proyectos_leer on public.proyectos for select to authenticated using (public.es_miembro());
drop policy if exists proyectos_crear on public.proyectos;
create policy proyectos_crear on public.proyectos for insert to authenticated with check (public.es_miembro());
drop policy if exists proyectos_editar on public.proyectos;
create policy proyectos_editar on public.proyectos for update to authenticated
  using (public.es_miembro()) with check (public.es_miembro());
drop policy if exists proyectos_eliminar on public.proyectos;
create policy proyectos_eliminar on public.proyectos for delete to authenticated
  using (creado_por = auth.uid() or public.es_admin());

-- Permisos de tabla para el rol autenticado (RLS decide qué filas)
grant select, update on public.perfiles to authenticated;
grant select, insert, update, delete on public.fabricantes, public.dispositivos, public.cables, public.baterias, public.proyectos to authenticated;
revoke all on public.perfiles, public.fabricantes, public.dispositivos, public.cables, public.baterias, public.proyectos from anon;

-- ---------- Utilidades para el administrador (ejecutar a mano si hace falta) ----------
-- Hacer admin a un usuario:
--   update public.perfiles set rol = 'admin', activo = true where email = 'correo@sinergia.co.cr';
-- Activar un usuario externo (otro dominio):
--   update public.perfiles set activo = true where email = 'consultor@otro.com';
