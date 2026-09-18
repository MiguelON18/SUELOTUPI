# SueloTUPI

Visor territorial académico y ligero de San Andrés de Tupicocha para apoyar la lectura conjunta de cobertura del suelo, microcuenca, población, catastro, vías, hidrología y peligros.

## Estado de la Beta

- 15 capas y 750 entidades procedentes del KMZ validado.
- Navegación, búsqueda, leyenda dinámica, control de visibilidad e identificación por clic.
- El mapa se mantiene libre de etiquetas permanentes: el nombre y los atributos aparecen únicamente al seleccionar una entidad, dentro de la ficha derecha.
- Mapa base OpenStreetMap opcional al ejecutar mediante HTTP o GitHub Pages.
- Al abrir `index.html` directamente como archivo, el visor desactiva el mapa base para evitar el bloqueo 403 del proveedor y conserva todas las capas vectoriales.
- Descarga del KMZ para Google Earth Pro.
- Sin dashboard temporal todavía.
- AID y AII deliberadamente pendientes de delimitación participativa.
- Planet reservado para análisis privado; no hay imágenes ni derivados restringidos en este repositorio.

## Vista local

Desde esta carpeta, iniciar un servidor estático:

```bash
python3 -m http.server 8000
```

Abrir `http://localhost:8000`. Esta es la forma recomendada para probar también el mapa base.

## Publicación en GitHub Pages

1. Crear un repositorio público, por ejemplo `suelotupi`.
2. Subir el contenido de esta carpeta a la rama `main`.
3. En GitHub: **Settings → Pages → Build and deployment**.
4. Elegir **Deploy from a branch**, rama `main` y carpeta `/ (root)`.
5. Guardar y esperar la URL `https://USUARIO.github.io/suelotupi/`.

No subir claves, archivos Planet, GeoTIFF, bandas, reflectancia, píxeles, tiles privados ni URLs autenticadas.

## Reconstrucción de datos

El archivo `data/layers.js` se genera desde el KMZ validado:

```bash
python3 scripts/build_layers.py
```

El proceso usa únicamente la biblioteca estándar de Python y conserva la trazabilidad con el entregable cartográfico.

## Fuentes y límites

Las fuentes detalladas aparecen en los atributos de cada capa. La simbología de cobertura sigue la leyenda de MapBiomas Perú Colección 4. El mapa base corresponde a OpenStreetMap y requiere conexión a Internet.

Este visor es una herramienta de exploración para el curso de Planificación Ambiental. No reemplaza trabajo de campo, análisis de laboratorio ni una delimitación ambiental sustentada del AID/AII.
