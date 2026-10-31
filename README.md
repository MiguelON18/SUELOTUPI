# SueloTUPI

Visor académico de planificación ambiental de San Andrés de Tupicocha, Huarochirí, Lima, Perú.

**Web:** https://MiguelON18.github.io/SUELOTUPI/

## Versión publicada el 31 de octubre de 2026

- Mapa con 17 capas y 789 entidades, filtros por clase MapBiomas, fichas resumidas, zoom y arrastre.
- AID referencial del casco urbano: 17,683204 ha. AII: aporte superficial Copernicus intersecado con el distrito, 2636,801906 ha. AII incluye AID.
- Pendientes porcentuales y curvas cada 50 m, principales cada 250 m, derivadas del DSM Copernicus GLO30.
- Datos MapBiomas Perú Colección 4 de 1985–2025 recalculados para los ámbitos actuales.
- Censos distritales 2017 y 2025: edades, agua, educación, movilidad, lengua y residencia anterior; con bases y notas de comparación.
- Territorio y cultura, panorama del pueblo y cuatro programas de Acción con actores propuestos, mantenimiento e indicadores.
- Esri World Imagery y OpenStreetMap como mapas base online, con atribución visible.

## Fuentes y créditos

La citación completa, licencias y adaptaciones se describen en [Fuentes y créditos](fuentes.html) y [metadatos de créditos](data/creditos.json). Los productos mantienen las licencias de sus proveedores; no se aplica una licencia única a todos los datos.

Origen de cobertura: MapBiomas Perú. Origen censal: INEI; extracción y armonización intermedia de Oscar Salas, proyecto independiente no oficial. Relieve: Copernicus WorldDEM-30, atribución de DLR, Airbus, Unión Europea y ESA conservada. Se identifican por separado los resultados y las interpretaciones del equipo.

No se publican geodatabases, insumos originales, credenciales, imágenes Planet ni paquetes históricos de otras delimitaciones. La publicación de las geometrías recortadas fue autorizada por Jhoreck el 31/10/2026.

## Alcance

Los límites son ámbitos académicos referenciales. Cobertura y agricultura no certifican fertilidad, tipo de suelo o aptitud; inventarios y contactos no son huellas de eventos ni alertas. El censo corresponde al distrito completo. Las propuestas no acreditan convenios, financiamiento ni ejecución de obras; se conservan los faltantes de campo.

## Uso y comprobación

Sitio estático, sin instalación ni cuenta para consultarlo. Abrir la dirección web y utilizar Mapa, Datos, Territorio y cultura y Acción. La cartografía de fondo requiere internet.

Para ejecutar localmente: `python3 -m http.server 8000` desde la carpeta del sitio. Pruebas de interacción por código: `node --test scripts/test_*.cjs`.

Los reconstructores de versiones antiguas no deben ejecutarse sobre esta versión: usarían fuentes o delimitaciones sustituidas. La historia anterior permanece conservada en Git.
