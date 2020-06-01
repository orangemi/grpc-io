
import * as grpc from '@grpc/grpc-js'
import { Readable as IReadable } from 'stream'
export interface Metadata {[x: string]: string}

interface ObjectStream<T> extends NodeJS.ReadWriteStream {
  read(size?: number): any & T;
}

interface ReadableObjectStream<T> extends NodeJS.ReadableStream {
  // readable: boolean;
  read(size?: number): any & T;
  // read(size?: number): T;
  // setEncoding(encoding: string): this;
  // pause(): this;
  // resume(): this;
  // isPaused(): boolean;
  // pipe<T extends WritableStream>(destination: T, options?: { end?: boolean; }): T;
  // unpipe(destination?: OT2 extends ObjectStream): this;
  // unshift(chunk: string | Uint8Array, encoding?: BufferEncoding): void;
  // wrap(oldStream: ReadableStream): this;
  [Symbol.asyncIterator](): AsyncIterableIterator<T>;
}

const ttt = {} as ReadableObjectStream<Point>
for await (const ttt2 of ttt) {
  ttt2
}

export interface RouteGuide {
  GetFeature(req: Point, meta?: Metadata, call?: grpc.ServerUnaryCall<any, any>): Promise<Feature>
  ListFeatures(req: Rectangle, meta?: Metadata, call?: grpc.ServerUnaryCall<any, any>): Promise<Readable<Feature>>
  RecordRoute(req: Readable<Point>, meta?: Metadata, call?: grpc.ServerUnaryCall<any, any>): Promise<RouteSummary>
  RouteChat(req: Readable<RouteNote>, meta?: Metadata, call?: grpc.ServerUnaryCall<any, any>): Promise<Readable<RouteNote>>
}

export interface Point {
  latitude: number
  longitude: number
}

export interface Rectangle {
  lo: Point
  hi: Point
}

export interface Feature {
  name: string
  location: Point
}

export interface RouteNote {
  location: Point
  message: string
}

export interface RouteSummary {
  pointCount: number
  featureCount: number
  distance: number
  elapsedTime: number
}
