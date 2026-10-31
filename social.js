(() => {
 'use strict';
 const social=window.SUELOTUPI_DASHBOARD?.social;if(!social)return;
 const profile=window.SUELOTUPI_ACTION_CONTEXT;
 const el=id=>document.getElementById(id),nf=new Intl.NumberFormat('es-PE',{maximumFractionDigits:1}),n=v=>nf.format(Number(v));
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const value=(id,year=2025)=>social.indicadores.find(r=>r.id_indicador===id&&r.anio===year);
 function renderAll(){
 const W=id=>Math.min(520,Math.max(280,el(id).clientWidth||el('populationChart').clientWidth||520));
 const svg=(id,body,height,label)=>{el(id).innerHTML=`<svg viewBox="0 0 ${W(id)} ${height}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${body}</svg>`;};
 // Gráficos de barras desde cero: etiquetas y denominadores legibles también sin color.
 function bars(id,rows,max,unit='personas'){
  const width=W(id)-10,left=10,plot=width-10,mobile=W(id)<400,step=mobile?90:72;let body='';
  rows.forEach((r,i)=>{const y=15+i*step;body+=`<text x="10" y="${y+13}" class="chart-label">${esc(r.label)}</text><rect x="${left}" y="${y+(mobile?46:27)}" width="${Number(r.value)/max*plot}" height="14" fill="${r.color||'#1f6b4f'}"/><text x="${width}" y="${y+(mobile?34:13)}" text-anchor="end" class="chart-number">${esc(r.display||n(r.value)+' '+unit)}</text>`;});
  body+=`<text x="10" y="${rows.length*step+12}" class="chart-axis">0</text><text x="${width}" y="${rows.length*step+12}" text-anchor="end" class="chart-axis">${n(max)} ${esc(unit)}</text>`;
  svg(id,body,rows.length*step+22,rows.map(r=>r.label+': '+(r.display||n(r.value)+' '+unit)).join('. '));
 }
 bars('populationChart',[2017,2025].map(year=>({label:String(year),value:value('poblacion',year).casos,color:year===2017?'#82998b':'#1f6b4f'})),1500);
 bars('sexChart',social.sexo.map(r=>({label:r.categoria,value:r.casos_2025,display:`${n(r.casos_2025)} · ${n(r.porcentaje_2025)} %`})),800);
 // Pares de barras con eje común 0–30 %, no grupos normalizados individualmente.
 const age=social.ciclo_vida,left=W('ageComparison')<400?50:90,plot=W('ageComparison')-left-55,step=58,top=30;let content='';
 [0,10,20,30].forEach(p=>content+=`<line x1="${left+p/30*plot}" x2="${left+p/30*plot}" y1="20" y2="${top+age.length*step-10}" class="grid-line"/><text x="${left+p/30*plot}" y="13" text-anchor="middle" class="chart-axis">${p} %</text>`);
 age.forEach((r,i)=>{const y=top+i*step,label=r.categoria.match(/\((.*)\)/)?.[1]||r.categoria;content+=`<g class="age-group"><text x="${left-12}" y="${y+22}" text-anchor="end" class="chart-label">${esc(label.replaceAll('-','–'))}</text>`;
 [2017,2025].forEach((year,j)=>{const p=Number(r['porcentaje_'+year]),count=Number(r['casos_'+year]);content+=`<rect data-year="${year}" data-count="${count}" x="${left}" y="${y+j*21}" width="${p/30*plot}" height="14" fill="${j?'#1f6b4f':'#82998b'}"><title>${esc(r.categoria)} · ${year}: ${count} personas · ${n(p)} %</title></rect><text x="${left+p/30*plot+5}" y="${y+12+j*21}" class="chart-number">${n(p)}</text>`;});content+='</g>';});
 svg('ageComparison',content,top+age.length*step,'Porcentaje por grupo de edad; escala de 0 a 30 %. '+age.map(r=>r.categoria+': 2017, '+r.casos_2017+' personas ('+n(r.porcentaje_2017)+' %); 2025, '+r.casos_2025+' personas ('+n(r.porcentaje_2025)+' %).').join(' '));
 if(profile){
 bars('generationChart',['jovenes','50+'].flatMap(id=>[2017,2025].map(year=>({label:`${id==='jovenes'?'18–29 años':'50+ años'} · ${year}`,value:id==='jovenes'?value(id,year).casos:profile.edades50[year].casos,color:year===2017?'#82998b':'#1f6b4f'}))),600);
 el('generationReading').textContent=`50+ años: ${n(profile.edades50[2017].porcentaje)} % en 2017 y ${n(profile.edades50[2025].porcentaje)} % en 2025. Jóvenes de 18–29: ${n(value('jovenes',2017).porcentaje)} % y ${n(value('jovenes').porcentaje)} %. Son edades, no un conteo de trabajadores.`;
 bars('migrationChart',[{label:'Provincia de Lima',value:profile.salidas.provincia_lima},{label:'Otros distritos del Perú',value:profile.salidas.personas-profile.salidas.provincia_lima}],50);
 }
 const agri=value('sector_A_2017',2017);bars('agricultureChart',[{label:'Sector agropecuario, forestal y pesca',value:agri.porcentaje,display:`${n(agri.porcentaje)} % · ${agri.casos} / ${agri.base}`},{label:'Otras respuestas de actividad',value:100-agri.porcentaje,display:`${n(100-agri.porcentaje)} % · ${agri.base-agri.casos} / ${agri.base}`,color:'#82998b'}],100,'%');
 if(profile){bars('waterChart',['Red pública','Manantial o puquio'].flatMap(category=>[2017,2025].map(year=>{const r=profile.perfil.find(r=>r.pregunta==='agua'&&r.categoria===category);return {label:category+' · '+year,value:r['porcentaje_'+year],display:`${n(r['porcentaje_'+year])} % · ${r['casos_'+year]} / ${Number(r['base_'+year])}`,color:year===2017?'#82998b':'#1f6b4f'}})),100,'%');}
 bars('communicationChart',[['internet_movil','Hogares con internet móvil'],['uso_internet','Personas de 3+ que usaron internet']].map(([id,label])=>{const r=value(id);return {label,value:r.porcentaje,display:`${n(r.porcentaje)} % · ${r.casos} / ${r.base}`}}),100,'%'); if(profile&&el('mobilityProfile')){
 const mobility=profile.perfil.filter(r=>r.pregunta==='disc_moverse');bars('mobilityProfile',mobility.map(r=>({label:r.categoria,value:r.porcentaje_2025,display:`${n(r.porcentaje_2025)} % · ${r.casos_2025} / ${Number(r.base_2025)}`})),100,'%');
 const school=profile.perfil.filter(r=>r.pregunta==='nivel');const base=Number(school[0].base_2025);const primary=school.find(r=>r.categoria==='Primaria'),secondary=school.find(r=>r.categoria==='Secundaria');const other=base-Number(primary.casos_2025)-Number(secondary.casos_2025);
 bars('educationProfile',[{label:'Primaria',value:Number(primary.porcentaje_2025),display:`${n(primary.porcentaje_2025)} % · ${primary.casos_2025} / ${base}`},{label:'Secundaria',value:Number(secondary.porcentaje_2025),display:`${n(secondary.porcentaje_2025)} % · ${secondary.casos_2025} / ${base}`},{label:'Otros niveles',value:other/base*100,display:`${n(other/base*100)} % · ${other} / ${base}`}],100,'%');
 bars('languageProfile',['lengua_castellano','lengua_quechua'].map(id=>{const r=profile.perfil.find(r=>r.pregunta===id&&r.categoria==='Sí');return {label:id==='lengua_castellano'?'Castellano':'Quechua',value:r.porcentaje_2025,display:`${n(r.porcentaje_2025)} % · ${r.casos_2025} / ${Number(r.base_2025)}`}}),100,'%');
 }

 }
 renderAll();let resizeFrame;window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(renderAll);});
})();
