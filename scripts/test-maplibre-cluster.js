// Test script for MapLibre clusterProperties
try {
  const maplibregl = require("maplibre-gl");
  console.log("MapLibre version:", maplibregl.version);
} catch (e) {
  console.log("Error:", e.message);
}
