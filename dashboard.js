(() => {
  "use strict";
  const data = window.SUELOTUPI_DASHBOARD;
  if (!data || !data.areas) throw new Error("No se encontró el contrato v07 del dashboard. Vuelve a cargar la página.");
  const byId = id => document.getElementById(id);
  let selectedIndex = data.years.indexOf(data.project.latestYear);
  const yearSelect = byId("yearSelect"), areaSelect = byId("areaSelect");
  const baselineIndex = data.years.indexOf(data.project.baselineYear);
  const nf1 = new Intl.NumberFormat("es-PE", {minimumFractionDigits: 1, maximumFractionDigits: 1});
  const nf2 = new Intl.NumberFormat("es-PE", {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const nf4 = new Intl.NumberFormat("es-PE", {minimumFractionDigits: 4, maximumFractionDigits: 4});
  const nf0 = new Intl.NumberFormat("es-PE", {maximumFractionDigits: 0});
  const ageColors = ["#b6d75a", "#79ad73", "#3b8064", "#2c6653", "#d49a4d", "#9d6658"];
  const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
  const formatHa = value => `${nf1.format(value)} ha`;
  const formatSignedHa = value => `${value > 0 ? "+" : value < 0 ? "−" : ""}${nf1.format(Math.abs(value))} ha`;
  const share = (value, total) => total ? value / total * 100 : 0;
  const currentIndex = () => selectedIndex;
  const currentYear = () => data.years[currentIndex()];
  const currentArea = () => data.areas[areaSelect.value];
  const setText = (id, value) => { byId(id).textContent = value; };

  function renderKpis(index) {
    const area = currentArea(), total = area.totals["Área analizada"][index];
    const natural = area.totals.Natural[index], anthropic = area.totals["Antrópico"][index];
    const delta = anthropic - area.totals["Antrópico"][baselineIndex];
    setText("totalAreaKpi", formatHa(total));
    setText("totalAreaNote", `${areaSelect.value} · estimación con celdas nativas`);
    setText("naturalKpi", formatHa(natural));
    setText("naturalShare", `${nf1.format(share(natural, total))} % del área de celdas en ${currentYear()}`);
    setText("anthropicKpi", formatHa(anthropic));
    setText("anthropicDelta", `${formatSignedHa(delta)} respecto de 1985 · ${areaSelect.value}`);
    setText("scopeDefinition", `AID: ${nf2.format(data.areas.AID.vectorAreaHa)} ha; AII: ${nf2.format(data.areas.AII.vectorAreaHa)} ha. AID es perímetro urbano referencial; AII es aporte topográfico Copernicus ∩ distrito e incluye AID.`);
  }

  function renderTrend(index) {
    const area = currentArea(), values = area.totals["Antrópico"];
    const width = Math.max(280, byId("trendChart").clientWidth), height = 280, margin = {top: 18, right: 24, bottom: 34, left: 53};
    const innerW = width - margin.left - margin.right, innerH = height - margin.top - margin.bottom;
    const step = Math.max(...values) > 100 ? 20 : 5;
    const yMax = Math.max(step, Math.ceil(Math.max(...values) / step) * step);
    const x = i => margin.left + i / (values.length - 1) * innerW;
    const y = value => margin.top + innerH - value / yMax * innerH;
    const points = values.map((value, i) => `${x(i)},${y(value)}`).join(" ");
    const polygon = `${margin.left},${margin.top + innerH} ${points} ${margin.left + innerW},${margin.top + innerH}`;
    const selected = values[index];
    byId("trendChart").innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
      ${[0, .25, .5, .75, 1].map(part => { const value = yMax * part; return `<line class="grid-line" x1="${margin.left}" x2="${margin.left + innerW}" y1="${y(value)}" y2="${y(value)}"/><text class="axis-label" x="${margin.left - 8}" y="${y(value) + 3}" text-anchor="end">${nf1.format(value)}</text>`; }).join("")}
      ${(width < 450 ? [1985, 2005, 2025] : [1985, 1995, 2005, 2015, 2025]).map(year => `<text class="axis-label" x="${x(data.years.indexOf(year))}" y="${height - 9}" text-anchor="middle">${year}</text>`).join("")}
      <polygon class="trend-area" points="${polygon}"/><polyline class="trend-line" points="${points}"/>
      <line x1="${x(index)}" x2="${x(index)}" y1="${margin.top}" y2="${margin.top + innerH}" stroke="#174b38" stroke-dasharray="4 4"/>
      <circle class="trend-marker" cx="${x(index)}" cy="${y(selected)}" r="8"/>
      <text class="trend-label" x="${Math.min(x(index) + 10, width - 95)}" y="${Math.max(y(selected) - 10, 14)}">${nf1.format(selected)} ha</text></svg>`;
    byId("trendChart").setAttribute("aria-label", `${areaSelect.value}: superficie antrópica de ${nf2.format(values[0])} ha en 1985 a ${nf2.format(values.at(-1))} ha en 2025. Selección ${currentYear()}: ${nf2.format(selected)} ha. Serie exacta disponible en CSV.`);
    setText("trendTitle", `Superficie antrópica · ${areaSelect.value}`);
    setText("trendValue", formatHa(selected));
    setText("trendShare", `${nf1.format(share(selected, area.totals["Área analizada"][index]))} % en ${currentYear()}`);
  }

  function renderComposition(index) {
    const area = currentArea(), total = area.totals["Área analizada"][index];
    const rows = area.classes.map(item => ({...item, value: item.values[index]})).filter(row => row.value > 0).sort((a, b) => b.value - a.value);
    const max = Math.max(1, ...rows.map(row => row.value)), container = byId("compositionChart");
    container.replaceChildren();
    for (const row of rows) {
      const item = document.createElement("div"); item.className = "bar-row";
      item.innerHTML = `<div class="bar-name"><i style="background:${row.color}" aria-hidden="true"></i><span>${escapeHtml(row.name)}</span></div><div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${row.value / max * 100}%;background:${row.color}"></div></div><div class="bar-value"><strong>${nf1.format(row.value)} ha</strong><span>${share(row.value,total)<0.1 ? "&lt;0.1" : nf1.format(share(row.value,total))} %</span></div>`;
      item.setAttribute("title", `Clase ${row.code} · ${row.name}: ${nf4.format(row.value)} ha`);
      container.appendChild(item);
    }
    setText("compositionTitle", `Cobertura ${currentYear()} · ${areaSelect.value}`);
  }

  function renderChanges(index) {
    const rows = currentArea().classes.map(item => ({...item, delta: item.values[index] - item.values[baselineIndex]})).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const max = Math.max(1, ...rows.map(row => Math.abs(row.delta))), container = byId("changeChart");
    container.replaceChildren();
    for (const row of rows) {
      const item = document.createElement("div"); item.className = "change-row";
      const sign = row.delta > 0 ? "positive" : row.delta < 0 ? "negative" : "";
      item.innerHTML = `<div class="change-name">${escapeHtml(row.name)}</div><div class="change-track" aria-hidden="true"><span class="change-bar ${sign}" style="width:${Math.abs(row.delta) / max * 50}%"></span></div><div class="change-value ${sign}">${formatSignedHa(row.delta)}</div>`;
      item.setAttribute("title", `${row.name}: ${formatSignedHa(row.delta)}`); container.appendChild(item);
    }
    setText("changeTitle", `Cambio 1985–${currentYear()} · ${areaSelect.value}`);
  }


  function render() {
    const index=currentIndex(); yearSelect.value=String(currentYear());
    const chart=byId('trendChart');chart.setAttribute('aria-valuenow',currentYear());
    chart.setAttribute('aria-valuetext',`${currentYear()}: ${formatHa(currentArea().totals['Antrópico'][index])}`);
    setText('selectionStatus',`${areaSelect.value} · MapBiomas C4 · ${currentYear()}`);
    byId('previousYearBtn').disabled=index===0;byId('nextYearBtn').disabled=index===data.years.length-1;
    renderKpis(index);renderTrend(index);renderComposition(index);renderChanges(index);
  }
  function choose(index){selectedIndex=Math.max(0,Math.min(data.years.length-1,index));render();}
  function chooseAt(event){const box=byId('trendChart').getBoundingClientRect();choose(Math.round(((event.clientX-box.left)/box.width*Math.max(280,box.width)-53)/(Math.max(280,box.width)-77)*(data.years.length-1)));}
  const chart=byId('trendChart');let dragging=false;
  chart.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;dragging=true;chart.setPointerCapture(e.pointerId);chooseAt(e);});
  chart.addEventListener('pointermove',e=>{if(dragging)chooseAt(e);});
  chart.addEventListener('pointerup',()=>dragging=false);chart.addEventListener('pointercancel',()=>dragging=false);chart.addEventListener('lostpointercapture',()=>dragging=false);
  chart.addEventListener('keydown',e=>{const keys={ArrowLeft:currentIndex()-1,ArrowRight:currentIndex()+1,Home:0,End:data.years.length-1};if(e.key in keys){e.preventDefault();choose(keys[e.key]);}});
  for(const year of data.years){const option=document.createElement('option');option.value=year;option.textContent=year;yearSelect.appendChild(option);}
  areaSelect.value=data.project.defaultArea;areaSelect.addEventListener('change',render);
  yearSelect.addEventListener('change',()=>choose(data.years.indexOf(Number(yearSelect.value))));
  byId('previousYearBtn').addEventListener('click',()=>choose(currentIndex()-1));byId('nextYearBtn').addEventListener('click',()=>choose(currentIndex()+1));byId('latestYearBtn').addEventListener('click',()=>choose(data.years.length-1));
  let resizeFrame;window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(render);});render();
})();
