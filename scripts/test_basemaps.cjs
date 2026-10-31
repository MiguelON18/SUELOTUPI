const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');assert(fs.existsSync(path.join(root,'basemaps.js')),'Falta módulo de fondos');const maps=require('../basemaps.js');
assert.equal(maps.tileUrl('esri',14,4711,8740),'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/8740/4711');
assert.equal(maps.tileUrl('osm',14,4711,8740),'https://tile.openstreetmap.org/14/4711/8740.png');
const source=fs.readFileSync(path.join(root,'app.js'),'utf8');const code=source.slice(source.indexOf('  function updateTiles()'),source.indexOf('  function updateScaleBar()'));
const elements=[],pane={style:{},querySelector(s){return elements.find(e=>s===`[data-key="${e.dataset.key}"]`)},appendChild(e){elements.push(e)},get children(){return elements}};
const state={basemap:true,basemapSource:'esri',zoom:14,center:[-76.47,-12]};const attr={innerHTML:''};
class Img{constructor(){this.dataset={};this.style={};this.complete=false;this.naturalWidth=0;}remove(){elements.splice(elements.indexOf(this),1)}}
const cx=vm.createContext({state,tilePane:pane,map:{clientWidth:256,clientHeight:256},mercator:()=>[1024,1024],Image:Img,basemaps:maps,document:{getElementById:()=>attr}});vm.runInContext(code+';updateTiles();',cx);assert(elements.every(e=>e.src.includes('arcgisonline.com')));assert(attr.innerHTML.includes('Esri'));
state.basemapSource='osm';vm.runInContext('updateTiles()',cx);assert(elements.every(e=>e.src.includes('tile.openstreetmap.org')),'Cambiar fondo elimina teselas previas');assert(attr.innerHTML.includes('OpenStreetMap'));
state.basemapSource='esri';state.zoom=19;vm.runInContext('updateTiles()',cx);assert(elements.every(e=>e.src.includes('/tile/17/')));assert(elements.every(e=>e.style.width==='1024px'&&e.style.height==='1024px'),'Ampliar teselas nativas sin pedir niveles vacíos');
state.basemap=false;vm.runInContext('updateTiles()',cx);assert.equal(pane.style.opacity,'0');
console.log('OK: URL XYZ/Esri, cambio de fondo sin mezclar teselas, créditos y apagado');

const controls={basemapToggle:{closest:()=>({})},basemapSelect:{},offlineBasemapNote:{},basemapStatus:{}};
const controlSource=source.slice(source.indexOf('    const basemapToggle = document.getElementById'),source.indexOf('    document.getElementById("essentialBtn")'));
let rendered=0;const scope=vm.createContext({document:{getElementById:id=>controls[id]},state,isFileMode:false,basemaps:maps,tilePane:pane,render:()=>rendered++});vm.runInContext(controlSource,scope);controls.basemapSelect.onchange({target:{value:'osm'}});assert.equal(state.basemapSource,'osm');assert.equal(state.basemap,true);assert.equal(controls.basemapToggle.checked,true);assert.equal(elements.length,0);assert(rendered>0);controls.basemapToggle.onchange({target:{checked:false}});assert.equal(state.basemap,false);console.log('OK: controles de selección, activación y apagado');
