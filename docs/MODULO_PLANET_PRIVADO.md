# Módulo Planet privado — diseño de integración

## Función

PlanetScope aportará detalle espacial reciente para caracterizar cobertura, suelo desnudo, parcelas, caminos, superficies alteradas y rasgos de erosión visibles. No medirá directamente calidad del suelo ni sustituirá campo o laboratorio.

## Separación obligatoria

### Repositorio público SueloTUPI

- código del visor;
- datos abiertos y capas autorizadas;
- estadísticas agregadas;
- metodología y limitaciones;
- figuras estáticas revisadas y atribuidas cuando corresponda.

### Carpeta local privada fuera de GitHub

- API key y autenticación;
- escenas, GeoTIFF, bandas y máscaras;
- reflectancia, índices y valores por píxel;
- pedidos, URLs autenticadas y productos detallados;
- resultados ambiguos pendientes de revisión.

## Piloto mínimo

1. Congelar pregunta, AOI y ventana temporal.
2. Revisar metadatos, preview, nubosidad y permiso del producto.
3. Presupuestar cuota antes de ordenar.
4. Descargar una o pocas escenas localmente.
5. Verificar nubes, sombras, relieve y co-registro con capas abiertas.
6. Comparar con MapBiomas como concordancia, no como exactitud.
7. Publicar únicamente una salida previamente clasificada y revisada.

## Variables candidatas

- persistencia de cobertura vegetal;
- frecuencia de suelo desnudo;
- límites de parcelas y andenes;
- alteración superficial visible;
- conectividad entre laderas, vías y drenaje;
- estratos candidatos para muestreo.

## Criterio de parada

El piloto se detiene si no existe una fecha útil, el producto no está habilitado, la nubosidad/sombra impide la lectura, el co-registro es insuficiente o la salida necesaria no puede publicarse legalmente.

La política controladora permanece en `/Users/administrador/Documents/CLAUDE/contexto/POLITICA_USO_SEGURO_PLANET_ER.md`.
