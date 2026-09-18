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
- nombres y atributos solo en la ficha derecha, sin etiquetas permanentes sobre la cobertura: aprobado;
- leyenda dinámica: aprobada;
- mapa base opcional mediante HTTP: aprobado;
- apertura directa como archivo: modo vectorial local sin solicitudes bloqueadas al servidor de mapas;
- vista de escritorio: aprobada;
- vista móvil 390 × 844: aprobada después de corregir el ancho del mapa;
- consola del navegador: sin errores ni advertencias durante las pruebas finales.
- enlace entre el visor y `dashboard.html`: aprobado.
- control temporal del dashboard: aprobado para 1985 y retorno a 2025.
- dashboard en escritorio 1440 × 900 y móvil 390 × 844: aprobado.
- conciliación de la serie MapBiomas: 41 años, 10 clases activas, sin duplicados, negativos ni diferencias en el corte 2025.

## Límites declarados

- El mapa base requiere Internet; las capas temáticas son locales.
- AID y AII no se han automatizado.
- El dashboard es descriptivo y usa un corte INEI 2017; no atribuye causalidad entre población y cambio de cobertura.
- No existe un índice de calidad del suelo sin datos de campo/laboratorio.
- No hay imágenes, bandas, píxeles, API keys ni productos Planet restringidos.

## Publicación

Antes de hacer público el repositorio se debe revisar que no se hayan añadido archivos Planet, secretos, datos personales sensibles ni archivos temporales ajenos al producto.
