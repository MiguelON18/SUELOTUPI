#!/usr/bin/env python3
"""Build the reviewed SueloTUPI dashboard snapshot from local MapBiomas CSVs.

The output contains only aggregate land-cover areas and public INEI indicators.
It intentionally contains no Planet imagery, raster values, credentials or URLs.
"""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
APP = Path(__file__).resolve().parents[1]
SERIES_CSV = ROOT / "FOR_MAPA" / "Serie temporal de Cobertura • Cobertura por clase • 1985 - 2025 (1).csv"
SNAPSHOT_CSV = ROOT / "FOR_MAPA" / "Cobertura • Cobertura por clase • 2025.csv"
LAYERS_JS = APP / "data" / "layers.js"
OUTPUT = APP / "data" / "dashboard.js"


COLORS = {
    "Bosque": "#1f8d49",
    "Plantación forestal": "#7a6c00",
    "Formación herbácea": "#d6bc74",
    "Mosaico agropecuario": "#ffcf56",
    "Infraestructura urbana": "#d4271e",
    "Río, lago u océano": "#2532e4",
    "Matorral y otros arbustales": "#a89358",
    "Otra área natural sin vegetación": "#e97a7a",
    "Herbazal inundable altoandino": "#26abab",
    "Superficie rocosa": "#d98a45",
}


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def clean(value: str) -> str:
    return " ".join((value or "").strip().split())


def main() -> None:
    series_rows = read_csv(SERIES_CSV)
    snapshot_rows = read_csv(SNAPSHOT_CSV)
    years = [str(year) for year in range(1985, 2026)]

    keys = [(clean(row["Nivel 1"]), clean(row["Nivel 2"])) for row in series_rows]
    if len(keys) != len(set(keys)):
        raise ValueError("Duplicate Nivel 1/Nivel 2 keys in MapBiomas time series")

    totals = {}
    classes = []
    for row in series_rows:
        parent = clean(row["Nivel 1"])
        name = clean(row["Nivel 2"])
        values = [float(row[year]) for year in years]
        if any(not math.isfinite(value) or value < 0 for value in values):
            raise ValueError(f"Invalid values for {parent}/{name}")
        if not name:
            totals[parent] = values
        elif max(values) > 0:
            classes.append({
                "name": name,
                "group": parent,
                "color": COLORS.get(name, "#819087"),
                "values": values,
            })

    required_totals = {"Natural", "Antrópico", "No definido"}
    if set(totals) != required_totals:
        raise ValueError(f"Unexpected level-1 totals: {sorted(totals)}")

    total_area = [sum(totals[group][i] for group in required_totals) for i in range(len(years))]
    total_spread = max(total_area) - min(total_area)
    if total_spread > 0.02:
        raise ValueError(f"Study area is not stable across years: spread={total_spread}")

    reconciliation_errors = []
    for group in ("Natural", "Antrópico"):
        group_classes = [item for item in classes if item["group"] == group]
        for index, year in enumerate(years):
            detail_sum = sum(item["values"][index] for item in group_classes)
            reconciliation_errors.append(abs(detail_sum - totals[group][index]))
    max_reconciliation_error = max(reconciliation_errors)
    if max_reconciliation_error > 0.02:
        raise ValueError(f"Class totals do not reconcile: max error={max_reconciliation_error}")

    snapshot = {
        (clean(row["Nivel 1"]), clean(row["Nivel 2"])): float(row["2025"])
        for row in snapshot_rows
    }
    max_snapshot_difference = 0.0
    for row in series_rows:
        key = (clean(row["Nivel 1"]), clean(row["Nivel 2"]))
        if key not in snapshot:
            raise ValueError(f"2025 snapshot is missing {key}")
        max_snapshot_difference = max(max_snapshot_difference, abs(float(row["2025"]) - snapshot[key]))
    if max_snapshot_difference > 1e-6:
        raise ValueError(f"2025 snapshot does not match series: {max_snapshot_difference}")

    layers_text = LAYERS_JS.read_text(encoding="utf-8")
    layers_data = json.loads(layers_text[len("window.SUELOTUPI_DATA="):-2])
    layers_by_title = {layer["title"]: layer for layer in layers_data["layers"]}
    micro_layer = layers_by_title["Microcuenca de trabajo"]
    district_layer = layers_by_title["Distrito San Andrés de Tupicocha"]
    coverage_layer = layers_by_title["Cobertura 2025"]

    def area_from_property(layer: dict, key: str = "Área geométrica") -> float:
        value = layer["features"][0]["properties"][key]
        return float(value.replace(",", "").replace(" ha", ""))

    micro_area = area_from_property(micro_layer)
    district_area = area_from_property(district_layer)
    classified_area = total_area[-1]
    scope_difference = classified_area - micro_area
    scope_difference_pct = scope_difference / micro_area * 100
    bbox_delta_micro = max(abs(a - b) for a, b in zip(coverage_layer["bbox"], micro_layer["bbox"]))
    bbox_delta_district = max(abs(a - b) for a, b in zip(coverage_layer["bbox"], district_layer["bbox"]))
    if bbox_delta_micro >= bbox_delta_district:
        raise ValueError("Coverage extent is not closer to the micro-watershed than to the district")

    payload = {
        "project": {
            "name": "SueloTUPI",
            "district": "San Andrés de Tupicocha",
            "analysisScope": "Microcuenca San Andrés",
            "ubigeo": "150715",
            "generated": "2026-09-18",
            "period": "1985–2025",
            "unit": "ha",
            "baselineYear": 1985,
            "latestYear": 2025,
        },
        "years": [int(year) for year in years],
        "totals": {
            "Natural": totals["Natural"],
            "Antrópico": totals["Antrópico"],
            "No definido": totals["No definido"],
            "Área analizada": total_area,
        },
        "classes": classes,
        "scope": {
            "mapbiomas": "Microcuenca de trabajo",
            "inei": "Distrito San Andrés de Tupicocha",
            "classifiedAreaHa": classified_area,
            "microWatershedVectorAreaHa": micro_area,
            "districtVectorAreaHa": district_area,
            "classifiedVsMicroDifferenceHa": scope_difference,
            "classifiedVsMicroDifferencePct": scope_difference_pct,
            "coverageVsMicroBboxMaxDeltaDegrees": bbox_delta_micro,
            "coverageVsDistrictBboxMaxDeltaDegrees": bbox_delta_district,
        },
        "inei": {
            "censusYear": 2017,
            "populationCensada": 1320,
            "populationTotal": 1434,
            "populationPrivateHousing": 1303,
            "ageGroups": [
                {"label": "Menores de 1", "value": 28},
                {"label": "1 a 14", "value": 392},
                {"label": "15 a 29", "value": 246},
                {"label": "30 a 44", "value": 179},
                {"label": "45 a 64", "value": 275},
                {"label": "65 y más", "value": 183},
            ],
            "occupiedPrivateHomes": 442,
            "homesWithElectricity": 386,
            "homesWithoutElectricity": 56,
            "electricityCoveragePct": 87.3,
            "capitalPopulation": 724,
            "capitalHomes": 255,
        },
        "quality": {
            "seriesRows": len(series_rows),
            "activeClasses": len(classes),
            "yearCount": len(years),
            "duplicateKeys": 0,
            "negativeValues": 0,
            "totalAreaSpreadHa": total_spread,
            "maxReconciliationErrorHa": max_reconciliation_error,
            "maxSnapshotDifferenceHa": max_snapshot_difference,
            "status": "Apto para exploración descriptiva",
            "limitations": [
                "Las áreas provienen de una exportación de MapBiomas y no equivalen a catastro parcelario.",
                "MapBiomas representa la microcuenca; los indicadores INEI corresponden al distrito y al Censo 2017.",
                "El área clasificada excede en 0,72 % al polígono vectorial de la microcuenca por el tratamiento ráster de borde.",
                "La lectura conjunta usa ámbitos y tiempos distintos; es contextual y no demuestra causalidad.",
            ],
        },
        "sources": [
            {
                "name": "MapBiomas Perú — cobertura por clase",
                "detail": "CSV local suministrado: serie anual 1985–2025 recortada a la microcuenca de trabajo; unidad reportada: hectáreas.",
                "url": "https://peru.mapbiomas.org/",
            },
            {
                "name": "INEI — población censada y total, 2017",
                "detail": "Anexo 5, ubigeo 150715: 1 320 habitantes censados y 1 434 de población total.",
                "url": "https://www.inei.gob.pe/media/MenuRecursivo/publicaciones_digitales/Est/Lib1604/Libro03.pdf",
            },
            {
                "name": "INEI — población por grupos de edad, 2017",
                "detail": "Población censada en viviendas particulares: 1 303 personas.",
                "url": "https://www.inei.gob.pe/media/MenuRecursivo/publicaciones_digitales/Est/Lib1550/15BTOMO_01.pdf",
            },
            {
                "name": "INEI — viviendas y alumbrado eléctrico, 2017",
                "detail": "442 viviendas particulares con ocupantes presentes; 386 con alumbrado eléctrico.",
                "url": "https://www.inei.gob.pe/media/MenuRecursivo/publicaciones_digitales/Est/Lib1538/Libro.pdf",
            },
            {
                "name": "INEI — capa de centros poblados, 2017",
                "detail": "Centro poblado San Andrés de Tupicocha (código 1507150001): 724 habitantes y 255 viviendas; capa incluida en el proyecto.",
                "url": "https://www.inei.gob.pe/estadisticas/indice-tematico/poblacion-y-vivienda/",
            },
        ],
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    OUTPUT.write_text(f"window.SUELOTUPI_DASHBOARD={serialized};\n", encoding="utf-8")
    print(f"Wrote {OUTPUT}")
    print(json.dumps(payload["quality"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
