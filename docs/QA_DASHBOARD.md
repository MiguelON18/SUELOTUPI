# Control de calidad — Dashboard MapBiomas–INEI

**Fecha:** 18 de septiembre de 2026  
**Estado:** apto para exploración descriptiva y demostración académica.

## Fuentes y grano

- MapBiomas: área en hectáreas por clase y año para San Andrés de Tupicocha, 1985–2025.
- INEI: indicadores distritales del Censo 2017 y publicaciones asociadas.
- Unidad temporal MapBiomas: año.
- Unidad territorial MapBiomas: microcuenca de trabajo.
- Unidad territorial INEI: distrito San Andrés de Tupicocha.
- INEI es un corte censal, no una serie anual comparable año a año con MapBiomas.

## Controles ejecutados

- 29 filas y 41 columnas anuales revisadas en la serie MapBiomas.
- 10 clases con superficie mayor que cero en al menos un año.
- 0 claves duplicadas en `Nivel 1 + Nivel 2`.
- 0 valores negativos o no finitos.
- variación máxima del área total: menor que `0,000001 ha` por redondeo numérico;
- error máximo entre clases y totales de nivel 1: `0 ha`;
- diferencia máxima entre la columna 2025 de la serie y el CSV independiente 2025: `0 ha`;
- área MapBiomas clasificada: `8 933,53 ha`;
- área vectorial de la microcuenca: `8 869,58 ha`;
- diferencia de borde ráster/vector: `63,95 ha` (`0,72 %`);
- extensión de cobertura prácticamente coincidente con la microcuenca y más próxima que al límite distrital;
- suma de grupos de edad INEI: 1 303 personas, igual al denominador publicado para viviendas particulares;
- suma de viviendas con y sin alumbrado: 442, igual al total publicado.

## Pruebas de interfaz

- carga local mediante HTTP: aprobada;
- consola del navegador: sin errores;
- control temporal 1985–2025: aprobado;
- reinicio a 2025: aprobado;
- vínculo desde el visor: aprobado;
- escritorio 1440 × 900: aprobado sin desbordamiento horizontal;
- móvil 390 × 844: aprobado.

## Límites

- MapBiomas no reemplaza cartografía parcelaria ni validación de campo.
- Los indicadores INEI 2017 usan el ámbito distrital, mientras MapBiomas usa la microcuenca; contextualizan, pero no son directamente comparables ni demuestran causalidad.
- El dashboard no mide calidad del suelo.
- No se incorporaron datos Planet, rásteres, valores por píxel ni credenciales.
