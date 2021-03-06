import { loadModules, loadCss } from 'esri-loader';

// Object to handle module level variables
const app = {};

// Symbol Markers for Trail Heads
const trailheadRenderer = {
  type: 'simple',
  symbol: {
    type: 'web-style',
    name: 'trail',
    styleName: 'Esri2DPointSymbolsStyle',
  },
};
const trailSym = {
  type: 'cim',
  // CIM Line Symbol
  data: {
    type: 'CIMSymbolReference',
    symbol: {
      type: 'CIMLineSymbol',
      symbolLayers: [
        {
          // white dashed layer at center of the line
          type: 'CIMSolidStroke',
          effects: [
            {
              type: 'CIMGeometricEffectDashes',
              dashTemplate: [2, 2, 2, 2], // width of dashes and spacing between the dashes
              lineDashEnding: 'NoConstraint',
              controlPointEnding: 'NoConstraint',
            },
          ],
          enable: 'true', // must be set to true in order for the symbol layer to be visible
          capStyle: 'Butt',
          joinStyle: 'Round',
          width: 1,
          color: [255, 255, 255, 255],
        },
        {
          // lighter green line layer that surrounds the dashes
          type: 'CIMSolidStroke',
          enable: 'true',
          capStyle: 'Butt',
          joinStyle: 'Round',
          width: 3,
          color: [56, 168, 0, 255],
        },
        {
          // darker green outline around the line symbol
          type: 'CIMSolidStroke',
          enable: true,
          capStyle: 'Butt',
          joinStyle: 'Round',
          width: 6,
          color: [0, 115, 76, 255],
        },
      ],
    },
  },
};

/**
 * Initialize the WebMap used in the application
 * @returns Promise<`esri/WebMap`>
 */
export async function initWebMap() {
  const [
    WebMap,
    Bookmark,
    ElevationLayer,
    FeatureLayer,
    GraphicsLayer,
    TileLayer,
    GroupLayer,
  ] = await loadModules([
    'esri/WebMap',
    'esri/webmap/Bookmark',
    'esri/layers/ElevationLayer',
    'esri/layers/FeatureLayer',
    'esri/layers/GraphicsLayer',
    'esri/layers/TileLayer',
    'esri/layers/GroupLayer',
  ]);

  const notesLayer = new FeatureLayer({
    portalItem: {
      id: '1327d21d42934da3b7df7454d001c2bb',
    },
  });

  // Parse locally saved bookmarks
  const bookmarksLocal =
    JSON.parse(localStorage.getItem('trail-bookmarks')) || [];

  const webmap = new WebMap({
    portalItem: {
      id: '8744e84b32e74bffb34b0b1edf0c3d60',
    },
    bookmarks: bookmarksLocal.map((a) => Bookmark.fromJSON(a)),
  });

  const elevationLayer = new ElevationLayer({
    url:
      'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer/',
  });

  await elevationLayer.load();
  await notesLayer.load();

  const trailLayer = new GraphicsLayer({ id: 'trail' });

  const terrainLayer = new TileLayer({
    blendMode: 'source-in',
    portalItem: {
      id: '99cd5fbd98934028802b4f797c4b1732',
    },
    opacity: 1,
  });

  const groupLayer = new GroupLayer({
    id: 'group',
    layers: [trailLayer, terrainLayer],
  });

  webmap.add(groupLayer);

  app.elevationLayer = elevationLayer;
  app.notesLayer = notesLayer;
  app.webmap = webmap;

  await webmap.load();

  // hiking trails
  const hikingLayer = app.webmap.layers.getItemAt(1); // could be better
  await hikingLayer.load();

  hikingLayer.popupTemplate.content = async ({ graphic }) => {
    const trailId = graphic.attributes.FID;
    const query = hikingLayer.createQuery();
    query.where`TrailId = ${trailId}`;
    const { features } = await hikingLayer
      .queryFeatures(query)
      .catch((err) => console.warn(err.message));
    let notes = `<p>No notes available</p>`;
    const content = `<strong>{name}</strong> is a trail with <strong>{surface}</strong> surface. It is managed by <strong>{manager}</strong>.`;
    if (features && features.length) {
      const list = features.map(
        (feature) => `<li>${feature.attributes.Note}</li>`
      );
      return `
        ${content}
        <hr />
        ${list}
      `;
    } else {
      return `
        ${content}
        <hr />
        ${notes}
      `;
    }
  };
  // TrailHeads layer
  const layer = webmap.findLayerById('17275f72a2b-layer-0');
  await layer.load();

  layer.popupTemplate.actions = layer.popupTemplate.actions || [];
  layer.popupTemplate.actions.push({
    id: 'fetch-directions',
    title: 'Directions',
    className: 'esri-icon-directions',
  });
  layer.visible = true;

  return webmap;
}

/**
 * Creates and Search widget
 * @param {HTMLElement} container 
 * @param {MapView} view 
 * @returns Promise<`esri/widgets/Search`>
 */
export async function addSearch(container, view) {
  loadCss();
  const [Search, Locator] = await loadModules([
    'esri/widgets/Search',
    'esri/tasks/Locator',
  ]);

  return new Search({
    view,
    includeDefaultSources: false,
    sources: [
      {
        locator: new Locator({
          url:
            'https://utility.arcgis.com/usrsvcs/servers/b34c620191be4b6f9c25576a9758bfdb/rest/services/World/GeocodeServer',
        }),
        singleLineFieldName: 'SingleLine',
        name: 'Colorado Search',
        placeholder: 'Search Colorado',
        maxResults: 3,
        maxSuggestions: 6,
        minSuggestCharacters: 0,
      },
    ],
    container,
  });
}

/**
 * Initialize the MapView for the application
 * @param {HTMLElement} container 
 * @param {HTMLElement} searchContainer
 * @returns Promise<void>
 */
export async function initView(container, searchContainer) {
  loadCss();
  const [
    Graphic,
    MapView,
    BasemapToggle,
    Bookmarks,
    Directions,
    Expand,
  ] = await loadModules([
    'esri/Graphic',
    'esri/views/MapView',
    'esri/widgets/BasemapToggle',
    'esri/widgets/Bookmarks',
    'esri/widgets/Directions',
    'esri/widgets/Expand',
  ]);

  const view = new MapView({
    map: app.webmap,
    container,
  });

  const toggle = new BasemapToggle({ view, nextBasemap: 'hybrid' });

  const bookmarks = new Bookmarks({
    view: view,
    editingEnabled: true,
    bookmarkCreationOptions: {
      takeScreenshot: true,
      captureExtent: true,
      screenshotSettings: {
        width: 100,
        height: 100,
      },
    },
  });

  const bookmarksExpand = new Expand({
    content: bookmarks,
  });

  view.ui.add(toggle, 'bottom-right');
  view.ui.add(bookmarksExpand, 'top-right');

  app.view = view;

  app.view.popup.actions.add({
    id: 'query-elevation',
    title: 'Elevation',
  });

  app.view.when(() => {
    // set up bookmarks
    bookmarks.bookmarks.on('change', ({ added }) => {
      // Save bookmarks to local storage
      const bookmarksJson = added.map((x) => x.toJSON());
      let bookmarkStored =
        JSON.parse(localStorage.getItem('trail-bookmarks')) || [];
      localStorage.removeItem('trail-bookmarks');
      bookmarkStored = bookmarkStored.concat(bookmarksJson);
      localStorage.setItem('trail-bookmarks', JSON.stringify(bookmarkStored));
    });

    addSearch(searchContainer, view);

    const directions = new Directions({
      routeServiceUrl:
        'https://utility.arcgis.com/usrsvcs/servers/b34c620191be4b6f9c25576a9758bfdb/rest/services/World/GeocodeServer',
      view: view,
    });

    const directionsExpand = new Expand({
      content: directions,
    });

    view.ui.move('zoom', 'top-right');

    view.ui.add(directionsExpand, 'top-right');

    app.directions = directions;

    directions.viewModel.stops.on('change', (changes) => console.log(changes));
  });

  app.view.popup.on('trigger-action', ({ action }) => {
    if (action.id === 'query-elevation') {
      const { selectedFeature } = app.view.popup;
      app.elevationLayer
        .queryElevation(selectedFeature.geometry)
        .then((result) => {
          console.log('elevation result', result);
          console.log(calculateAltitudeGainLoss(result.geometry.paths));
        });
    }
    if (action.id === 'fetch-directions') {
      app.directions.viewModel.stops.addMany([
        new Graphic({
          attributes: {},
          geometry: {
            type: 'point',
            longitude: -104.9903,
            latitude: 39.7392,
          },
        }),
        new Graphic({
          attributes: {},
          geometry: app.view.popup.selectedFeature.geometry.clone(),
        }),
      ]);
      app.directions.viewModel.load().then(() => {
        app.directions.getDirections();
      });
    }
  });

  return view;
}

/**
 * Calculate the Altitude Gain and Loss
 * @param {Number[]} paths
 * @returns { gain: Number, loss: Number }
 */
const calculateAltitudeGainLoss = (paths) => {
  let gain = 0;
  let loss = 0;
  console.log('paths ', paths);
  for (let i = 0; i < paths[0].length - 1; i++) {
    const diff = paths[0][i][2] - paths[0][i + 1][2];
    if (Math.sign(diff) == 1) {
      gain += diff;
    } else {
      loss += diff;
    }
  }
  return {
    gain: gain,
    loss: loss,
  };
};

/**
 * Creates a renderer using a given Arcade Expression
 * @param {String} exp
 * @returns `esri/renderer/UniqueValueRenderer`
 */
const applyTrailRenderer = (exp) => {
  const renderer = {
    type: 'unique-value',
    valueExpression: exp,
    uniqueValueInfos: [
      {
        value: true,
        symbol: trailSym,
        label: 'cim',
      },
    ],
  };
  return renderer;
};

/**
 * Finds the maximum elevation for a layer
 * @returns Promise<Number>
 */
export async function fetchMaxElevation() {
  if (!app.webmap) {
    return;
  }
  const maxStat = {
    statisticType: 'max',
    onStatisticField: 'max_elevat',
    outStatisticFieldName: 'Max_Elevation',
  };
  const layer = app.webmap.layers.getItemAt(1); // could be better

  await layer.load();
  const query = layer.createQuery();
  query.where = '1=1';
  query.outStatistics = [maxStat];
  const results = await layer.queryFeatures(query);
  const elev = results.features[0].attributes['Max_Elevation'];
  return elev;
}

/**
 * 
 * @param {{ min: Number, max: Number }}} elevation 
 * @param {{ dog: String, bike: String, hore: String }} attributes
 * @returns Promise<{ features: `esri/Graphic` }>
 */
export async function fetchTrails(elevation, { dogs, bike, horse }) {
  const [min, max] = elevation;
  if (!app.webmap) return;
  await app.webmap.load();
  const layer = app.webmap.layers.getItemAt(1); // could be better
  layer.outFields = ['name', 'name_1'];
  await layer.load();
  const query = layer.createQuery();
  query.returnDistinct = true;
  query.outFields = ['*'];
  query.where = `(min_elevat > ${min} AND max_elevat < ${max}) AND ${
    dogs ? "(dogs <> 'no' AND dogs <> ' ')" : "(dogs = 'no' OR dogs = ' ')"
  } AND ${
    bike ? "(bike <> 'no'  AND bike <> ' ')" : "(bike = 'no' OR bike = ' ')"
  } AND ${
    horse
      ? "(horse <> 'no'  AND horse <> ' ')"
      : "(horse = 'no' OR horse = ' ')"
  }`;
  const { features } = await layer.queryFeatures(query);
  return { features };
}

/**
 * Filters map based on Feature Ids
 * @param {String[]} ids 
 * @returns Promise<void>
 */
export async function filterMapData(ids) {
  if (!app.webmap) return;
  const [{ whenFalseOnce }, geometryEngine] = await loadModules([
    'esri/core/watchUtils',
    'esri/geometry/geometryEngine',
  ]);

  const where = `FID in (${ids.join(",")})`;

  await app.webmap.load();
  const layer = app.webmap.layers.getItemAt(1); // could be better
  layer.outFields = ['*'];
  await layer.load();
  await app.view.when();
  const layerView = await app.view
    .whenLayerView(layer)
    .catch((err) => console.log(err.message));
  if (!layerView) return;

  await whenFalseOnce(layerView, 'updating');
  const query = layer.createQuery();
  query.where = where;
  const { features } = await layer.queryFeatures(query);

  const ids = await layer.queryObjectIds(query.clone());
  const arcade =
    `
     if(indexof([` +
    ids +
    `], $feature.FID) != -1){
      return true;
    }
    else {
      return false;
    } 
  `;

  const renderer = applyTrailRenderer(arcade);
  layer.renderer = renderer;

  const groupLayer = app.webmap.findLayerById('group');
  const trailLayer = app.webmap.findLayerById('trail');
  const trailHeadsLayer = app.webmap.layers.getItemAt(3); // figure out Id?
  trailHeadsLayer.renderer = trailheadRenderer;

  const geometry = geometryEngine.union(
    geometryEngine.buffer(
      features.map((x) => x.geometry),
      1,
      'miles'
    )
  );

  trailLayer.removeAll();

  trailLayer.add({
    attributes: {},
    geometry,
    symbol: {
      type: 'simple-fill',
      outline: { color: [255, 255, 255, 1] },
      color: [255, 255, 255, 0.5],
    },
  });

  groupLayer.visible = true;
  app.webmap.basemap.visible = false;
  await app.view.goTo(geometry);
  layerView.effect = {
    filter: {
      where,
    },
    excludedEffect: 'grayscale(25%) opacity(35%)',
  };
}
