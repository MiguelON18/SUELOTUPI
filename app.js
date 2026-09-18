(() => {
  "use strict";

  const data = window.SUELOTUPI_DATA;
  if (!data) throw new Error("No se encontró data/layers.js");

  const map = document.getElementById("map");
  const canvas = document.getElementById("mapCanvas");
  const ctx = canvas.getContext("2d");
  const tilePane = document.getElementById("tilePane");
  const workspace = document.querySelector(".workspace");
  const isFileMode = window.location.protocol === "file:";
  const state = {
    center: [...data.project.center],
    zoom: 11,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    selected: null,
    hitIndex: [],
    dragging: false,
    moved: false,
    start: null,
    startCenter: null,
    basemap: !isFileMode,
    labels: true,
  };

  const mapbiomasByCode = Object.fromEntries(data.mapbiomas.map(item => [String(item.code), item]));
  const mapbiomasByName = Object.fromEntries(data.mapbiomas.map(item => [item.name, item]));
  const essential = new Set([
    "Cobertura 2025", "Microcuenca de trabajo", "Distrito San Andrés de Tupicocha",
    "Red hídrica", "Bocatoma", "Centros poblados del entorno inmediato",
    "Centro de salud", "Predios urbanos referenciales (COFOPRI)", "Red vial",
    "Inventario de movimientos en masa", "Poblado afectado reportado"
  ]);

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function mercator(lon, lat, zoom = state.zoom) {
    const scale = 256 * 2 ** zoom;
    const x = (lon + 180) / 360 * scale;
    const clipped = clamp(lat, -85.05112878, 85.05112878);
    const s = Math.sin(clipped * Math.PI / 180);
    const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
    return [x, y];
  }
  function inverseMercator(x, y, zoom = state.zoom) {
    const scale = 256 * 2 ** zoom;
    const lon = x / scale * 360 - 180;
    const n = Math.PI - 2 * Math.PI * y / scale;
    const lat = 180 / Math.PI * Math.atan(Math.sinh(n));
    return [lon, lat];
  }
  function screenPoint(coord) {
    const center = mercator(state.center[0], state.center[1]);
    const point = mercator(coord[0], coord[1]);
    return [point[0] - center[0] + map.clientWidth / 2, point[1] - center[1] + map.clientHeight / 2];
  }
  function geoPoint(x, y) {
    const center = mercator(state.center[0], state.center[1]);
    return inverseMercator(center[0] + x - map.clientWidth / 2, center[1] + y - map.clientHeight / 2);
  }

  function styleFor(layer, feature) {
    if (layer.style.thematic === "mapbiomas") {
      const props = feature.properties;
      const item = mapbiomasByCode[String(props["ID MapBiomas"])] || mapbiomasByName[props["Clase MapBiomas"]] || {color: "#9ca89f"};
      return {color: item.color, fill: item.color, opacity: layer.style.opacity, width: layer.style.width};
    }
    return layer.style;
  }

  function resizeCanvas() {
    const rect = map.getBoundingClientRect();
    canvas.width = Math.round(rect.width * state.dpr);
    canvas.height = Math.round(rect.height * state.dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    render();
  }

  function drawPoint(coord, style, feature, layer) {
    const [x, y] = screenPoint(coord);
    const r = style.radius || 5;
    if (x < -20 || y < -20 || x > map.clientWidth + 20 || y > map.clientHeight + 20) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = style.color || "#fff";
    ctx.strokeStyle = "rgba(20,35,27,.88)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (style.point === "triangle") {
      ctx.moveTo(0, -r); ctx.lineTo(r * .9, r); ctx.lineTo(-r * .9, r); ctx.closePath();
    } else if (style.point === "square") {
      ctx.rect(-r * .75, -r * .75, r * 1.5, r * 1.5);
    } else if (style.point === "diamond") {
      ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath();
    } else if (style.point === "cross") {
      ctx.rect(-r * .28, -r, r * .56, r * 2); ctx.rect(-r, -r * .28, r * 2, r * .56);
    } else {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    ctx.fill(); ctx.stroke(); ctx.restore();
    state.hitIndex.push({kind: "point", x, y, r: r + 5, feature, layer});
    if (state.labels && state.zoom >= 12 && feature.properties.Nombre) {
      ctx.font = "600 10px system-ui, sans-serif";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,.9)";
      ctx.strokeText(feature.properties.Nombre, x + r + 4, y + 3);
      ctx.fillStyle = "#183026";
      ctx.fillText(feature.properties.Nombre, x + r + 4, y + 3);
    }
  }

  function drawLine(coords, style, feature, layer) {
    if (!coords.length) return;
    const points = coords.map(screenPoint);
    ctx.save();
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    if (style.halo) {
      ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p));
      ctx.strokeStyle = style.halo; ctx.lineWidth = (style.width || 2) + 2.5; ctx.stroke();
    }
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p));
    ctx.strokeStyle = style.color || "#fff"; ctx.lineWidth = style.width || 2; ctx.globalAlpha = .95; ctx.stroke();
    ctx.restore();
    state.hitIndex.push({kind: "line", points, tolerance: Math.max(6, (style.width || 2) + 4), feature, layer});
  }

  function drawPolygon(rings, style, feature, layer) {
    if (!rings.length) return;
    const screenRings = rings.map(ring => ring.map(screenPoint));
    ctx.save();
    ctx.beginPath();
    for (const points of screenRings) {
      points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p));
      ctx.closePath();
    }
    ctx.fillStyle = style.fill || style.color || "#999";
    ctx.globalAlpha = style.opacity ?? .18;
    ctx.fill("evenodd");
    ctx.globalAlpha = .94;
    ctx.strokeStyle = style.color || "#777";
    ctx.lineWidth = style.width || 1;
    ctx.stroke();
    ctx.restore();
    state.hitIndex.push({kind: "polygon", rings: screenRings, feature, layer});
  }

  function drawGeometry(geometry, style, feature, layer) {
    if (!geometry) return;
    if (geometry.type === "Point") drawPoint(geometry.coordinates, style, feature, layer);
    else if (geometry.type === "LineString") drawLine(geometry.coordinates, style, feature, layer);
    else if (geometry.type === "Polygon") drawPolygon(geometry.coordinates, style, feature, layer);
    else if (geometry.type === "GeometryCollection") geometry.geometries.forEach(g => drawGeometry(g, style, feature, layer));
  }

  function drawSelection() {
    if (!state.selected) return;
    const {feature, layer} = state.selected;
    const style = styleFor(layer, feature);
    ctx.save();
    ctx.shadowColor = "rgba(184,213,75,.85)";
    ctx.shadowBlur = 13;
    const selectedStyle = {...style, color: "#dff46b", fill: "#dff46b", opacity: .30, width: (style.width || 2) + 2, radius: (style.radius || 5) + 2};
    drawGeometry(feature.geometry, selectedStyle, feature, layer);
    ctx.restore();
  }

  function render() {
    if (!canvas.width) return;
    ctx.clearRect(0, 0, map.clientWidth, map.clientHeight);
    state.hitIndex = [];
    for (const layer of data.layers) {
      if (!layer.visible) continue;
      for (const feature of layer.features) drawGeometry(feature.geometry, styleFor(layer, feature), feature, layer);
    }
    drawSelection();
    updateTiles();
    updateScaleBar();
  }

  function updateTiles() {
    tilePane.style.opacity = state.basemap ? "1" : "0";
    if (!state.basemap) return;
    const zoom = state.zoom;
    const n = 2 ** zoom;
    const [cx, cy] = mercator(state.center[0], state.center[1], zoom);
    const left = cx - map.clientWidth / 2;
    const top = cy - map.clientHeight / 2;
    const minX = Math.floor(left / 256), maxX = Math.floor((left + map.clientWidth) / 256);
    const minY = Math.max(0, Math.floor(top / 256)), maxY = Math.min(n - 1, Math.floor((top + map.clientHeight) / 256));
    const wanted = new Set();
    for (let tx = minX; tx <= maxX; tx++) for (let ty = minY; ty <= maxY; ty++) {
      const wrappedX = ((tx % n) + n) % n;
      const key = `${zoom}/${wrappedX}/${ty}`;
      wanted.add(key);
      let img = tilePane.querySelector(`[data-key="${key}"]`);
      if (!img) {
        img = new Image();
        img.dataset.key = key;
        img.alt = "";
        img.src = `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`;
        img.onerror = () => { img.style.display = "none"; };
        tilePane.appendChild(img);
      }
      img.style.left = `${tx * 256 - left}px`;
      img.style.top = `${ty * 256 - top}px`;
    }
    [...tilePane.children].forEach(img => { if (!wanted.has(img.dataset.key)) img.remove(); });
  }

  function updateScaleBar() {
    const metersPerPixel = Math.cos(state.center[1] * Math.PI / 180) * 40075016.686 / (256 * 2 ** state.zoom);
    const targetMeters = metersPerPixel * 100;
    const power = 10 ** Math.floor(Math.log10(targetMeters));
    const ratio = targetMeters / power;
    const nice = (ratio >= 5 ? 5 : ratio >= 2 ? 2 : 1) * power;
    const px = nice / metersPerPixel;
    const label = nice >= 1000 ? `${nice / 1000} km` : `${Math.round(nice)} m`;
    const bar = document.getElementById("scaleBar");
    bar.style.width = `${px}px`;
    bar.textContent = label;
  }

  function pointInRing(point, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (((yi > point[1]) !== (yj > point[1])) && point[0] < (xj - xi) * (point[1] - yi) / ((yj - yi) || 1e-9) + xi) inside = !inside;
    }
    return inside;
  }
  function distanceToSegment(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }
  function hitTest(x, y) {
    for (let i = state.hitIndex.length - 1; i >= 0; i--) {
      const item = state.hitIndex[i];
      if (item.kind === "point" && Math.hypot(x - item.x, y - item.y) <= item.r) return item;
      if (item.kind === "line") {
        for (let j = 1; j < item.points.length; j++) if (distanceToSegment([x,y], item.points[j-1], item.points[j]) <= item.tolerance) return item;
      }
      if (item.kind === "polygon" && item.rings.length && pointInRing([x,y], item.rings[0]) && !item.rings.slice(1).some(r => pointInRing([x,y], r))) return item;
    }
    return null;
  }

  function geometryCoords(geometry, output = []) {
    if (!geometry) return output;
    if (geometry.type === "Point") output.push(geometry.coordinates);
    else if (geometry.type === "LineString") output.push(...geometry.coordinates);
    else if (geometry.type === "Polygon") geometry.coordinates.forEach(ring => output.push(...ring));
    else if (geometry.type === "GeometryCollection") geometry.geometries.forEach(g => geometryCoords(g, output));
    return output;
  }
  function boundsOfFeature(feature) {
    const coords = geometryCoords(feature.geometry);
    const xs = coords.map(c => c[0]), ys = coords.map(c => c[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  function fitBounds(bounds, maxZoom = 16) {
    if (!bounds) return;
    const [west, south, east, north] = bounds;
    state.center = [(west + east) / 2, (south + north) / 2];
    for (let z = maxZoom; z >= 3; z--) {
      const a = mercator(west, north, z), b = mercator(east, south, z);
      if (Math.abs(b[0] - a[0]) <= map.clientWidth * .75 && Math.abs(b[1] - a[1]) <= map.clientHeight * .72) { state.zoom = z; break; }
    }
    render();
  }

  function selectFeature(feature, layer, focus = false) {
    state.selected = {feature, layer};
    const style = styleFor(layer, feature);
    document.getElementById("welcomePanel").hidden = true;
    document.getElementById("featurePanel").hidden = false;
    document.getElementById("featureLayer").textContent = layer.title;
    document.getElementById("featureTitle").textContent = feature.properties.Nombre || "Entidad seleccionada";
    document.getElementById("featureSwatch").style.background = style.color || style.fill || "#1f6b4f";
    const table = document.getElementById("featureTable");
    table.replaceChildren();
    Object.entries(feature.properties).filter(([key, value]) => key !== "Nombre" && String(value).trim()).forEach(([key, value]) => {
      const row = document.createElement("div"); row.className = "attribute-row";
      const label = document.createElement("span"); label.textContent = key;
      const val = document.createElement("span");
      if (/^https?:\/\//i.test(value)) {
        const link = document.createElement("a"); link.href = value; link.target = "_blank"; link.rel = "noopener"; link.textContent = "Abrir fuente ↗"; val.appendChild(link);
      } else val.textContent = value;
      row.append(label, val); table.appendChild(row);
    });
    if (window.innerWidth <= 980) workspace.classList.add("right-mobile-open");
    if (focus) fitBounds(boundsOfFeature(feature), 16); else render();
  }

  function createLayerPanel() {
    const container = document.getElementById("layerList");
    const groups = [...new Set(data.layers.map(layer => layer.group))];
    for (const groupName of groups) {
      const group = document.createElement("section"); group.className = "layer-group";
      const title = document.createElement("div"); title.className = "group-title"; title.textContent = groupName;
      group.appendChild(title);
      for (const layer of data.layers.filter(item => item.group === groupName)) {
        const row = document.createElement("div"); row.className = "layer-row";
        const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = `layer-toggle${layer.visible ? " on" : ""}`; toggle.setAttribute("aria-label", `Mostrar ${layer.title}`);
        const name = document.createElement("div"); name.className = "layer-name"; name.append(document.createTextNode(layer.title));
        const count = document.createElement("span"); count.textContent = `${layer.count} ${layer.count === 1 ? "entidad" : "entidades"}`; name.appendChild(count);
        const focus = document.createElement("button"); focus.type = "button"; focus.className = "layer-focus"; focus.textContent = "⌖"; focus.title = "Acercar a la capa";
        toggle.addEventListener("click", event => { event.stopPropagation(); layer.visible = !layer.visible; toggle.classList.toggle("on", layer.visible); updateLegend(); render(); });
        row.addEventListener("click", () => { layer.visible = !layer.visible; toggle.classList.toggle("on", layer.visible); updateLegend(); render(); });
        focus.addEventListener("click", event => { event.stopPropagation(); if (!layer.visible) { layer.visible = true; toggle.classList.add("on"); updateLegend(); } fitBounds(layer.bbox); });
        row.append(toggle, name, focus); group.appendChild(row);
      }
      container.appendChild(group);
    }
  }

  function updateLayerToggles() {
    document.querySelectorAll(".layer-toggle").forEach((button, index) => button.classList.toggle("on", data.layers[index].visible));
  }

  function updateLegend() {
    const list = document.getElementById("legendList"); list.replaceChildren();
    for (const layer of data.layers.filter(item => item.visible)) {
      if (layer.style.thematic === "mapbiomas") {
        for (const item of data.mapbiomas) addLegendEntry(item.name, {color: item.color, fill: item.color, opacity: .48}, "polygon");
      } else {
        const kind = layer.style.point ? "point" : layer.style.fill ? "polygon" : "line";
        addLegendEntry(layer.title, layer.style, kind);
      }
    }
    if (!list.children.length) list.textContent = "No hay capas activas.";
  }
  function addLegendEntry(label, style, kind) {
    const row = document.createElement("div"); row.className = "legend-entry";
    const symbol = document.createElement("span"); symbol.className = `legend-symbol ${kind}`;
    symbol.style.borderColor = style.color || "#777";
    symbol.style.background = kind === "line" ? "transparent" : (style.fill || style.color || "#777");
    if (kind === "polygon") symbol.style.opacity = Math.max(.45, style.opacity || .4);
    const text = document.createElement("span"); text.textContent = label;
    row.append(symbol, text); document.getElementById("legendList").appendChild(row);
  }

  function setupSearch() {
    const input = document.getElementById("searchInput"), results = document.getElementById("searchResults");
    input.addEventListener("input", () => {
      const query = input.value.trim().toLocaleLowerCase("es"); results.replaceChildren();
      if (query.length < 2) { results.hidden = true; return; }
      const matches = [];
      for (const layer of data.layers) {
        if (layer.title.toLocaleLowerCase("es").includes(query)) matches.push({layer});
        for (const feature of layer.features) {
          const haystack = Object.values(feature.properties).join(" ").toLocaleLowerCase("es");
          if (haystack.includes(query)) matches.push({layer, feature});
          if (matches.length >= 12) break;
        }
        if (matches.length >= 12) break;
      }
      for (const match of matches) {
        const button = document.createElement("button"); button.type = "button"; button.className = "search-result";
        const strong = document.createElement("strong"); strong.textContent = match.feature?.properties.Nombre || match.layer.title;
        const span = document.createElement("span"); span.textContent = match.feature ? match.layer.title : `${match.layer.count} entidades`;
        button.append(strong, span);
        button.addEventListener("click", () => {
          match.layer.visible = true; updateLayerToggles(); updateLegend();
          if (match.feature) selectFeature(match.feature, match.layer, true); else fitBounds(match.layer.bbox);
          input.value = ""; results.hidden = true;
        });
        results.appendChild(button);
      }
      results.hidden = !matches.length;
    });
    document.addEventListener("click", event => { if (!event.target.closest(".search-box") && !event.target.closest(".search-results")) results.hidden = true; });
  }

  function changeZoom(delta, anchorX = map.clientWidth / 2, anchorY = map.clientHeight / 2) {
    const before = geoPoint(anchorX, anchorY);
    const next = clamp(state.zoom + delta, 4, 18);
    if (next === state.zoom) return;
    state.zoom = next;
    const afterWorld = mercator(before[0], before[1]);
    const centerWorld = [afterWorld[0] - anchorX + map.clientWidth / 2, afterWorld[1] - anchorY + map.clientHeight / 2];
    state.center = inverseMercator(centerWorld[0], centerWorld[1]);
    render();
  }

  function setupMapEvents() {
    map.addEventListener("pointerdown", event => {
      if (event.target.closest("button, label, input, a")) return;
      state.dragging = true; state.moved = false; state.start = [event.clientX, event.clientY]; state.startCenter = mercator(...state.center); map.setPointerCapture(event.pointerId); map.classList.add("dragging");
    });
    map.addEventListener("pointermove", event => {
      const rect = map.getBoundingClientRect();
      const point = geoPoint(event.clientX - rect.left, event.clientY - rect.top);
      document.getElementById("coordinateReadout").textContent = `${point[1].toFixed(5)}, ${point[0].toFixed(5)}`;
      if (!state.dragging) return;
      const dx = event.clientX - state.start[0], dy = event.clientY - state.start[1];
      if (Math.abs(dx) + Math.abs(dy) > 3) state.moved = true;
      state.center = inverseMercator(state.startCenter[0] - dx, state.startCenter[1] - dy); render();
    });
    map.addEventListener("pointerup", event => {
      if (!state.dragging) return;
      state.dragging = false; map.classList.remove("dragging");
      if (!state.moved) {
        const rect = map.getBoundingClientRect();
        const hit = hitTest(event.clientX - rect.left, event.clientY - rect.top);
        if (hit) selectFeature(hit.feature, hit.layer);
      }
    });
    map.addEventListener("wheel", event => { event.preventDefault(); const rect = map.getBoundingClientRect(); changeZoom(event.deltaY < 0 ? 1 : -1, event.clientX - rect.left, event.clientY - rect.top); }, {passive: false});
  }

  function setupControls() {
    document.getElementById("zoomInBtn").onclick = () => changeZoom(1);
    document.getElementById("zoomOutBtn").onclick = () => changeZoom(-1);
    document.getElementById("homeBtn").onclick = () => { state.center = [...data.project.center]; state.zoom = 11; render(); };
    document.getElementById("zoomFeatureBtn").onclick = () => state.selected && fitBounds(boundsOfFeature(state.selected.feature), 16);
    const basemapToggle = document.getElementById("basemapToggle");
    basemapToggle.checked = state.basemap;
    basemapToggle.disabled = isFileMode;
    basemapToggle.closest("label").title = isFileMode ? "Disponible mediante servidor local o GitHub Pages" : "Activar o desactivar el mapa base";
    document.getElementById("offlineBasemapNote").hidden = !isFileMode;
    basemapToggle.onchange = event => { state.basemap = event.target.checked; render(); };
    document.getElementById("labelsToggle").onchange = event => { state.labels = event.target.checked; render(); };
    document.getElementById("essentialBtn").onclick = () => { data.layers.forEach(layer => layer.visible = essential.has(layer.title)); updateLayerToggles(); updateLegend(); render(); };
    document.getElementById("allOffBtn").onclick = () => { data.layers.forEach(layer => layer.visible = false); updateLayerToggles(); updateLegend(); render(); };
    document.getElementById("collapseLeft").onclick = () => { workspace.classList.add("left-collapsed"); workspace.classList.remove("left-mobile-open"); document.getElementById("openLeft").hidden = false; setTimeout(resizeCanvas, 260); };
    document.getElementById("collapseRight").onclick = () => { workspace.classList.add("right-collapsed"); workspace.classList.remove("right-mobile-open"); document.getElementById("openRight").hidden = false; setTimeout(resizeCanvas, 260); };
    document.getElementById("openLeft").onclick = () => { workspace.classList.remove("left-collapsed"); workspace.classList.add("left-mobile-open"); document.getElementById("openLeft").hidden = true; setTimeout(resizeCanvas, 260); };
    document.getElementById("openRight").onclick = () => { workspace.classList.remove("right-collapsed"); workspace.classList.add("right-mobile-open"); document.getElementById("openRight").hidden = true; setTimeout(resizeCanvas, 260); };
    document.getElementById("presentationBtn").onclick = () => { document.body.classList.toggle("presentation"); setTimeout(resizeCanvas, 100); };
  }

  function init() {
    document.getElementById("layerMetric").textContent = data.project.layerCount;
    document.getElementById("featureMetric").textContent = data.project.featureCount;
    document.getElementById("datasetSummary").textContent = `${data.project.layerCount} capas · ${data.project.featureCount} entidades · ${data.project.crs}`;
    createLayerPanel(); updateLegend(); setupSearch(); setupMapEvents(); setupControls();
    new ResizeObserver(resizeCanvas).observe(map);
    resizeCanvas();
  }

  init();
})();
