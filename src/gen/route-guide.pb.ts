import * as grpc from '@grpc/grpc-js'
import * as protoLoader from "@grpc/proto-loader"
import * as pbjs from "protobufjs"
import * as goog from "google-protobuf"
import { ServiceDefinition } from '@grpc/grpc-js/build/src/make-client'

export namespace GrpcTypescript {
  export interface ServerService {

  }

  export interface Stream<T extends Message> {
    next(): Promise<T>
    cancel(): any
  }

  export class StreamReader<T extends Message> implements Stream<T> {
    call
    isEnded = false

    get request() { return this.call }

    constructor(call) {
      this.call = call
      this.call.once('end', () => { this.isEnded = true })
    }

    async next(): Promise<T> {
      if (this.isEnded) return null
      const result: T = await new Promise(resolve => this.call.once('data', resolve))
      return result
    }
    cancel() {
      this.isEnded = true
    }
  }

  export class BaseRequest<T extends Message> {

  }

  export class BaseResponse<T extends Message> {

  }

  export interface StreamResponse<T extends Message> {
    next(): Promise<T>
    cancel(): any
  }

  export class UnaryRequest<T extends Message> extends BaseRequest<T> {

  }

  export class UnaryResponse<T extends Message> extends BaseResponse<T> {
    
  }

  export class StreamRequest<T extends Message> extends BaseRequest<T> {
    
  }

  export class Client {

  }

  export class Server {
    wrapUU(fn: UnaryUnaryRequest<any, any>) {
      return function (call, callback) {
        fn(call.request).then(data => {
          callback(null, data)
        }, err => {
          callback(err, null)
        })
      }
    }
    wrapUS(fn: UnaryStreamRequest<any, any>) {
      return function (call) {
        fn(call.request).then(async resp => {
          try {
            while (true) {
              const result = await resp.next()
              if (result) call.write(result)
              else break
            }
          } catch (e) {
            console.error(e)
          }
          call.end()
        })
      }
    }
    wrapSU(fn: StreamUnaryRequest<any, any>) {
      return function (call, callback) {
        const reader = new GrpcTypescript.StreamReader(call)
        fn(reader).then(result => {
          callback(null, result)
        }, err => {
          callback(err)
        })
      }
    }
    wrapSS(fn: StreamStreamRequest<any, any>) {
      return function (call) {
        const reader = new GrpcTypescript.StreamReader(call)
        fn(reader).then(async resp => {
          try {
            while (true) {
              const result = await resp.next()
              if (result) call.write(result)
              else break
            }
          } catch (e) {
            console.error(e)
          }
          call.end()
        })
      }
    }
  }

  // export class StreamResponse<T extends Message> extends BaseResponse<T> {
  //   emit(data: T) {

  //   }
  // }


  export abstract class Message {
    abstract readonly typeDefinition: any

    getDef() {
      return pbjs.Type.fromJSON(this.constructor.name, this.typeDefinition)
    }
    // abstract serializeBinaryToWriter(writer: goog.BinaryWriter);
  }

  export interface RequestOptions {

  }

  export interface UnaryUnaryRequest<ReqT extends GrpcTypescript.Message, RespT extends GrpcTypescript.Message> {
    (req: ReqT, options?: GrpcTypescript.RequestOptions): Promise<RespT>
  }
  export interface UnaryStreamRequest<ReqT extends GrpcTypescript.Message, RespT extends GrpcTypescript.Message> {
    (req: ReqT, options?: GrpcTypescript.RequestOptions): Promise<GrpcTypescript.Stream<RespT>>
  }
  export interface StreamUnaryRequest<ReqT extends GrpcTypescript.Message, RespT extends GrpcTypescript.Message> {
    (req: GrpcTypescript.Stream<ReqT>, options?: GrpcTypescript.RequestOptions): Promise<RespT>
  }
  export interface StreamStreamRequest<ReqT extends GrpcTypescript.Message, RespT extends GrpcTypescript.Message> {
    (req: GrpcTypescript.Stream<ReqT>, options?: GrpcTypescript.RequestOptions): Promise<GrpcTypescript.Stream<RespT>>
  }

}

// generated
export namespace routeguide {

  export class Point extends GrpcTypescript.Message {
    latitude: number // maybe setter getter?
    longitude: number

    get typeDefinition() {
      return {
        fields: {
          latitude: {
            type: 'int32',
            id: 1
          },
          longitude: {
            type: 'int32',
            id: 2,
          }
        }
      }
    }
  }
  export class Feature extends GrpcTypescript.Message {
    name: string
    location: Point
  }
  export class Rectangle extends GrpcTypescript.Message {
    lo: Point
    hi: Point
  }
  export class RouteSummary extends GrpcTypescript.Message {
    pointCount: number
    featureCount: number
    distance: number
    elapsedTime: number
  }
  export class RouteNote extends GrpcTypescript.Message {
    location: Point
    message: string
  }

  export interface RouteGuideServerService extends GrpcTypescript.ServerService {
    GetFeature: GrpcTypescript.UnaryUnaryRequest<Point, Feature>
    ListFeature: GrpcTypescript.UnaryStreamRequest<Rectangle, Feature>
    RecordRoute: GrpcTypescript.StreamUnaryRequest<Point, RouteSummary>
    RouteChat: GrpcTypescript.StreamStreamRequest<RouteNote, RouteNote>
  }

  export abstract class RouteGuideService implements RouteGuideServerService {
    get service(): ServiceDefinition {
      return {
        GetFeature: {
          path: '',
          requestStream: false,
          responseStream: false,
          // requestSerialize: 
          responseSerialize: (point: object) => {
            const type = Point.prototype.getDef()
            return type.encode(type.fromObject(point)).finish() as Buffer
          }
        }
      }
    }
    abstract GetFeature(point: Point): Promise<Feature>;
    abstract ListFeature(rectangle: Rectangle): Promise<GrpcTypescript.Stream<Feature>>;
    abstract RecordRoute(pointReader: GrpcTypescript.Stream<Point>): Promise<RouteSummary>;
    abstract RouteChat(routeNoteReader: GrpcTypescript.Stream<RouteNote>): Promise<GrpcTypescript.Stream<RouteNote>>;
  }

  export class RouteGuideServiceClient implements RouteGuideServerService {
    GetFeature(point: Point): Promise<Feature> {}
    ListFeature(rectangle: Rectangle): Promise<GrpcTypescript.Stream<Feature>> {}
    RecordRoute(pointReader: GrpcTypescript.Stream<Point>): Promise<RouteSummary> {}
    RouteChat(routeNoteReader: GrpcTypescript.Stream<RouteNote>): Promise<GrpcTypescript.Stream<RouteNote>> {}

  }
}

// DEBUG use
class MyRouteGuideService extends routeguide.RouteGuideService {
  GetFeature(point: routeguide.Point): Promise<routeguide.Feature> {
    throw new Error("Method not implemented.");
  }
  ListFeature(rectangle: routeguide.Rectangle): Promise<GrpcTypescript.Stream<routeguide.Feature>> {
    throw new Error("Method not implemented.");
  }
  RecordRoute(pointReader: GrpcTypescript.Stream<routeguide.Point>): Promise<routeguide.RouteSummary> {
    throw new Error("Method not implemented.");
  }
  RouteChat(routeNoteReader: GrpcTypescript.Stream<routeguide.RouteNote>): Promise<GrpcTypescript.Stream<routeguide.RouteNote>> {
    throw new Error("Method not implemented.");
  }
}

const myService = new MyRouteGuideService()
const server = new grpc.Server()
server.addService(myService.service, serviceImplObj)
