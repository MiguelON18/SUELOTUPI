from pathlib import Path
import json, sys
from osgeo import gdal, ogr, osr

site, source = map(Path, sys.argv[1:])
raw = (site/'data/layers.js').read_text()
data = json.loads(raw[raw.index('{'):].strip().rstrip(';'))
layers = {l['id']: l for l in data['layers']}
derived_ids = {'DRENAJE_D8_COP_AII', 'APORTE_CIERRE_ALTO', 'INSPECCION_DRENAJE'}
data['layers'] = [layer for layer in data['layers'] if layer['id'] not in derived_ids]
output = site/'downloads/hidrologia'
output.mkdir(parents=True, exist_ok=True)

def geometry(obj):
    return ogr.CreateGeometryFromJson(json.dumps(obj))

def as_json(obj):
    return json.loads(obj.ExportToJson())

def feature(geom, **properties):
    return dict(type='Feature', geometry=geom, properties=properties)

def add(layer_id, title, features, style, bbox):
    path = f'downloads/hidrologia/{layer_id}.geojson'
    (site/path).write_text(json.dumps(dict(type='FeatureCollection', features=features), ensure_ascii=False, separators=(',',':'))+'\n')
    data['layers'].append(dict(id=layer_id,title=title,group='Control hidrológico',visible=False,count=len(features),bbox=bbox,style=style,features=features,
        metadata=dict(download=path,fuente='Control hidrológico Copernicus GLO30 · 29/10/2026')))

local, geographic = [osr.SpatialReference() for _ in range(2)]
for crs, epsg in [(local,32718),(geographic,4326)]:
    crs.ImportFromEPSG(epsg)
    crs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
forward = osr.CoordinateTransformation(geographic,local)
inverse = osr.CoordinateTransformation(local,geographic)
aii = geometry(layers['AII']['features'][0]['geometry'])
aii.Transform(forward)
acc = gdal.Open(str(source/'raster/ACUMULACION_D8_COP.tif'))
dir_ds = gdal.Open(str(source/'raster/DIRECCION_D8_COP.tif'))
assert acc.GetGeoTransform() == dir_ds.GetGeoTransform()
a, d = acc.ReadAsArray(), dir_ds.ReadAsArray()
x0, dx, _, y0, _, dy = acc.GetGeoTransform()
offsets={1:(0,1),2:(1,1),4:(1,0),8:(1,-1),16:(0,-1),32:(-1,-1),64:(-1,0),128:(-1,1)}
network = ogr.Geometry(ogr.wkbMultiLineString)
# 20 ha of upstream contributing area, excluding the receiving cell.
for row, col in zip(*((a>=223)&(a!=acc.GetRasterBand(1).GetNoDataValue())).nonzero()):
    if d[row,col] not in offsets:
        continue
    dr,dc=offsets[d[row,col]]
    line=ogr.Geometry(ogr.wkbLineString)
    for r,c in [(row,col),(row+dr,col+dc)]:
        line.AddPoint_2D(x0+(c+.5)*dx,y0+(r+.5)*dy)
    if aii.Intersects(line):
        clipped=aii.Intersection(line)
        if clipped.GetGeometryName()=='LINESTRING' and clipped.Length()>0:
            network.AddGeometry(clipped)
        elif clipped.GetGeometryName()=='MULTILINESTRING':
            for part in clipped:
                network.AddGeometry(part)
length_km=network.Length()/1000
points=[]
for layer_id in ('CONTACTOS_VIA_AGUA','PUNTOS_REVISION_INVENTARIO'):
    for item in layers[layer_id]['features']:
        point=geometry(item['geometry'])
        point.Transform(forward)
        distance=network.Distance(point)
        if distance>60:
            continue
        p=item['properties']
        points.append(feature(item['geometry'],Nombre=p['id_agenda']+' · '+p['Nombre'],
            distancia_red_modelada_m=round(distance,1),accion_preparatoria=p['accion_preparatoria'],
            estado='Inspección propuesta · proximidad cartográfica, pendiente de campo'))
network.Transform(inverse)
bbox=data['project']['bbox']
add('DRENAJE_D8_COP_AII','Drenaje modelado · Copernicus', [feature(as_json(network),Nombre='Red modelada D8',longitud_km=round(length_km,2),umbral_aporte_ha=20.07,
     estado='Concentración topográfica potencial · caudal sin estimar')],dict(color='#137aab',width=1.6),bbox)
basin_path=source/'geojson/APORTE_COP_R30.geojson'
if not basin_path.exists():
    basin_path=source/'entrega_AII/geojson/APORTE_COP_R30_AII.geojson'
basin=json.loads(basin_path.read_text(encoding='utf-8-sig'))
for f in basin['features']:
    f['properties']=dict(Nombre='Aporte superficial al cierre alto · Copernicus',estado='Escenario D8 del control previo · conexión subterránea pendiente de evaluación',ambito='Recorte a AII' if 'entrega_AII' in basin_path.parts else 'Aporte completo del modelo')
if 'entrega_AII' not in basin_path.parts:
    pts=[]
    def collect(c):
        if c and isinstance(c[0],(int,float)):
            pts.append(c)
        else:
            for part in c: collect(part)
    for f in basin['features']: collect(f['geometry']['coordinates'])
    basin_bbox=[min(p[0] for p in pts),min(p[1] for p in pts),max(p[0] for p in pts),max(p[1] for p in pts)]
else:
    basin_bbox=bbox
add('APORTE_CIERRE_ALTO','Aporte al cierre alto · Copernicus',basin['features'],dict(color='#17656d',fill='#74bfc1',opacity=.25,width=1.5),basin_bbox)
if points:
    add('INSPECCION_DRENAJE','Puntos propuestos de inspección',points,dict(color='#8c461a',fill='#efb55d',width=1.4,radius=5),bbox)
data["project"].update(layerCount=len(data["layers"]), featureCount=sum(l["count"] for l in data["layers"]))

(site/'data/layers.js').write_text('window.SUELOTUPI_DATA='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
print(json.dumps(dict(km=length_km,points=[f['properties']['Nombre'] for f in points],basin=str(basin_path),n=network.GetGeometryCount()),ensure_ascii=False))
