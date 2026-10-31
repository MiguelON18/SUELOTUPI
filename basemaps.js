(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SUELOTUPI_BASEMAPS=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const providers={
  esri:{name:'Satélite · Esri',maxNativeZoom:17,attribution:'<a href="https://www.esri.com/" target="_blank" rel="noopener"><img class="esri-credit-logo" src="assets/esri-logo.png" alt="Esri"></a> · Vantor · Earthstar Geographics · GIS User Community · <a href="fuentes.html">Fuentes temáticas</a>',credits:'https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9'},
  osm:{name:'OpenStreetMap',maxNativeZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · <a href="fuentes.html">Fuentes temáticas</a>',credits:'https://www.openstreetmap.org/copyright'}
 };
 function tileUrl(id,z,x,y){if(id==='esri')return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;if(id==='osm')return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;throw new Error('Mapa base desconocido');}
 return {providers,tileUrl};
});
