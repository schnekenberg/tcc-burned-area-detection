
// visualização do plot de biomas, queimadas e terras indígenas (TIs) na AOI

// delimitação do estado de Roraima (AOI)
var states = ee.FeatureCollection("FAO/GAUL/2015/level1").filter(ee.Filter.eq('ADM0_NAME', 'Brazil'));
var roraima = states.filter(ee.Filter.eq('ADM1_NAME', 'Roraima'));

Map.centerObject(roraima, 7);

// coleção 9 do MapBiomas, especificando as classes relevantes para Roraima/fogo
var mapbiomas = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection9/mapbiomas_collection90_integration_v1').select('classification_2023').clip(roraima);

// classes selecionadas com base na legenda da coleção 9
var classIds = [3, 4, 11, 12, 33, 24];
var classNames = ['Floresta', 'Savânica', 'Campo Alagado', 'Campinarana', 'Rio/Lago', 'Área Urbana'];
var classPalette = ['1f8d49', '7dc975', '519799', 'd7c09b', '1a78c2', 'e31a1c'];

var classMask = mapbiomas.eq(3)
  .or(mapbiomas.eq(4))
  .or(mapbiomas.eq(11))
  .or(mapbiomas.eq(12))
  .or(mapbiomas.eq(33))
  .or(mapbiomas.eq(24));

var mbFiltered = mapbiomas.updateMask(classMask);
var mbRemapped = mbFiltered.remap(classIds, [0, 1, 2, 3, 4, 5]);

Map.addLayer(mbRemapped, {min: 0, max: 5, palette: classPalette}, 'MapBiomas: Classes Roraima');

// máscara de fogo 2024 do MapBiomas
var fireMask = ee.Image('projects/mapbiomas-public/assets/brazil/fire/collection4/mapbiomas_fire_collection4_annual_burned_v1')
  .select('burned_area_2024')
  .clip(roraima);

Map.addLayer(
  fireMask.selfMask(),
  {palette: ['ff0000']},
  'Áreas queimadas em 2024',
  false
);

// terras indígenas (TI)
var ti = ee.FeatureCollection('projects/forest-fire-detection-491901/assets/terras-indigenas').filterBounds(roraima.geometry());
Map.addLayer(ti, {color: 'orange'}, 'Terras Indígenas', false); // ti: variável de terras indígenas, importada do asset 'terras-indigenas' do projeto

// legenda
var legend = ui.Panel({
  style: {position: 'bottom-left', padding: '8px 12px', backgroundColor: 'white'}
});
legend.add(ui.Label({
  value: 'Classes (Coleção 9 do MapBiomas)',
  style: {fontWeight: 'bold', fontSize: '13px', margin: '0 0 6px 0'}
}));

for (var i = 0; i < classNames.length; i++) {
  var row = ui.Panel({layout: ui.Panel.Layout.flow('horizontal')});
  row.add(ui.Label({style: {backgroundColor: '#' + classPalette[i], padding: '8px', margin: '2px 6px 2px 0'}}));
  row.add(ui.Label({value: classNames[i], style: {margin: '4px 0'}}));
  legend.add(row);
}

// adiciona fogo e TIs na legenda
var fireRow = ui.Panel({layout: ui.Panel.Layout.flow('horizontal')});
fireRow.add(ui.Label({style:{backgroundColor: '#ff0000', padding: '8px', margin: '2px 6px 2px 0'}}));
fireRow.add(ui.Label({value: 'Queimadas 2024', style: {margin: '4px 0'}}));
legend.add(fireRow);

var tiRow = ui.Panel({layout: ui.Panel.Layout.flow('horizontal')});
tiRow.add(ui.Label({style:{backgroundColor: 'ffa500', padding: '8px', margin: '2px 6px 2px 0'}}));
tiRow.add(ui.Label({value: 'Terras Indígenas', style: {margin: '4px 0'}}));
legend.add(tiRow);

Map.add(legend);
