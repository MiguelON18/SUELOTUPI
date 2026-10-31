(() => {
  "use strict";

  const data = window.SUELOTUPI_DATA;
  if (!data) throw new Error("No se encontró data/layers.js");
  const mapUi = window.SUELOTUPI_MAP_UI;
  const basemaps = window.SUELOTUPI_BASEMAPS;

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
    basemapSource: "esri",
  };

  const mapbiomasByCode = Object.fromEntries(data.mapbiomas.map(item => [String(item.code), item]));
  const mapbiomasByName = Object.fromEntries(data.mapbiomas.map(item => [item.name, item]));
  const essential = new Set(data.project.essentialIds || [
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
    if (layer.style.thematic === "slope") return {...layer.style,color:feature.properties.color,fill:feature.properties.color};
    if (layer.style.thematic === "contour") return {...layer.style,color:feature.properties.indice ? "#92704c" : "#bba88d",width:feature.properties.indice ? 1.3 : .65,halo:feature.properties.indice ? "#f7f3e9" : null};
    if (layer.style.thematic === "transition") {
      const changed = Number(feature.properties.cambio) === 1;
      return {color: changed ? "#b45b28" : "#8c9c86", fill: changed ? "#cc8649" : "#d4ddcc", opacity: changed ? .7 : .25, width: .4};
    }
    if (layer.style.thematic === "contrast") {
      const item = mapbiomasByCode[String(feature.properties.c4_code)];
      return {...layer.style, color:item?.color || "#a89358", fill:item?.color || "#a89358"};
    }
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
    state.hitIndex.push({kind: "polygon", rings: screenRings, feature, layer, borderOnly: style.boundaryOnly, tolerance:Math.max(6, style.width || 1)});
  }

  function drawGeometry(geometry, style, feature, layer) {
    if (!geometry) return;
    if (geometry.type === "Point") drawPoint(geometry.coordinates, style, feature, layer);
    else if (geometry.type === "LineString") drawLine(geometry.coordinates, style, feature, layer);
    else if (geometry.type === "Polygon") drawPolygon(geometry.coordinates, style, feature, layer);
    else if (geometry.type === "MultiPoint") geometry.coordinates.forEach(point => drawPoint(point, style, feature, layer));
    else if (geometry.type === "MultiLineString") geometry.coordinates.forEach(line => drawLine(line, style, feature, layer));
    else if (geometry.type === "MultiPolygon") geometry.coordinates.forEach(polygon => drawPolygon(polygon, style, feature, layer));
    else if (geometry.type === "GeometryCollection") geometry.geometries.forEach(g => drawGeometry(g, style, feature, layer));
  }

  function drawSelection() {
    if (!state.selected || !mapUi.featureVisible(state.selected.layer,state.selected.feature,state.zoom)) return;
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
      for (const feature of layer.features) {
        if (!mapUi.featureVisible(layer,feature,state.zoom)) continue;
        drawGeometry(feature.geometry, styleFor(layer, feature), feature, layer);
      }
    }
    const labelBoxes=[];
    for (const layer of data.layers.filter(l=>l.visible&&l.style.thematic==='contour')) {
      for (const feature of layer.features.filter(f=>f.properties.indice)) drawContourLabel(feature,labelBoxes);
    }
    drawSelection();
    updateTiles();
    updateScaleBar();
  }

  function drawContourLabel(feature,boxes) {
    const geometry=feature.geometry;
    const lines=geometry.type==='MultiLineString'?geometry.coordinates:geometry.type==='LineString'?[geometry.coordinates]:[];
    const candidates=lines.map(line=>{
      const pts=line.map(screenPoint);let length=0;for(let i=1;i<pts.length;i++)length+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
      return {pts,length};
    }).sort((a,b)=>b.length-a.length);
    const chosen=candidates[0];if(!chosen||chosen.length<90)return;
    let travelled=0,point=null;
    for(let i=1;i<chosen.pts.length;i++){
      const a=chosen.pts[i-1],b=chosen.pts[i],segment=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(travelled+segment>=chosen.length/2){const t=(chosen.length/2-travelled)/(segment||1);point=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];break;}travelled+=segment;
    }
    if(!point)return;const [x,y]=point;
    if(x<30||y<30||x>map.clientWidth-30||y>map.clientHeight-30||boxes.some(b=>Math.abs(b[0]-x)<55&&Math.abs(b[1]-y)<20))return;
    boxes.push(point);ctx.save();ctx.font='11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineWidth=3;ctx.strokeStyle='#fffdf7';ctx.strokeText(`${feature.properties.cota_m} m`,x,y);ctx.fillStyle='#62482e';ctx.fillText(`${feature.properties.cota_m} m`,x,y);ctx.restore();
  }

  function updateTiles() {
    tilePane.style.opacity = state.basemap ? "1" : "0";
    const provider=basemaps.providers[state.basemapSource];
    const attribution=document.getElementById('basemapAttribution');
    attribution.innerHTML=state.basemap ? provider.attribution+' · <a href="'+provider.credits+'" target="_blank" rel="noopener">Créditos</a> · Fuentes temáticas en cada ficha' : 'Fuentes temáticas en cada ficha';
    if (!state.basemap) return;
    const zoom = Math.min(state.zoom,provider.maxNativeZoom);
    const factor=2**(state.zoom-zoom),tileSize=256*factor;
    const n = 2 ** zoom;
    const [cx, cy] = mercator(state.center[0], state.center[1], zoom);
    const left = cx*factor - map.clientWidth / 2;
    const top = cy*factor - map.clientHeight / 2;
    const minX = Math.floor(left / tileSize), maxX = Math.floor((left + map.clientWidth) / tileSize);
    const minY = Math.max(0, Math.floor(top / tileSize)), maxY = Math.min(n - 1, Math.floor((top + map.clientHeight) / tileSize));
    const wanted = new Set();
    for (let tx = minX; tx <= maxX; tx++) for (let ty = minY; ty <= maxY; ty++) {
      const wrappedX = ((tx % n) + n) % n;
      const key = `${state.basemapSource}/${zoom}/${wrappedX}/${ty}`;
      wanted.add(key);
      let img = tilePane.querySelector(`[data-key="${key}"]`);
      if (!img) {
        img = new Image();
        img.dataset.key = key;
        img.alt = "";
        img.src = basemaps.tileUrl(state.basemapSource,zoom,wrappedX,ty);
        const requestedSource=state.basemapSource;
        img.onerror = () => { img.style.display = "none";if(state.basemap&&state.basemapSource===requestedSource){const status=document.getElementById('basemapStatus');status.hidden=false;status.textContent='No se pudo cargar parte del fondo. Prueba el otro mapa base.';} };
        tilePane.appendChild(img);
      }
      img.style.width=`${tileSize}px`;img.style.height=`${tileSize}px`;
      img.style.left = `${tx * tileSize - left}px`;
      img.style.top = `${ty * tileSize - top}px`;
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
      if (item.kind === "polygon" && item.borderOnly) {
        if (item.rings.some(ring => ring.some((point, j) => j > 0 && distanceToSegment([x,y], ring[j-1], point) <= item.tolerance))) return item;
      } else if (item.kind === "polygon" && item.rings.length && pointInRing([x,y], item.rings[0]) && !item.rings.slice(1).some(r => pointInRing([x,y], r))) return item;
    }
    return null;
  }

  function geometryCoords(geometry, output = []) {
    if (!geometry) return output;
    if (geometry.type === "Point") output.push(geometry.coordinates);
    else if (geometry.type === "LineString") output.push(...geometry.coordinates);
    else if (geometry.type === "Polygon") geometry.coordinates.forEach(ring => output.push(...ring));
    else if (geometry.type === "MultiPoint") output.push(...geometry.coordinates);
    else if (geometry.type === "MultiLineString") geometry.coordinates.forEach(line => output.push(...line));
    else if (geometry.type === "MultiPolygon") geometry.coordinates.forEach(polygon => polygon.forEach(ring => output.push(...ring)));
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
    if (layer.style.thematic==='mapbiomas') {
      layer.classVisibility ||= {};layer.classVisibility[String(feature.properties['ID MapBiomas'])]=true;
      updateLayerToggles();updateLegend();
    }
    state.selected = {feature, layer};
    const style = styleFor(layer, feature);
    document.getElementById("welcomePanel").hidden = true;
    document.getElementById("featurePanel").hidden = false;
    document.getElementById("featureLayer").textContent = layer.title;
    document.getElementById("featureTitle").textContent = feature.properties.Nombre || "Entidad seleccionada";
    document.getElementById("featureRevision").textContent = feature.properties["Estado de revisión"] || layer.metadata?.estado_revision_actual || "Consultar fuente y condiciones de revisión de esta capa.";
    document.getElementById("featureSwatch").style.background = style.color || style.fill || "#1f6b4f";
    const table = document.getElementById("featureTable");
    table.replaceChildren();
    mapUi.featureRows(layer,feature).forEach(([key, value]) => {
      const row = document.createElement("div"); row.className = "attribute-row";
      const label = document.createElement("span"); label.textContent = key;
      const val = document.createElement("span");
      if (/^https?:\/\//i.test(value) || /^downloads\//.test(value)) {
        const link = document.createElement("a"); link.href = value; link.target = "_blank"; link.rel = "noopener"; link.textContent = "Abrir fuente ↗"; val.appendChild(link);
      } else val.textContent = typeof value === "number" && /(_m|_ha)$/.test(key) ? new Intl.NumberFormat("es-PE", {maximumFractionDigits:2}).format(value) : value;
      row.append(label, val); table.appendChild(row);
    });
    const download=document.getElementById('featureDownload');
    download.hidden=!layer.metadata?.download;if(layer.metadata?.download)download.href=layer.metadata.download;
    document.querySelector('.inspector').scrollTop=0;
    if (window.innerWidth <= 980) workspace.classList.add("right-mobile-open");
    if (focus) fitBounds(boundsOfFeature(feature), 16); else render();
  }

  function createLayerPanel() {
    const container = document.getElementById("layerList");
    const order = ["Ámbitos vigentes", "Cobertura C4", "Relieve", "Pueblo y servicios", "Agua y accesos", "Agua interpretada", "Antecedentes y comprobación", "Contraste de uso y suelo", "Control hidrológico"];
    const groups = [...new Set(data.layers.map(layer => layer.group))].sort((a,b) => order.indexOf(a) - order.indexOf(b));
    for (const groupName of groups) {
      const group = document.createElement("section"); group.className = "layer-group";
      const title = document.createElement("div"); title.className = "group-title"; title.textContent = groupName;
      group.appendChild(title);
      for (const layer of data.layers.filter(item => item.group === groupName)) {
        const row = document.createElement("div"); row.className = "layer-row";
        const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = `layer-toggle${layer.visible ? " on" : ""}`; toggle.setAttribute("aria-label", `Mostrar ${layer.title}`);
        toggle.dataset.layerId = layer.id;
        toggle.setAttribute("aria-pressed", String(layer.visible));
        const name = document.createElement("div"); name.className = "layer-name"; name.append(document.createTextNode(layer.title));
        const count = document.createElement("span"); count.textContent = `${layer.count} ${layer.style.thematic === "mapbiomas" ? "clases" : layer.style.thematic === "slope" ? "rangos" : layer.style.thematic === "contour" ? "tramos" : layer.count === 1 ? "entidad" : "entidades"}`; name.appendChild(count);
        const focus = document.createElement("button"); focus.type = "button"; focus.className = "layer-focus"; focus.textContent = "⌖"; focus.title = "Acercar a la capa";
        toggle.addEventListener("click", event => { event.stopPropagation(); setLayerVisible(layer, !layer.visible); });
        row.addEventListener("click", () => setLayerVisible(layer, !layer.visible));
        focus.addEventListener("click", event => { event.stopPropagation(); setLayerVisible(layer, true); fitBounds(layer.bbox); });
        row.append(toggle, name, focus); group.appendChild(row);
        if(layer.style.thematic==='mapbiomas'){
          const details=document.createElement('details');details.className='mapbiomas-classes';
          const summary=document.createElement('summary');summary.append(document.createTextNode('Clases de cobertura '));
          const count=document.createElement('span');count.dataset.classCountLayer=layer.id;summary.appendChild(count);details.appendChild(summary);
          for(const feature of layer.features){
            const code=String(feature.properties['ID MapBiomas']),item=mapbiomasByCode[code];
            const classRow=document.createElement('div');classRow.className='class-row';
            const button=document.createElement('button');button.type='button';button.className='layer-toggle mapbiomas-class-toggle';button.dataset.layerId=layer.id;button.dataset.classCode=code;
            button.setAttribute('aria-label',`Mostrar ${item.name} · MapBiomas`);
            button.addEventListener('click',()=>setClassVisible(layer,code,!(layer.visible&&layer.classVisibility?.[code]!==false)));
            const label=document.createElement('span');label.textContent=item.name;
            const swatch=document.createElement('i');swatch.className='class-swatch';swatch.style.background=item.color;swatch.setAttribute('aria-hidden','true');
            classRow.append(button,swatch,label);details.appendChild(classRow);
          }
          group.appendChild(details);
        }
      }
      container.appendChild(group);
    }
  }

  function updateLayerToggles() {
    const lookup = new Map(data.layers.map(layer => [layer.id, layer]));
    document.querySelectorAll(".layer-toggle:not(.mapbiomas-class-toggle)").forEach(button => {
      const visible = Boolean(lookup.get(button.dataset.layerId)?.visible);
      button.classList.toggle("on", visible);
      button.setAttribute("aria-pressed", String(visible));
    });
    document.querySelectorAll('.mapbiomas-class-toggle').forEach(button=>{
      const layer=lookup.get(button.dataset.layerId),visible=Boolean(layer?.visible&&layer.classVisibility?.[button.dataset.classCode]!==false);
      button.classList.toggle('on',visible);button.setAttribute('aria-pressed',String(visible));
    });
    document.querySelectorAll('[data-class-count-layer]').forEach(el=>{
      const layer=lookup.get(el.dataset.classCountLayer),n=layer.features.filter(f=>mapUi.featureVisible(layer,f,state.zoom)).length;
      el.textContent=`${n}/${layer.features.length} visibles`;
    });
  }

  function setClassVisible(layer,code,visible){
    if(visible&&!layer.visible)layer.classVisibility=Object.fromEntries(layer.features.map(f=>[String(f.properties['ID MapBiomas']),false]));
    layer.classVisibility ||= {};layer.classVisibility[code]=visible;
    setLayerVisible(layer,layer.features.some(f=>layer.classVisibility[String(f.properties['ID MapBiomas'])]!==false));
  }

  function setLayerVisible(layer, visible) {
    if(visible&&layer.style?.thematic==='mapbiomas'&&layer.features.every(f=>layer.classVisibility?.[String(f.properties['ID MapBiomas'])]===false))layer.classVisibility={};
    if (visible && layer.exclusiveGroup) data.layers.forEach(other => {
      if (other !== layer && other.exclusiveGroup === layer.exclusiveGroup) other.visible = false;
    });
    layer.visible = visible;
    updateLayerToggles(); updateLegend(); render();
  }

  function updateLegend() {
    const list = document.getElementById("legendList"); list.replaceChildren();
    for (const layer of data.layers.filter(item => item.visible)) {
      if (layer.style.thematic === "mapbiomas" || layer.style.thematic === "contrast") {
        for (const item of data.mapbiomas) {
          if(layer.style.thematic==='mapbiomas'&&!layer.features.some(f=>String(f.properties['ID MapBiomas'])===String(item.code)&&mapUi.featureVisible(layer,f,state.zoom)))continue;
          addLegendEntry(item.name, {color: item.color, fill: item.color, opacity: .48}, "polygon");
        }
      } else if(layer.style.thematic==='slope'){
        for(const item of data.slopeLegend)addLegendEntry(item.name,{color:item.color,fill:item.color,opacity:.7},'polygon');
        const note=document.createElement('p');note.className='legend-source';
        const link=document.createElement('a');link.href=layer.metadata.fuente;link.target='_blank';link.rel='noopener';link.textContent='Intervalos y colores: MINAM · ZEE Puno';
        note.append(link,document.createTextNode('. Pendiente de Tupicocha calculada localmente con DSM de 30 m.'));list.appendChild(note);
      } else if(layer.style.thematic==='contour'){
        addLegendEntry('Curvas principales · 250 m',{color:'#92704c'},'line');
        addLegendEntry('Curvas · 50 m al acercarse',{color:'#bba88d'},'line');
      } else if (layer.style.thematic === "transition") {
        addLegendEntry("Cambio de clase 2015–2025 (no degradación comprobada)", {color:"#b45b28",fill:"#cc8649",opacity:.7}, "polygon");
        addLegendEntry("Persistencia de clase", {color:"#8c9c86",fill:"#d4ddcc",opacity:.5}, "polygon");
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
          if(match.feature&&match.layer.style.thematic==='mapbiomas')setClassVisible(match.layer,String(match.feature.properties['ID MapBiomas']),true);
          else setLayerVisible(match.layer, true);
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
    let activePointerId = null;
    let wheelPixels = 0;
    let lastWheelAt = -Infinity;
    let lastWheelZoomAt = -Infinity;

    function endDrag(event) {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      state.dragging = false;
      map.classList.remove("dragging");
      if (map.hasPointerCapture(event.pointerId)) map.releasePointerCapture(event.pointerId);
    }

    map.addEventListener("pointerdown", event => {
      if (event.button !== 0 || event.isPrimary === false || activePointerId !== null || event.target.closest("button, label, input, a")) return;
      event.preventDefault();
      activePointerId = event.pointerId;
      state.dragging = true; state.moved = false; state.start = [event.clientX, event.clientY]; state.startCenter = mercator(...state.center); map.setPointerCapture(event.pointerId); map.classList.add("dragging");
    });
    map.addEventListener("pointermove", event => {
      const rect = map.getBoundingClientRect();
      const point = geoPoint(event.clientX - rect.left, event.clientY - rect.top);
      document.getElementById("coordinateReadout").textContent = `${point[1].toFixed(5)}, ${point[0].toFixed(5)}`;
      if (!state.dragging || event.pointerId !== activePointerId) return;
      const dx = event.clientX - state.start[0], dy = event.clientY - state.start[1];
      if (Math.abs(dx) + Math.abs(dy) > 3) state.moved = true;
      state.center = inverseMercator(state.startCenter[0] - dx, state.startCenter[1] - dy); render();
    });
    map.addEventListener("pointerup", event => {
      if (!state.dragging || event.pointerId !== activePointerId) return;
      endDrag(event);
      if (!state.moved) {
        const rect = map.getBoundingClientRect();
        const hit = hitTest(event.clientX - rect.left, event.clientY - rect.top);
        if (hit) selectFeature(hit.feature, hit.layer);
      }
    });
    map.addEventListener("pointercancel", endDrag);
    map.addEventListener("lostpointercapture", endDrag);
    map.addEventListener("wheel", event => {
      if (!event.deltaY || event.target.closest("button, label, input, a")) return;
      event.preventDefault();
      const now = performance.now();
      const pixels = event.deltaMode === 0 ? event.deltaY : Math.sign(event.deltaY) * 80;
      if (now - lastWheelAt > 180 || Math.sign(pixels) !== Math.sign(wheelPixels)) wheelPixels = 0;
      wheelPixels += pixels;
      lastWheelAt = now;
      // Una rueda equivale a un paso; los deltas finos del trackpad se acumulan.
      if (Math.abs(wheelPixels) < 80 || now - lastWheelZoomAt < 90) return;
      const rect = map.getBoundingClientRect();
      changeZoom(wheelPixels < 0 ? 1 : -1, event.clientX - rect.left, event.clientY - rect.top);
      wheelPixels = 0;
      lastWheelZoomAt = now;
    }, {passive: false});
  }

  function setupControls() {
    document.getElementById("zoomInBtn").onclick = () => changeZoom(1);
    document.getElementById("zoomOutBtn").onclick = () => changeZoom(-1);
    document.getElementById("homeBtn").onclick = () => fitBounds(data.project.studyBounds || data.project.bbox, 16);
    document.getElementById("focusAidBtn").onclick = () => fitBounds(data.project.aidBounds, 16);
    document.getElementById("focusAiiBtn").onclick = () => fitBounds(data.project.studyBounds, 16);
    document.getElementById("zoomFeatureBtn").onclick = () => state.selected && fitBounds(boundsOfFeature(state.selected.feature), 16);
    const basemapToggle = document.getElementById("basemapToggle");
    basemapToggle.checked = state.basemap;
    basemapToggle.disabled = isFileMode;
    basemapToggle.closest("label").title = isFileMode ? "Disponible mediante servidor local o GitHub Pages" : "Activar o desactivar el mapa base";
    document.getElementById("offlineBasemapNote").hidden = !isFileMode;
    const basemapSelect=document.getElementById('basemapSelect');
    basemapSelect.value=state.basemapSource;basemapSelect.disabled=isFileMode;
    const resetBasemap=()=>{document.getElementById('basemapStatus').hidden=true;[...tilePane.children].forEach(img=>img.remove());render();};
    basemapToggle.onchange=event=>{state.basemap=event.target.checked;resetBasemap();};
    basemapSelect.onchange=event=>{if(!basemaps.providers[event.target.value])return;state.basemapSource=event.target.value;state.basemap=true;basemapToggle.checked=true;resetBasemap();};
    document.getElementById("essentialBtn").onclick = () => { data.layers.forEach(layer => layer.visible = essential.has(layer.id) || essential.has(layer.title)); updateLayerToggles(); updateLegend(); render(); };
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
    document.getElementById("datasetSummary").textContent = `${data.project.layerCount} capas · ${data.project.featureCount} entidades · actualización local`;
    createLayerPanel(); updateLegend(); setupSearch(); setupMapEvents(); setupControls();
    new ResizeObserver(resizeCanvas).observe(map);
    resizeCanvas();
    fitBounds(data.project.studyBounds || data.project.bbox, 16);
  }

  init();
})();
