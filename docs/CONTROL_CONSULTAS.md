# Control de consultas por instalación del navegador — v146

## Reglas
- Solo aplica a consultas estudiantiles. Administrador y docentes conservan el acceso anterior.
- Hasta 5 estudiantes diferentes al día por instalación de navegador, según fecha de America/Bogota.
- Reconsultar el mismo estudiante no consume otro cupo.
- Cinco estudiantes diferentes en dos minutos activan un bloqueo de perfiles nuevos por 48 horas, pero el quinto resultado sí se entrega.
- Al reincidir tras el bloqueo se aplican 72 horas. Durante el bloqueo, cinco intentos de perfiles nuevos distintos en dos minutos también elevan el bloqueo de 48 a 72 horas.
- Durante el bloqueo siguen disponibles los perfiles ya consultados, sin exceder el máximo diario.

## Identificador y privacidad
El sitio genera un UUID v4 y lo guarda en localStorage. Supabase almacena SHA-256 de ese UUID,
los ID de prueba visitados y fechas. No se recopilan IP ni direcciones MAC en este módulo.
Esto identifica una instalación de navegador, NO un aparato físico: limpiar los datos, cambiar
de navegador o usar incógnito permite obtener otro identificador. Para una garantía real contra
esa evasión se necesitarán secretos individuales no consecutivos o autenticación fuerte.

## Tres pasos de despliegue (obligatorios y en ese orden)
1. Instalar supabase/12_instalar_control_terminales.sql en SQL Editor. Crea nuevas funciones privadas y públicas, sin revocar la versión antigua.
2. Publicar la rama seguridad-consultas-v146 en main y probar un acceso real de estudiante, otro de docente y otro de administrador.
3. Instalar supabase/13_cerrar_rutas_antiguas.sql. Revoca la ejecución anónima de RPC antiguas para impedir eludir el límite por acceso directo a la API.

El sistema NO se considera protegido hasta completar y verificar los tres pasos.

## Pruebas controladas
Usar datos sintéticos en un proyecto de pruebas para verificar el sexto perfil, el disparo de 48 horas
y la reincidencia de 72 horas. No bloquear teléfonos reales de estudiantes durante las pruebas.
Los bloqueos usan transacciones por navegador para evitar sobrepasar el contador con dos pestañas.

## Otras superficies que requieren auditoría
- Los docentes actualmente se autentican con el ID del docente, sin contraseña personal.
- Existen rutas heredadas de administración que merecen revisión y migración a Supabase Auth.
- La nueva RPC de ranking solo devuelve los renglones del propio estudiante (conserva puesto y total), no la lista de notas e identidades de todo su grado.
- No colocar en GitHub Pages archivos con resultados, documentos ni claves correctas.
- Los datos de acceso privados requerirán política institucional de retención y avisos de privacidad.