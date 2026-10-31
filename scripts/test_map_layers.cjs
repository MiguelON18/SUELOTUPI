const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const source = app.slice(app.indexOf('  function updateLayerToggles()'),app.indexOf('  function updateLegend()'));
const layers=[{id:'AID',visible:true},{id:'C4',visible:true,exclusiveGroup:'coverage'},{id:'CONTRASTE',visible:false,exclusiveGroup:'coverage'}];
// El orden del panel es por grupo y no coincide con el orden de dibujo.
const makeButton=(id)=>({dataset:{layerId:id},on:false,attrs:{},classList:{toggle(name,state){this.owner.on=state;}},setAttribute(key,value){this.attrs[key]=String(value);}});
const buttons=['CONTRASTE','AID','C4'].map(makeButton);
buttons.forEach(b=>{b.classList.owner=b;});
const context=vm.createContext({data:{layers},document:{querySelectorAll:selector=>selector.startsWith(".layer-toggle")?buttons:[]},updateLegend(){},render(){}});
vm.runInContext(source+'\nupdateLayerToggles();',context);
assert.deepEqual(buttons.map(b=>b.on),[false,true,true], 'cada control sigue su capa por ID, no por posición');
vm.runInContext('setLayerVisible(data.layers[2],true);',context);
assert.deepEqual(layers.map(l=>l.visible),[true,false,true], 'el contraste desactiva la cobertura alternativa');
assert.deepEqual(buttons.map(b=>b.on),[true,true,false]);
assert.deepEqual(buttons.map(b=>b.attrs['aria-pressed']),['true','true','false']);
console.log('OK: controles por ID y exclusión de representaciones alternativas');
