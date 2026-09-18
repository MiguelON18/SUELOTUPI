# Control de calidad — SueloTUPI Beta

**Fecha:** 18 de septiembre de 2026  
**Estado:** aprobado para demostración académica local y preparación de GitHub Pages.

## Integridad de datos

- 15 capas cargadas.
- 750 entidades cargadas.
- Coordenadas WGS 84.
- Geometrías y atributos derivados del KMZ previamente validado.
- Simbología de las 10 clases de cobertura conservada según la tabla MapBiomas utilizada en el proyecto.
- KMZ incluido como descarga: 594 KiB.
- Paquete web completo: aproximadamente 2.5 MiB antes de comprimir.

## Pruebas funcionales

- carga inicial: aprobada;
- navegación, zoom y desplazamiento: aprobados;
- encendido y apagado de capas: aprobado;
- búsqueda de capas y entidades: aprobada;
- selección por clic y ficha de atributos: aprobada;
- leyenda dinámica: aprobada;
- mapa base opcional mediante HTTP: aprobado;
- apertura directa como archivo: modo vectorial local sin solicitudes bloqueadas al servidor de mapas;
- vista de escritorio: aprobada;
- vista móvil 390 × 844: aprobada después de corregir el ancho del mapa;
- consola del navegador: sin errores ni advertencias durante las pruebas finales.

## Límites declarados

- El mapa base requiere Internet; las capas temáticas son locales.
- AID y AII no se han automatizado.
- Los CSV temporales no forman todavía un dashboard.
- No existe un índice de calidad del suelo sin datos de campo/laboratorio.
- No hay imágenes, bandas, píxeles, API keys ni productos Planet restringidos.

## Publicación

Antes de hacer público el repositorio se debe revisar que no se hayan añadido archivos Planet, secretos, datos personales sensibles ni archivos temporales ajenos al producto.
