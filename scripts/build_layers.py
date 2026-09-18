#!/usr/bin/env python3
"""Convierte el KMZ validado de San Andrés en datos compactos para SueloTUPI.

Solo usa la biblioteca estándar. Conserva geometrías y atributos del KMZ;
no descarga datos ni inventa capas.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[2]
KMZ = ROOT / "ENTREGABLES" / "SanAndres_Tupicocha_Capas_Interactivo.kmz"
OUT = Path(__file__).resolve().parents[1] / "data" / "layers.js"
NS = {"k": "http://www.opengis.net/kml/2.2"}

GROUPS = {
    "01. Cobertura y uso del suelo - MapBiomas 2025": "Cobertura del suelo",
    "02. Límites y cuenca": "Límites y cuenca",
    "03. Hidrología": "Hidrología",
    "04. Centros poblados y servicios": "Población y servicios",
    "05. Catastro urbano": "Catastro urbano",
    "06. Vías": "Conectividad",
    "07. Peligros y emergencias": "Peligros",
}

INITIAL_VISIBLE = {
    "Cobertura 2025",
    "Microcuenca de trabajo",
    "Distrito San Andrés de Tupicocha",
    "Red hídrica",
    "Bocatoma",
    "Centros poblados del entorno inmediato",
    "Centro de salud",
    "Predios urbanos referenciales (COFOPRI)",
    "Red vial",
    "Inventario de movimientos en masa",
    "Poblado afectado reportado",
}

STYLE_BY_LAYER = {
    "Microcuenca de trabajo": {"color": "#125fc0", "fill": "#125fc0", "opacity": 0.05, "width": 4},
    "Distrito San Andrés de Tupicocha": {"color": "#ff7a00", "fill": "#ff7a00", "opacity": 0.035, "width": 3},
    "Provincia Huarochirí (contexto)": {"color": "#b966ff", "fill": "#b966ff", "opacity": 0.025, "width": 2},
    "Red hídrica": {"color": "#00a9e6", "width": 2.4},
    "Bocatoma": {"color": "#19b7a5", "point": "diamond", "radius": 7},
    "Centros poblados del entorno inmediato": {"color": "#ffd400", "point": "circle", "radius": 6},
    "Centros poblados - contexto ampliado": {"color": "#fff38a", "point": "circle", "radius": 4},
    "Centro de salud": {"color": "#ef476f", "point": "cross", "radius": 7},
    "Predios urbanos referenciales (COFOPRI)": {"color": "#f29b38", "fill": "#f29b38", "opacity": 0.025, "width": 1.1},
    "Red vial": {"color": "#fff4db", "halo": "#4b3c2e", "width": 3.1},
    "Inventario de movimientos en masa": {"color": "#ef2b2d", "point": "triangle", "radius": 7},
    "Poblado afectado reportado": {"color": "#ff7f11", "point": "square", "radius": 7},
    "Distritos expuestos a movimientos en masa": {"color": "#e6550d", "fill": "#e6550d", "opacity": 0.20, "width": 2},
    "Distritos con declaratoria de emergencia": {"color": "#8e44ad", "fill": "#8e44ad", "opacity": 0.20, "width": 2},
}

MAPBIOMAS = {
    3: ("Bosque", "#1f8d49"),
    9: ("Plantación forestal", "#7a6c00"),
    12: ("Formación herbácea", "#d6bc74"),
    21: ("Mosaico agropecuario", "#ffefc3"),
    24: ("Infraestructura urbana", "#d4271e"),
    33: ("Río, lago u océano", "#2532e4"),
    66: ("Matorral y otros arbustales", "#a89358"),
    68: ("Otra área natural sin vegetación", "#e97a7a"),
    82: ("Herbazal inundable altoandino", "#26abab"),
    92: ("Superficie rocosa", "#d98a45"),
}


def tag(name: str) -> str:
    return f"{{{NS['k']}}}{name}"


def parse_coords(text: str | None) -> list[list[float]]:
    if not text:
        return []
    result = []
    for item in text.split():
        parts = item.split(",")
        if len(parts) >= 2:
            result.append([round(float(parts[0]), 7), round(float(parts[1]), 7)])
    return result


def parse_geometry(node: ET.Element):
    local = node.tag.rsplit("}", 1)[-1]
    if local == "Point":
        coords = parse_coords(node.findtext("k:coordinates", namespaces=NS))
        return {"type": "Point", "coordinates": coords[0]} if coords else None
    if local == "LineString":
        return {"type": "LineString", "coordinates": parse_coords(node.findtext("k:coordinates", namespaces=NS))}
    if local == "Polygon":
        rings = []
        outer = node.find("k:outerBoundaryIs/k:LinearRing/k:coordinates", NS)
        if outer is not None:
            rings.append(parse_coords(outer.text))
        for inner in node.findall("k:innerBoundaryIs/k:LinearRing/k:coordinates", NS):
            rings.append(parse_coords(inner.text))
        return {"type": "Polygon", "coordinates": rings}
    if local == "MultiGeometry":
        geoms = []
        for child in list(node):
            parsed = parse_geometry(child)
            if parsed:
                geoms.append(parsed)
        return {"type": "GeometryCollection", "geometries": geoms}
    return None


def geometry_of(pm: ET.Element):
    for child in list(pm):
        if child.tag.rsplit("}", 1)[-1] in {"Point", "LineString", "Polygon", "MultiGeometry"}:
            return parse_geometry(child)
    return None


def properties_of(pm: ET.Element) -> dict[str, str]:
    props: dict[str, str] = {}
    name = pm.findtext("k:name", default="Sin nombre", namespaces=NS).strip()
    props["Nombre"] = name
    for item in pm.findall("k:ExtendedData/k:Data", NS):
        key = item.get("name", "Atributo").strip()
        value = item.findtext("k:value", default="", namespaces=NS).strip()
        if value:
            props[key] = value
    return props


def walk_coords(geometry):
    if not geometry:
        return
    kind = geometry["type"]
    if kind == "Point":
        yield geometry["coordinates"]
    elif kind == "LineString":
        yield from geometry["coordinates"]
    elif kind == "Polygon":
        for ring in geometry["coordinates"]:
            yield from ring
    elif kind == "GeometryCollection":
        for child in geometry["geometries"]:
            yield from walk_coords(child)


def bbox_for(features):
    coords = [xy for feature in features for xy in walk_coords(feature["geometry"])]
    if not coords:
        return None
    xs, ys = zip(*coords)
    return [min(xs), min(ys), max(xs), max(ys)]


def safe_id(text: str) -> str:
    table = str.maketrans("áéíóúñÁÉÍÓÚÑ()", "aeiounAEIOUN__")
    clean = "".join(c.lower() if c.isalnum() else "-" for c in text.translate(table))
    return "-".join(part for part in clean.split("-") if part)


def main() -> None:
    with ZipFile(KMZ) as archive:
        root = ET.fromstring(archive.read("doc.kml"))

    layers = []
    document = root.find("k:Document", NS)
    assert document is not None
    for group_folder in document.findall("k:Folder", NS):
        group_source = group_folder.findtext("k:name", default="", namespaces=NS)
        if group_source not in GROUPS:
            continue
        for layer_folder in group_folder.findall("k:Folder", NS):
            title = layer_folder.findtext("k:name", default="", namespaces=NS).strip()
            features = []
            for pm in layer_folder.findall("k:Placemark", NS):
                geometry = geometry_of(pm)
                if geometry:
                    features.append({"type": "Feature", "properties": properties_of(pm), "geometry": geometry})
            if not features:
                continue
            style = dict(STYLE_BY_LAYER.get(title, {"color": "#ffffff", "width": 2}))
            if title == "Cobertura 2025":
                style = {"thematic": "mapbiomas", "opacity": 0.48, "width": 0.9}
            layers.append({
                "id": safe_id(title),
                "title": title,
                "group": GROUPS[group_source],
                "visible": title in INITIAL_VISIBLE,
                "count": len(features),
                "bbox": bbox_for(features),
                "style": style,
                "features": features,
            })

    all_features = [feature for layer in layers for feature in layer["features"]]
    payload = {
        "project": {
            "name": "SueloTUPI",
            "subtitle": "Visor territorial de San Andrés de Tupicocha",
            "generated": "2026-09-18",
            "crs": "WGS 84",
            "bbox": bbox_for(all_features),
            "center": [-76.47298, -12.01599],
            "featureCount": len(all_features),
            "layerCount": len(layers),
        },
        "mapbiomas": [{"code": code, "name": name, "color": color} for code, (name, color) in MAPBIOMAS.items()],
        "layers": layers,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text("window.SUELOTUPI_DATA=" + encoded + ";\n", encoding="utf-8")
    print(f"{OUT}: {len(layers)} capas, {len(all_features)} entidades, {OUT.stat().st_size / 1024:.1f} KiB")


if __name__ == "__main__":
    main()
