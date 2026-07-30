
// 1. delimitação do estado de Roraima (AOI)
var states = ee.FeatureCollection("FAO/GAUL/2015/level1").filter(ee.Filter.eq('ADM0_NAME', 'Brazil'));
var roraima = states.filter(ee.Filter.eq('ADM1_NAME', 'Roraima'));
Map.centerObject(roraima, 7);

// 2. coleta e criação da máscara de floresta (MapBiomas LUCL)
var vegetationMask = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection9/mapbiomas_collection90_integration_v1')
  .select('classification_2023')
  .clip(roraima);
  
var forestMask = vegetationMask.eq(3).or(vegetationMask.eq(12)); // classes 3 e 12: formação florestal e formação campestre (campinarana)

// 3. coleta de TIs e criação de máscara
var ti = ee.FeatureCollection('projects/tcc-burned-area/assets/tis-roraima');
var tiMask = ee.Image(0)
  .paint(ti, 1)
  .clip(roraima)
  .rename('indigenous')
  .toByte();

// 4. coleta de instâncias de queimadas (MapBiomas Monthly Fire). a máscara será dividida em meses para aumentar precisão da detecção
var monitorFogo = ee.ImageCollection(
  'projects/mapbiomas-public/assets/brazil/fire/monitor/mapbiomas_fire_monthly_burned_v1'
);

// função para pegar a máscara de fogo de um mês específico.
function getFireMask(ano, mes) {
  return monitorFogo
    .filter(ee.Filter.calendarRange(ano, ano, 'year'))
    .filter(ee.Filter.calendarRange(mes, mes, 'month'))
    .first()
    .select('FireMonth')
    .clip(roraima);
}

// 5. máscara de nuvens, sombras e outras anomalias
function maskS2clouds(image) {
  var scl = image.select('SCL'); // banda Scene Classification Layer do Sentinel-2
  
  // remove pixels contendo:
  var mask = scl.neq(3) // sombra de nuvem
    .and(scl.neq(8)) // probabilidade média de nuvem
    .and(scl.neq(9)) // probabilidade alta de nuvem
    .and(scl.neq(10)) // nuvens cirrus

  return image.updateMask(mask).divide(10000);
}

// 6. exportação de máscaras estáticas, que não mudam por mês (floresta e TIs) para o google cloud storage
Export.image.toCloudStorage({
  image: forestMask.reproject({crs: 'EPSG:4326', scale: 10}), // resolução alterada de 30m para 10m
  description: 'roraima_forest_mask', // máscara floresta
  bucket: 'tcc-roraima-dataset',
  region: roraima.geometry().bounds(),
  scale: 10,
  maxPixels: 1e13,
  crs: 'EPSG:4326'
});

Export.image.toCloudStorage({
  image: tiMask.reproject({crs: 'EPSG:4326', scale: 10}),
  description: 'roraima_indigenous_mask', // máscara TIs
  bucket: 'tcc-roraima-dataset',
  region: roraima.geometry().bounds(),
  scale: 10,
  maxPixels: 1e13,
  crs: 'EPSG:4326'
});

// 7. cálculos envolvendo meses: conjunto de imagens Sentinel-2 e máscara de fogo (queimadas) separadas por mês para aumentar acurácia na rotulação
var months = [
  {id: '202401', year: 2024, month: 1,  start: '2024-01-01', end: '2024-02-01'},
  {id: '202402', year: 2024, month: 2,  start: '2024-02-01', end: '2024-03-01'},
  {id: '202403', year: 2024, month: 3,  start: '2024-03-01', end: '2024-04-01'},
  {id: '202404', year: 2024, month: 4,  start: '2024-04-01', end: '2024-05-01'},
  {id: '202411', year: 2024, month: 11, start: '2024-11-01', end: '2024-12-01'},
  {id: '202412', year: 2024, month: 12, start: '2024-12-01', end: '2025-01-01'}
];

months.forEach(function (m){
  // 8. composite de imagens do Sentinel-2 mensal
  var s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
  .filterBounds(roraima)
  .filterDate(m.start, m.end) // período de estudo
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 60))
  .map(maskS2clouds); // aplica máscara de nuvens
  
  var composite = s2.median().clip(roraima);
  
  // 9. cálculo de índices e aplicação de bandas espectrais (features)
  var ndvi = composite.normalizedDifference(['B8','B4']).rename('NDVI'); // normalized difference vegetation index
  var nbr = composite.normalizedDifference(['B8','B12']).rename('NBR'); // normalized burn ratio
  var b12_10m = composite.select('B12').reproject({
    crs: composite.select('B2').projection(),
    scale: 10
  }); // banda 12 precisa ser reprojetada para 10m
  
  var finalImage = composite
    .select(['B2','B3','B4','B8'])
    .addBands(b12_10m)
    .addBands(ndvi)
    .addBands(nbr); // imagem Sentinel-2 final do mês
    
  // 10. máscara de queimadas do mês correspondente
  var fireMask = getFireMask(m.year, m.month);
    
  // 11. exportações do mês para o google cloud storage
  Export.image.toCloudStorage({
    image: finalImage,
    description: 'roraima_composite_' + m.id, // composite de imagens
    bucket: 'tcc-roraima-dataset',
    region: roraima.geometry().bounds(),
    scale: 10,
    maxPixels: 1e13,
    crs: 'EPSG:4326'
  });
  
  Export.image.toCloudStorage({
    image: fireMask.reproject({crs: 'EPSG:4326', scale: 10}),
    description: 'roraima_fire_mask_' + m.id, // máscara de fogo
    bucket: 'tcc-roraima-dataset',
    region: roraima.geometry().bounds(),
    scale: 10,
    maxPixels: 1e13,
    crs: 'EPSG:4326'
  });
  
  // 12. visualização
  Map.addLayer(composite, {bands:['B4','B3','B2'], min: 0.02, max: 0.3}, 'RGB ' + m.id, false);
  Map.addLayer(composite, {bands:['B12','B8','B4'], min: 0.02, max: 0.35}, 'SWIR ' + m.id, false);
  Map.addLayer(fireMask.selfMask(), {palette: ['red']}, 'fire mask ' + m.id, false);
});

// 13. visualização de máscaras estáticas
Map.addLayer(forestMask.selfMask(), {palette: ['green']}, 'forest mask');
Map.addLayer(tiMask.selfMask(), {palette: ['orange']}, 'indigenous land mask');
