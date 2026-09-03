// Global GeoJSON type definitions for MapLibre & DeckGL
declare namespace GeoJSON {
  export type GeoJsonGeometryTypes =
    | "Point"
    | "LineString"
    | "Polygon"
    | "MultiPoint"
    | "MultiLineString"
    | "MultiPolygon"
    | "GeometryCollection";

  export type GeoJsonTypes =
    | GeoJsonGeometryTypes
    | "Feature"
    | "FeatureCollection";

  export type Position = number[];

  export interface DirectGeometryObject {
    type: GeoJsonGeometryTypes;
    coordinates?: any;
    geometries?: any[];
  }

  export interface Geometry {
    type: GeoJsonGeometryTypes;
    coordinates?: any;
    geometries?: any[];
  }

  export interface Point extends Geometry {
    type: "Point";
    coordinates: Position;
  }

  export interface MultiPoint extends Geometry {
    type: "MultiPoint";
    coordinates: Position[];
  }

  export interface LineString extends Geometry {
    type: "LineString";
    coordinates: Position[];
  }

  export interface MultiLineString extends Geometry {
    type: "MultiLineString";
    coordinates: Position[][];
  }

  export interface Polygon extends Geometry {
    type: "Polygon";
    coordinates: Position[][];
  }

  export interface MultiPolygon extends Geometry {
    type: "MultiPolygon";
    coordinates: Position[][][];
  }

  export interface Feature<G = Geometry, P = Record<string, any>> {
    type: "Feature";
    geometry: G;
    id?: string | number;
    properties: P;
  }

  export interface FeatureCollection<G = Geometry, P = Record<string, any>> {
    type: "FeatureCollection";
    features: Array<Feature<G, P>>;
  }
}
