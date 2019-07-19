import * as grpc from './grpc'

export interface Point {
  longitude?: number
  latitude?: number
}

export interface Feature {
  name?: string
}

export interface Rectangle {
  lo?: Point
  hi?: Point
}

export interface RouteSummary {
  point_count?: number
  feature_count?: number
}

export interface RouteNote {
  location?: Point
  message?: string
}

export interface RouteGuideClient {
  GetFeature: grpc.UnaryUnaryRequest<Point, Feature>
  ListFeatures: grpc.UnaryStreamRequest<Rectangle, Feature>
  RecordRoute: grpc.StreamUnaryRequest<Point, RouteSummary>
  RouteChat: grpc.StreamStreamRequest<RouteNote, RouteNote>
}
