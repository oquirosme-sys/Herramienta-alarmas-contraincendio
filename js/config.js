/* Configuración de conexión.
 * Con supabaseUrl y supabaseAnonKey vacíos la herramienta trabaja en modo local (navegador).
 * Valores en Supabase → Project Settings → API:
 *   · Project URL            → supabaseUrl
 *   · anon / public key      → supabaseAnonKey
 * La clave «anon» es pública por diseño (va en el navegador); la seguridad la dan las políticas RLS
 * de supabase/01_esquema.sql. NUNCA coloque aquí la clave «service_role». */
window.APP_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: ''
};
