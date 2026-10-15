// Urbanized — Biodiversity, Flora & Fauna Engine
// Provides ecological classification, native flora, and wildlife data based on geographic coordinates.

const BIOMES = {
  TROPICAL_RAINFOREST: {
    id: 'tropical_rainforest',
    name: 'Selva Tropical Húmeda',
    climate: 'Ecuatorial cálido y lluvioso todo el año (>2,500 mm anuales)',
    canopy: 'Dosel denso estratificado continuo (30 - 45 m)',
    soil: 'Latosoles y oxisoles arcillosos de rápida lixiviación',
    flora: [
      { name: 'Ceiba Sagrada', latin: 'Ceiba pentandra', type: 'Árbol emergente gigante', note: 'Especie clave de dosel (hasta 60m)' },
      { name: 'Caoba Real', latin: 'Swietenia macrophylla', type: 'Árbol maderable noble', note: 'Estrato superior de madera densa' },
      { name: 'Orquídea Vainilla', latin: 'Vanilla planifolia', type: 'Epífita trepadora', note: 'Polinizada por abejas meliponas' },
      { name: 'Palma Real', latin: 'Roystonea regia', type: 'Palmera perenne', note: 'Refugio de avifauna tropical' },
      { name: 'Helecho Arborescente', latin: 'Cyathea caracasana', type: 'Helecho gigante', note: 'Indicador de humedad constante' }
    ],
    fauna: [
      { name: 'Jaguar', latin: 'Panthera onca', class: 'Mamífero depredador ápice', status: 'Casi amenazado' },
      { name: 'Tucán Real', latin: 'Ramphastos sulfuratus', class: 'Ave frugívora de dosel', status: 'Residente' },
      { name: 'Mono Aullador Negro', latin: 'Alouatta pigra', class: 'Primate arborícola', status: 'En peligro' },
      { name: 'Rana Ojos Rojos', latin: 'Agalychnis callidryas', class: 'Anfibio arborícola', status: 'Común' },
      { name: 'Tapir Centroamericano', latin: 'Tapirus bairdii', class: 'Herbívoro mayor', status: 'Vulnerable' }
    ]
  },
  CLOUD_FOREST: {
    id: 'cloud_forest',
    name: 'Bosque de Niebla / Mesófilo de Montaña',
    climate: 'Templado húmedo de altitud con niebla persistente (1,200 - 2,800 m)',
    canopy: 'Dosel medio-alto exuberante con epifitismo extremo (20 - 30 m)',
    soil: 'Andosoles humíferos de drenaje moderado',
    flora: [
      { name: 'Liquidámbar / Ocozote', latin: 'Liquidambar styraciflua', type: 'Árbol caducifolio relicto', note: 'Especie dominante de niebla' },
      { name: 'Helecho Arbóreo Dicksonia', latin: 'Dicksonia sellowiana', type: 'Helecho fósil viviente', note: 'Estrato intermedio sombrío' },
      { name: 'Magnolia de Niebla', latin: 'Magnolia schiedeana', type: 'Árbol arcaico endémico', note: 'Flores solitarias polinizadas por escarabajos' },
      { name: 'Encino Blanco de Niebla', latin: 'Quercus germana', type: 'Árbol persistente', note: 'Huésped masivo de musgos y bromelias' },
      { name: 'Bromelia de Altura', latin: 'Tillandsia imperialis', type: 'Epífita tanque', note: 'Micro-humedal suspendido' }
    ],
    fauna: [
      { name: 'Quetzal Resplandeciente', latin: 'Pharomachrus mocinno', class: 'Ave de dosel sagrada', status: 'Casi amenazado' },
      { name: 'Puma de Montaña', latin: 'Puma concolor', class: 'Félido territorial', status: 'Común' },
      { name: 'Salamandra de Niebla', latin: 'Pseudoeurycea leprosa', class: 'Anfibio sin pulmones', status: 'Endémico montano' },
      { name: 'Colibrí Cola Hendida', latin: 'Doricha eliza', class: 'Ave nectarívora', status: 'Vulnerable' },
      { name: 'Taira / Comadreja Mayor', latin: 'Eira barbara', class: 'Mustélido ágil', status: 'Residente' }
    ]
  },
  PINE_OAK: {
    id: 'pine_oak',
    name: 'Bosque Templado de Pino y Encino',
    climate: 'Templado subhúmedo de montaña con invierno fresco (1,800 - 3,200 m)',
    canopy: 'Dosel abierto a semi-cerrado de acículas y frondosas (15 - 28 m)',
    soil: 'Regosoles y litosoles derivados de rocas ígneas y volcánicas',
    flora: [
      { name: 'Pino Moctezuma', latin: 'Pinus montezumae', type: 'Conífera de montaña', note: 'Acículas largas en fascículos de 5' },
      { name: 'Encino Laurelillo', latin: 'Quercus laurina', type: 'Árbol esclerófilo perenne', note: 'Madera de alta densidad' },
      { name: 'Madroño Rojo', latin: 'Arbutus xalapensis', type: 'Árbol corteza exfoliante', note: 'Frutos ricos para aves locales' },
      { name: 'Oyamel / Abeto Religioso', latin: 'Abies religiosa', type: 'Conífera de cumbres frías', note: 'Santuario de mariposas migratorias' },
      { name: 'Agave de Montaña', latin: 'Agave salmiana', type: 'Suculenta perenne', note: 'Retención de taludes y suelos' }
    ],
    fauna: [
      { name: 'Mariposa Monarca', latin: 'Danaus plexippus', class: 'Insecto migratorio masivo', status: 'Migratoria estacional' },
      { name: 'Venado Cola Blanca', latin: 'Odocoileus virginianus', class: 'Cérvido herbívoro', status: 'Común' },
      { name: 'Halcón Peregrino', latin: 'Falco peregrinus', class: 'Rapaz de alta velocidad', status: 'Residente / Pasaje' },
      { name: 'Cacomixtle Norteño', latin: 'Bassariscus astutus', class: 'Prociónido trepador nocturno', status: 'Autóctono' },
      { name: 'Zorra Gris', latin: 'Urocyon cinereoargenteus', class: 'Cánido arborícola', status: 'Común' }
    ]
  },
  MEDITERRANEAN: {
    id: 'mediterranean',
    name: 'Bosque y Matorral Mediterráneo (Maquia/Chaparral)',
    climate: 'Veranos cálidos secos e inviernos suaves lluviosos (Csa / Csb)',
    canopy: 'Dosel esclerófilo resistente a la sequía (6 - 15 m)',
    soil: 'Terra rossa calcárea y leptosoles pedregosos',
    flora: [
      { name: 'Encina / Carrasca', latin: 'Quercus ilex', type: 'Árbol esclerófilo perennifolio', note: 'Especie clave de dehesas y montes' },
      { name: 'Alcornoque', latin: 'Quercus suber', type: 'Árbol con corteza de corcho', note: 'Resistente a incendios estacionales' },
      { name: 'Olivo Silvestre / Acebuche', latin: 'Olea europaea var. sylvestris', type: 'Árbol longevo xerófilo', note: 'Bases retorcidas y hojas plateadas' },
      { name: 'Romero Silvestre', latin: 'Salvia rosmarinus', type: 'Arbusto aromático melífero', note: 'Aceites esenciales protectores' },
      { name: 'Madroño Mediterráneo', latin: 'Arbutus unedo', type: 'Arbusto frondoso', note: 'Bayas rojas comestibles en otoño' }
    ],
    fauna: [
      { name: 'Lince Ibérico / Lince', latin: 'Lynx pardinus', class: 'Félido especializado en conejos', status: 'En recuperación' },
      { name: 'Águila Imperial', latin: 'Aquila adalberti', class: 'Gran rapaz endémica', status: 'Vulnerable' },
      { name: 'Jabalí Euroasiático', latin: 'Sus scrofa', class: 'Mamífero omnívoro oportunista', status: 'Abundante' },
      { name: 'Lagarto Ocelado', latin: 'Timon lepidus', class: 'Reptil mayor mediterráneo', status: 'Casi amenazado' },
      { name: 'Búho Real', latin: 'Bubo bubo', class: 'Rapaz nocturna ápice', status: 'Residente' }
    ]
  },
  DECIDUOUS_TEMPERATE: {
    id: 'deciduous_temperate',
    name: 'Bosque Caducifolio Templado',
    climate: 'Cuatro estaciones marcadas con precipitaciones regulares (700 - 1,500 mm)',
    canopy: 'Dosel frondoso denso en verano y abierto en invierno (20 - 35 m)',
    soil: 'Cambisoles pardos ricos en humus y nutrientes',
    flora: [
      { name: 'Roble Común', latin: 'Quercus robur', type: 'Árbol caducifolio majestuoso', note: 'Longevidad superior a 500 años' },
      { name: 'Haya Europea / Haya Americana', latin: 'Fagus sylvatica', type: 'Árbol de sombra densa', note: 'Corteza gris lisa característica' },
      { name: 'Arce Sacarino / Real', latin: 'Acer saccharum', type: 'Árbol caduco de otoño rojizo', note: 'Producción de savia azucarada' },
      { name: 'Fresno Común', latin: 'Fraxinus excelsior', type: 'Árbol ribereño de rápido porte', note: 'Madera flexible de alta resiliencia' },
      { name: 'Castaño Común', latin: 'Castanea sativa', type: 'Árbol frutal forestal', note: 'Semillas envueltas en cúpula espinosa' }
    ],
    fauna: [
      { name: 'Ciervo Común / Wapiti', latin: 'Cervus elaphus', class: 'Herbívoro de bosque denso', status: 'Común' },
      { name: 'Lobo Gris', latin: 'Canis lupus', class: 'Cánido gregario depredador', status: 'Protegido' },
      { name: 'Pájaro Carpintero Negro', latin: 'Dryocopus martius', class: 'Ave perforadora de troncos', status: 'Residente' },
      { name: 'Zorro Rojo', latin: 'Vulpes vulpes', class: 'Cánido versátil adaptable', status: 'Abundante' },
      { name: 'Tejón Europeo / Americano', latin: 'Meles meles', class: 'Mustélido excavador nocturno', status: 'Común' }
    ]
  },
  XEROPHYTIC_DESERT: {
    id: 'xerophytic_desert',
    name: 'Matorral Xerófilo & Semidesierto',
    climate: 'Árido / semiárido con evapotranspiración muy superior a la precipitación (<350 mm)',
    canopy: 'Estrato arbustivo ralo y cactáceas columnares dispersas (1 - 8 m)',
    soil: 'Arenosoles, calcisoles y suelos salinos pedregosos',
    flora: [
      { name: 'Saguaro / Cardón Gigante', latin: 'Carnegiea gigantea', type: 'Cactus columnar centenario', note: 'Almacena hasta 3,000 litros de agua' },
      { name: 'Mezquite Dulce', latin: 'Prosopis velutina', type: 'Leguminosa fijadora de nitrógeno', note: 'Raíces pivotantes de hasta 50m de profundidad' },
      { name: 'Gobernadora / Jarilla', latin: 'Larrea tridentata', type: 'Arbusto aromático clonal', note: 'Produce resinas alelopáticas protectoras' },
      { name: 'Yuca de Joshua Tree', latin: 'Yucca brevifolia', type: 'Monocotiledónea arborescente', note: 'Polinizada exclusivamente por polillas de la yuca' },
      { name: 'Nopal Tunero', latin: 'Opuntia ficus-indica', type: 'Cactácea crasa en cladodios', note: 'Soporte vital de insectos y aves' }
    ],
    fauna: [
      { name: 'Correcaminos Norteño', latin: 'Geococcyx californianus', class: 'Ave corredora veloz', status: 'Común' },
      { name: 'Coyote del Desierto', latin: 'Canis latrans mearnsi', class: 'Cánido resistente al calor', status: 'Abundante' },
      { name: 'Cascabel del Desierto', latin: 'Crotalus cerastes', class: 'Víbora con desplazamiento lateral', status: 'Residente' },
      { name: 'Tortuga del Desierto', latin: 'Gopherus agassizii', class: 'Reptil excavador longevo', status: 'Vulnerable' },
      { name: 'Monstruo de Gila', latin: 'Heloderma suspectum', class: 'Lagarto venenoso fósil', status: 'Protegido' }
    ]
  },
  BOREAL_TAIGA: {
    id: 'boreal_taiga',
    name: 'Taiga Boreal & Bosque de Coníferas',
    climate: 'Subártico frío con inviernos largos y rigurosos (Dfc / Dfd)',
    canopy: 'Dosel de coníferas siempreverdes de agujas finas (12 - 22 m)',
    soil: 'Podzoles ácidos y turberas sobre permafrost discontinuo',
    flora: [
      { name: 'Abeto Negro', latin: 'Picea mariana', type: 'Conífera resistente a heladas extremas', note: 'Pino dominante de bosques de turba' },
      { name: 'Pino Silvestre Boreal', latin: 'Pinus sylvestris', type: 'Conífera perenne esbelta', note: 'Troncos rojizos rectos' },
      { name: 'Alerce Boreal', latin: 'Larix laricina', type: 'Conífera caducifolia', note: 'Pierde sus acículas doradas en invierno' },
      { name: 'Abedul Enano', latin: 'Betula nana', type: 'Arbusto postrado de tundra-taiga', note: 'Resiste vientos gélidos árticos' },
      { name: 'Liquen de los Renos', latin: 'Cladonia rangiferina', type: 'Simbionte liquénico', note: 'Alimento básico de ungulados boreales' }
    ],
    fauna: [
      { name: 'Alce Boreal', latin: 'Alces alces', class: 'El mayor cérvido vivo', status: 'Común' },
      { name: 'Lince Canadiense / Boreal', latin: 'Lynx canadensis', class: 'Félido con patas de raqueta', status: 'Residente' },
      { name: 'Oso Pardo', latin: 'Ursus arctos', class: 'Omnívoro mayor hibernante', status: 'Protegido' },
      { name: 'Glotón / Carcayú', latin: 'Gulo gulo', class: 'Mustélido de tenacidad legendaria', status: 'Casi amenazado' },
      { name: 'Búho Nival / Gran Búho Gris', latin: 'Strix nebulosa', class: 'Rapaz nocturna boreal', status: 'Residente' }
    ]
  },
  ALPINE_PUNA: {
    id: 'alpine_puna',
    name: 'Tundra Alpina, Páramo & Puna',
    climate: 'Frío de alta montaña por encima del límite arbóreo (>3,200 - 4,800 m)',
    canopy: 'Sin árboles; tapiz herbáceo almohadillado y gramíneas duras (0.1 - 1.5 m)',
    soil: 'Litosoles esqueléticos y criosoles sujetos a congelamiento diario',
    flora: [
      { name: 'Frailejón Gigante', latin: 'Espeletia grandiflora', type: 'Composita caulirrosula de páramo', note: 'Hojas vellosas que capturan niebla' },
      { name: 'Paja Brava / Ichu', latin: 'Stipa ichu', type: 'Gramínea dura de altiplano', note: 'Refugio térmico del suelo' },
      { name: 'Yareta Almohadillada', latin: 'Azorella compacta', type: 'Planta en cojín milenaria', note: 'Crecimiento de 1mm al año' },
      { name: 'Queñua / Quenoa', latin: 'Polylepis tarapacana', type: 'Árbol más alto del mundo (hasta 5,200m)', note: 'Corteza laminada aislante' },
      { name: 'Edelweiss / Flor de las Nieves', latin: 'Leontopodium nivale', type: 'Herbácea alpina lanosa', note: 'Pelos reflectores de radiación UV' }
    ],
    fauna: [
      { name: 'Cóndor Andino', latin: 'Vultur gryphus', class: 'Ave voladora de mayor envergadura', status: 'Vulnerable' },
      { name: 'Vicuña Silvestre', latin: 'Vicugna vicugna', class: 'Camélido silvestre de fibra fina', status: 'Protegido' },
      { name: 'Leopardo de las Nieves', latin: 'Panthera uncia', class: 'Félido ápice de alta cordillera', status: 'Vulnerable' },
      { name: 'Vizcacha de la Sierra', latin: 'Lagidium viscacia', class: 'Roedor saltador de roquedales', status: 'Común' },
      { name: 'Cabra Montés / Íbice', latin: 'Capra ibex', class: 'Bóvido escalador extremo', status: 'Residente' }
    ]
  }
};

/**
 * Classifies coordinates into a rich ecosystem/biome profile
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} [elevation=0] - Elevation in meters
 * @param {string} [nameHint=''] - Name of town/place for micro-tuning
 */
export function classifyEcosystem(lat, lon, elevation = 0, nameHint = '') {
  const absLat = Math.abs(lat);
  const text = (nameHint || '').toLowerCase();

  // High elevation override
  if (elevation > 3300) return BIOMES.ALPINE_PUNA;

  // Deserts & Xerophytic zones
  const isDesertRegion =
    (lat >= 16 && lat <= 35 && lon >= -118 && lon <= -100) || // Sonoran/Chihuahuan/Baja
    (lat >= 15 && lat <= 32 && lon >= -15 && lon <= 55) ||    // Sahara & Arabian
    (lat >= -32 && lat <= -18 && lon >= -72 && lon <= -67) || // Atacama
    (lat >= -35 && lat <= -18 && lon >= 115 && lon <= 140) || // Outback Australia
    /desert|desierto|sahara|sonora|nevada|arizona|atacama|cairo|dubai|riyadh|hermosillo/.test(text);

  if (isDesertRegion && elevation < 2200) return BIOMES.XEROPHYTIC_DESERT;

  // Mediterranean zones
  const isMedRegion =
    (lat >= 34 && lat <= 44 && lon >= -10 && lon <= 36) ||   // Mediterranean Basin (Spain, Italy, Greece)
    (lat >= 32 && lat <= 39 && lon >= -124 && lon <= -116) || // Coastal California (SF, LA, San Diego)
    (lat >= -36 && lat <= -31 && lon >= -73 && lon <= -70) || // Central Chile (Santiago, Valparaíso)
    (lat >= -35 && lat <= -31 && lon >= 18 && lon <= 25) ||   // Cape Province South Africa
    /madrid|barcelona|valencia|roma|rome|athens|atenas|lisboa|lisbon|california|los angeles|san francisco|santiago/.test(text);

  if (isMedRegion && elevation < 1800) return BIOMES.MEDITERRANEAN;

  // Cold Boreal Taiga
  if (lat >= 55) return BIOMES.BOREAL_TAIGA;

  // Tropical vs Temperate by latitude & elevation
  if (absLat < 23.5) {
    // Within Tropics
    if (elevation >= 1800) return BIOMES.PINE_OAK;
    if (elevation >= 1100 && elevation < 1800) return BIOMES.CLOUD_FOREST;
    return BIOMES.TROPICAL_RAINFOREST;
  }

  // Subtropics & Montane (e.g. Mexico plateau, Southern US, Subtropical Asia)
  if (absLat >= 23.5 && absLat <= 32) {
    if (elevation >= 1600) return BIOMES.PINE_OAK;
    if (elevation >= 900) return BIOMES.CLOUD_FOREST;
  }

  // Temperate zones (32° to 55°)
  if (elevation >= 1700) return BIOMES.PINE_OAK;
  return BIOMES.DECIDUOUS_TEMPERATE;
}
