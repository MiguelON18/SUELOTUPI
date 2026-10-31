((root)=>{
  'use strict';
  const nf=(value,digits=0)=>new Intl.NumberFormat('es-PE',{maximumFractionDigits:digits}).format(Number(value));
  function featureVisible(layer,feature,zoom=18){
    if(!layer.visible)return false;
    if(layer.style?.thematic==='mapbiomas')return layer.classVisibility?.[String(feature.properties['ID MapBiomas'])]!==false;
    if(layer.style?.thematic==='contour')return feature.properties.indice||zoom>=14;
    return true;
  }
  function featureRows(layer,feature){
    const p=feature.properties,id=layer.id;
    const area=p.area_ha??p.area_ha_recalculada;
    const length=p.longitud_m??p.longitud_m_recalculada;
    const rows=(items)=>items.filter(([,v])=>v!=null&&v!=='');
    if(id==='AID'||id==='AII')return rows([
      ['Superficie',area==null?null:`${nf(area,2)} ha`],
      ['Delimitación',id==='AID'?'Perímetro continuo del casco urbano':'Aporte superficial ∩ distrito'],
      ['Alcance','Referencia cartográfica del estudio']]);
    if(id==='CANALES_INTERPRETADOS')return rows([
      ['Longitud',length==null?null:`${nf(length)} m`],['Imagen de referencia',p['Fecha de imagen']],['Conexión al pueblo','Por confirmar']]);
    if(id==='DEPOSITOS_INTERPRETADOS')return rows([
      ['Superficie dibujada',p.superficie_m2==null?null:`${nf(p.superficie_m2)} m²`],
      ['Imagen de referencia',p['Fecha de imagen']],['Revestimiento','Por confirmar']]);
    if(id==='PUNTOS_REVISION_INVENTARIO')return rows([
      ['Proceso declarado',p.proceso_declarado_GDB],['Fuente del registro',p.fuente_declarada_GDB],
      ['Fecha del evento','Por confirmar'],['Comprobación pendiente','Ficha, huella y estado actual']]);
    if(id==='CONTACTOS_VIA_AGUA')return rows([
      ['Referencia','Contacto entre ejes de vía y cauce'],
      ['Distancia a AID',p.dist_AID_referencial_recalculada_m==null?null:`${nf(p.dist_AID_referencial_recalculada_m)} m`],
      ['Comprobación pendiente','Cruce real, estructura y estado']]);
    if(layer.style?.thematic==='mapbiomas')return rows([
      ['Año',2025],['Superficie en AII',p.area_ha_C4==null?null:`${nf(p.area_ha_C4,2)} ha`],
      ['Porcentaje clasificado',p.porcentaje_C4==null?null:`${nf(p.porcentaje_C4,2)} %`],['Fuente','MapBiomas Perú · Colección 4']]);
    if(layer.style?.thematic==='slope')return rows([
      ['Pendiente',p.intervalo],['Superficie de celdas',p.area_celdas_ha==null?null:`${nf(p.area_celdas_ha,2)} ha`],['Modelo','Copernicus · 30 m'],['Referencia MINAM',p.referencia_leyenda]]);
    if(layer.style?.thematic==='contour')return [['Cota del modelo',`${nf(p.cota_m)} m`],['Equidistancia','50 m · principales cada 250 m'],['Modelo','DSM Copernicus · 30 m']];
    if(layer.style?.thematic==='transition')return [['Cobertura 2015',p.nombre_2015||p.clase_2015],['Cobertura 2025',p.nombre_2025||p.clase_2025],['Resultado',p.cambio?'Cambio de clase':'Persistencia de clase']];
    if(layer.style?.thematic==='contrast')return [['Cobertura C4',p.nombre_C4||p.clase_C4_2025],['Pendiente',`${p.intervalo_pendiente_grados} grados`],['Superficie',`${nf(p.area_ha_vector_UTM,2)} ha`]];
    return rows([['Longitud',length==null?null:`${nf(length)} m`],['Superficie',area==null?null:`${nf(area*10000)} m²`],['Uso','Referencia cartográfica'],['Fuente',p['Fuente heredada']?'Insumo académico de referencia':null]]);
  }
  const api={featureVisible,featureRows};
  if(typeof module!=='undefined')module.exports=api;
  root.SUELOTUPI_MAP_UI=api;
})(typeof window!=='undefined'?window:globalThis);
