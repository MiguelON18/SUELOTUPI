(() => {
  "use strict";

  const data = window.SUELOTUPI_DASHBOARD;
  if (!data) throw new Error("No se encontró el snapshot del dashboard.");

  const slider = document.getElementById("yearSlider");
  const yearOutput = document.getElementById("yearOutput");
  const baselineIndex = data.years.indexOf(data.project.baselineYear);
  const nf1 = new Intl.NumberFormat("es-PE", {minimumFractionDigits: 1, maximumFractionDigits: 1});
  const nf0 = new Intl.NumberFormat("es-PE", {maximumFractionDigits: 0});
  const pct1 = new Intl.NumberFormat("es-PE", {minimumFractionDigits: 1, maximumFractionDigits: 1});
  const ageColors = ["#b6d75a", "#79ad73", "#3b8064", "#2c6653", "#d49a4d", "#9d6658"];

  const formatHa = value => `${nf1.format(value)} ha`;
  const formatSignedHa = value => `${value > 0 ? "+" : value < 0 ? "−" : ""}${nf1.format(Math.abs(value))} ha`;
  const share = (value, total) => total ? value / total * 100 : 0;

  function currentIndex() { return Number(slider.value); }
  function currentYear() { return data.years[currentIndex()]; }

  function renderKpis(index) {
    const total = data.totals["Área analizada"][index];
    const natural = data.totals.Natural[index];
    const anthropic = data.totals["Antrópico"][index];
    const delta = anthropic - data.totals["Antrópico"][baselineIndex];
    document.getElementById("totalAreaKpi").textContent = formatHa(total);
    document.getElementById("totalAreaNote").textContent = `Microcuenca vectorial: ${nf1.format(data.scope.microWatershedVectorAreaHa)} ha · diferencia ráster ${pct1.format(data.scope.classifiedVsMicroDifferencePct)} %`;
    document.getElementById("naturalKpi").textContent = formatHa(natural);
    document.getElementById("naturalShare").textContent = `${pct1.format(share(natural, total))} % del territorio en ${currentYear()}`;
    document.getElementById("anthropicKpi").textContent = formatHa(anthropic);
    document.getElementById("anthropicDelta").textContent = `${formatSignedHa(delta)} respecto de 1985`;
  }

  function renderTrend(index) {
    const values = data.totals["Antrópico"];
    const width = 760, height = 290;
    const margin = {top: 18, right: 24, bottom: 34, left: 48};
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const yMax = Math.ceil(Math.max(...values) / 20) * 20;
    const x = i => margin.left + i / (values.length - 1) * innerW;
    const y = value => margin.top + innerH - value / yMax * innerH;
    const points = values.map((value, i) => `${x(i)},${y(value)}`).join(" ");
    const area = `${margin.left},${margin.top + innerH} ${points} ${margin.left + innerW},${margin.top + innerH}`;
    const yTicks = [0, .25, .5, .75, 1].map(part => Math.round(yMax * part));
    const xYears = [1985, 1995, 2005, 2015, 2025];
    const selectedValue = values[index];
    const total = data.totals["Área analizada"][index];
    const svg = `
      <svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
        <defs><linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d58a2d" stop-opacity=".34"/><stop offset="1" stop-color="#d58a2d" stop-opacity=".03"/></linearGradient></defs>
        ${yTicks.map(value => `<line class="grid-line" x1="${margin.left}" x2="${margin.left + innerW}" y1="${y(value)}" y2="${y(value)}"/><text class="axis-label" x="${margin.left - 8}" y="${y(value) + 3}" text-anchor="end">${value}</text>`).join("")}
        ${xYears.map(year => { const i = data.years.indexOf(year); return `<text class="axis-label" x="${x(i)}" y="${height - 9}" text-anchor="middle">${year}</text>`; }).join("")}
        <polygon class="trend-area" points="${area}"/>
        <polyline class="trend-line" points="${points}"/>
        <line x1="${x(index)}" x2="${x(index)}" y1="${margin.top}" y2="${margin.top + innerH}" stroke="#174b38" stroke-dasharray="4 4" opacity=".5"/>
        <circle class="trend-marker" cx="${x(index)}" cy="${y(selectedValue)}" r="6"/>
        <text class="trend-label" x="${Math.min(x(index) + 10, width - 80)}" y="${Math.max(y(selectedValue) - 10, 14)}">${nf1.format(selectedValue)} ha</text>
      </svg>`;
    document.getElementById("trendChart").innerHTML = svg;
    document.getElementById("trendValue").textContent = formatHa(selectedValue);
    document.getElementById("trendShare").textContent = `${pct1.format(share(selectedValue, total))} % del territorio en ${currentYear()}`;
  }

  function renderComposition(index) {
    const total = data.totals["Área analizada"][index];
    const rows = data.classes.map(item => ({...item, value: item.values[index]})).sort((a, b) => b.value - a.value);
    const max = Math.max(...rows.map(row => row.value));
    const container = document.getElementById("compositionChart");
    container.replaceChildren();
    for (const row of rows) {
      const item = document.createElement("div"); item.className = "bar-row";
      item.innerHTML = `<div class="bar-name"><i style="background:${row.color}"></i><span>${row.name}</span></div><div class="bar-track" title="${row.name}: ${formatHa(row.value)}"><div class="bar-fill" style="width:${row.value / max * 100}%;background:${row.color}"></div></div><div class="bar-value"><strong>${nf1.format(row.value)} ha</strong><span>${pct1.format(share(row.value, total))} %</span></div>`;
      container.appendChild(item);
    }
    document.getElementById("compositionTitle").textContent = `Cobertura en ${currentYear()}`;
  }

  function renderChanges(index) {
    const rows = data.classes.map(item => ({...item, delta: item.values[index] - item.values[baselineIndex]})).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const max = Math.max(1, ...rows.map(row => Math.abs(row.delta)));
    const container = document.getElementById("changeChart");
    container.replaceChildren();
    for (const row of rows) {
      const item = document.createElement("div"); item.className = "change-row";
      const signClass = row.delta > 0 ? "positive" : row.delta < 0 ? "negative" : "";
      const width = Math.abs(row.delta) / max * 50;
      item.innerHTML = `<div class="change-name" title="${row.name}">${row.name}</div><div class="change-track"><span class="change-bar ${signClass}" style="width:${width}%"></span></div><div class="change-value ${signClass}">${formatSignedHa(row.delta)}</div>`;
      container.appendChild(item);
    }
    document.getElementById("changeTitle").textContent = `Cambio 1985–${currentYear()}`;
  }

  function renderInsights(index) {
    const year = currentYear();
    const total = data.totals["Área analizada"][index];
    const natural = data.totals.Natural[index];
    const anthropic = data.totals["Antrópico"][index];
    const anthropicDelta = anthropic - data.totals["Antrópico"][baselineIndex];
    const contributions = data.classes
      .filter(item => item.group === "Antrópico")
      .map(item => ({name: item.name, delta: item.values[index] - item.values[baselineIndex]}))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const contributionText = contributions.slice(0, 3).map(item => `${item.name} (${formatSignedHa(item.delta)})`).join(", ");
    const statements = [
      `En ${year}, las coberturas naturales representan ${pct1.format(share(natural, total))} % del área clasificada de la microcuenca.`,
      `La superficie antrópica registra ${formatSignedHa(anthropicDelta)} frente a 1985. Los principales componentes del balance son ${contributionText}.`,
      `El Censo 2017 registró 1 320 habitantes en el distrito. INEI y MapBiomas no comparten el mismo ámbito ni la misma temporalidad, por lo que este dashboard no atribuye el cambio de cobertura a la población.`
    ];
    const container = document.getElementById("insightList");
    container.replaceChildren();
    statements.forEach((text, index) => {
      const item = document.createElement("div"); item.className = "insight";
      item.innerHTML = `<b>${index + 1}</b><p>${text}</p>`; container.appendChild(item);
    });
  }

  function renderInei() {
    const total = data.inei.populationPrivateHousing;
    const stack = document.getElementById("ageStack");
    const legend = document.getElementById("ageLegend");
    data.inei.ageGroups.forEach((group, index) => {
      const segment = document.createElement("span");
      segment.style.width = `${group.value / total * 100}%`;
      segment.style.background = ageColors[index];
      segment.title = `${group.label}: ${nf0.format(group.value)} personas`;
      stack.appendChild(segment);
      const item = document.createElement("div");
      item.innerHTML = `<i style="background:${ageColors[index]}"></i><span>${group.label}</span><strong>${pct1.format(group.value / total * 100)} %</strong>`;
      legend.appendChild(item);
    });
  }

  function renderEvidence() {
    const sources = document.getElementById("sourceList");
    data.sources.forEach(source => {
      const link = document.createElement("a"); link.className = "source-item"; link.href = source.url; link.target = "_blank"; link.rel = "noopener";
      link.innerHTML = `<strong>${source.name} ↗</strong><span>${source.detail}</span>`; sources.appendChild(link);
    });
    const quality = document.getElementById("qualitySummary");
    const cards = [
      [data.quality.yearCount, "años completos"],
      [data.quality.activeClasses, "clases con área"],
      ["0,0 ha", "diferencia 2025"],
      [`${pct1.format(data.scope.classifiedVsMicroDifferencePct)} %`, "borde ráster/vector"],
    ];
    cards.forEach(([value, label]) => { const item = document.createElement("div"); item.innerHTML = `<strong>${value}</strong><span>${label}</span>`; quality.appendChild(item); });
    const limitations = document.getElementById("limitationList");
    data.quality.limitations.forEach(text => { const item = document.createElement("li"); item.textContent = text; limitations.appendChild(item); });
  }

  function render() {
    const index = currentIndex();
    yearOutput.textContent = currentYear();
    renderKpis(index);
    renderTrend(index);
    renderComposition(index);
    renderChanges(index);
    renderInsights(index);
  }

  slider.addEventListener("input", render);
  document.getElementById("latestYearBtn").addEventListener("click", () => { slider.value = String(data.years.length - 1); render(); });
  renderInei();
  renderEvidence();
  render();
})();
