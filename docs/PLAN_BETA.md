# Plan de producto — SueloTUPI Beta

## Decisión

**GO condicionado.** La Beta debe servir para discutir y justificar el área de estudio; no debe prometer un índice de calidad del suelo sin datos de campo y laboratorio.

## Usuario y decisión apoyada

- **Usuario inmediato:** equipo del curso y profesora de Planificación Ambiental.
- **Decisión:** delimitar de forma argumentada el Área de Influencia Directa e Indirecta.
- **Escala inicial:** distrito como contexto; microcuenca, núcleo urbano y áreas productivas como lectura detallada.

## Producto mínimo

1. KMZ interactivo para Google Earth Pro.
2. Geovisor web ligero con capas verificadas y fichas de atributos.
3. Registro explícito de vacíos: AID/AII, campo, laboratorio y variables socioeconómicas pendientes.
4. Módulo Planet privado, separado del producto público.

## Puertas de decisión

| Puerta | Evidencia requerida | Resultado |
|---|---|---|
| P0 — inventario | capas, fuentes, geometrías y atributos verificados | completada |
| P1 — visor | carga, navegación, leyenda, selección y búsqueda funcionales | Beta actual |
| P2 — delimitación | criterio de presión, receptor, conectividad y validación con profesora | AID/AII defendibles |
| P3 — suelo | indicadores de campo/laboratorio, diseño muestral y QA/QC | índice de calidad posible |
| P4 — Planet | AOI, fechas, producto, cuota, co-registro y salida permitida | piloto privado |
| P5 — dashboard | conciliación de CSV, definiciones y lectura temporal | módulo analítico |

## Riesgos controladores del premortem

| Riesgo | Señal temprana | Control aplicado |
|---|---|---|
| Visor visualmente atractivo pero sin decisión | capas encendidas sin una pregunta común | mensaje central y flujo AID/AII |
| “Calidad del suelo” inferida solo por satélite | ausencia de pH, carbono, CE u otros indicadores | etiqueta de evidencia territorial; índice bloqueado hasta campo |
| Confundir resolución con exactitud | Planet tratado como verdad terreno | Planet como apoyo y estratificador, no referencia independiente |
| Publicar datos Planet restringidos | raster/tiles/valores en GitHub | separación física del módulo privado |
| Mapa lento o difícil de usar | demora, saturación, demasiadas capas activas | visor estático, vista esencial y capas de contexto apagables |
| AID/AII arbitrarias | buffer sin mecanismo ambiental | delimitación aplazada hasta acordar presiones y conectividad |

## Siguiente incremento recomendado

La prioridad no es añadir más tecnología. Es registrar durante la clase los criterios usados para AID/AII y convertirlos después en dos capas nuevas con metadatos: responsable, fecha, criterio, fuente y nivel de confianza.
