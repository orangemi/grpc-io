import * as grpc from '@grpc/grpc-js'
// import * as grpc from 'grpc'
import * as protoLoader from "@grpc/proto-loader"
import { ServiceClientConstructor, ServiceClient } from '@grpc/grpc-js/build/src/make-client'

export interface RequestOptions {
}

export interface Stream<T = any> {
  next(): Promise<T>
  cancel(): any
}

export class StreamReader<T> implements Stream<T> {
  call: any
  isEnded = false
  error = null

  get request() { return this.call }

  constructor(call) {
    this.call = call
    this.call.once('end', () => { this.isEnded = true })
    this.call.once('error', (error) => {
      this.isEnded = true
      this.error = error
    })
  }

  async next(): Promise<T> {
    if (this.error) throw this.error
    if (this.isEnded) return null
    const result: T = await new Promise(resolve => this.call.once('data', resolve))
    return result
  }
  cancel() {
    this.isEnded = true
  }
}


export interface UnaryUnaryRequest<ReqT = any, RespT = any> {
  (req: ReqT, options?: RequestOptions): Promise<RespT>
}
export interface UnaryStreamRequest<ReqT = any, RespT = any> {
  (req: ReqT, options?: RequestOptions): Promise<Stream<RespT>>
}
export interface StreamUnaryRequest<ReqT = any, RespT = any> {
  (req: Stream<ReqT>, options?: RequestOptions): Promise<RespT>
}
export interface StreamStreamRequest<ReqT = any, RespT = any> {
  (req: Stream<ReqT>, options?: RequestOptions): Promise<Stream<RespT>>
}

type GrpcRequestHandler = UnaryUnaryRequest | UnaryStreamRequest | StreamUnaryRequest | StreamStreamRequest

export class GrpcServerBuilder {
  private serviceImplObj: any = {}
  private protoFilePath: string
  private packageName: string
  private serviceName: string

  service(protofilePath: string, packageName: string, serviceName: string) {
    this.protoFilePath = protofilePath
    this.packageName = packageName
    this.serviceName = serviceName
    return this
  }

  private async buildService() {
    const protofile = await protoLoader.load(this.protoFilePath)
    const pkgDef = grpc.loadPackageDefinition(protofile)
    const Service = pkgDef[this.packageName][this.serviceName] as ServiceClientConstructor
    return Service
  }

  async build() {
    const Service = await this.buildService()
    const server = new grpc.Server()
    server.addService(Service.service, this.serviceImplObj)
    return new GrpcServer(server)
  }

  uu<ReqT = any, RespT = any>(methodName: string, fn: UnaryUnaryRequest<ReqT, RespT>) {
    return this.add(methodName, this.wrapUU(fn))
  }
  us<ReqT = any, RespT = any>(methodName: string, fn: UnaryStreamRequest<ReqT, RespT>) {
    return this.add(methodName, this.wrapUS(fn))
  }
  su<ReqT = any, RespT = any>(methodName: string, fn: StreamUnaryRequest<ReqT, RespT>) {
    return this.add(methodName, this.wrapSU(fn))
  }
  ss<ReqT = any, RespT = any>(methodName: string, fn: StreamStreamRequest<ReqT, RespT>) {
    return this.add(methodName, this.wrapSS(fn))
  }
  
  private add(methodName: string, fn: Function) {
    this.serviceImplObj[methodName] = fn
    return this
  }
  private wrapUU(fn: UnaryUnaryRequest<any, any>) {
    return function (call, callback) {
      fn(call.request).then(data => {
        callback(null, data)
      }, err => {
        callback(err, null)
      })
    }
  }
  private wrapUS(fn: UnaryStreamRequest<any, any>) {
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
  private wrapSU(fn: StreamUnaryRequest<any, any>) {
    return function (call, callback) {
      const reader = new StreamReader(call)
      fn(reader).then(result => {
        callback(null, result)
      }, err => {
        callback(err)
      })
    }
  }
  private wrapSS(fn: StreamStreamRequest<any, any>) {
    return function (call) {
      const reader = new StreamReader(call)
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

export class GrpcServer {
  private server: grpc.Server
  constructor(server: grpc.Server) {
    this.server = server
  }
  async close(force = false) {
    if (!force) {
      try {
        await new Promise((resolve, reject) => {
          this.server.tryShutdown((err?) => err ? reject(err) : resolve())
        })
        return
      } catch (e) {
        console.error(new Error('gRPC server try to shutdown but failed: ' + e.message))
      }
    }
    this.server.forceShutdown()
  }
  async listen(addr: string, credentials: grpc.ServerCredentials = grpc.ServerCredentials.createInsecure()): Promise<any> {
    return new Promise((resolve, reject) => {
      this.server.bindAsync(addr, credentials, (err, port) => {
        if (err) return reject(err)
        this.server.start()
        return resolve(port)
      })
    })
  }
}

export class GrpcClient {
  addr: string
  credentials: grpc.ChannelCredentials
  serviceClient: ServiceClient

  constructor(addr: string, credentials: grpc.ChannelCredentials = grpc.credentials.createInsecure()) {
    this.addr = addr
    this.credentials = credentials
  }

  async build<T = any>(protofilePath, packageName, serviceName) {
    const protofile = await protoLoader.load(protofilePath)
    const pkgDef = grpc.loadPackageDefinition(protofile)
    const Service = pkgDef[packageName][serviceName] as ServiceClientConstructor

    this.serviceClient = new Service(this.addr, this.credentials)
    const client: any = {}
    Object.keys(Service.service).forEach(methodName => {
      const serviceDef = Service.service[methodName]
      if (!serviceDef.requestStream && !serviceDef.responseStream) {
        client[methodName] = this.wrapUnaryUnaryRequest(methodName)
      } else if (!serviceDef.requestStream && serviceDef.responseStream) {
        client[methodName] = this.wrapUnaryStreamRequest(methodName)
      } else if (serviceDef.requestStream && !serviceDef.responseStream) {
        client[methodName] = this.wrapUnaryUnaryRequest(methodName)
      } else if (serviceDef.requestStream && serviceDef.responseStream) {
        client[methodName] = this.wrapUnaryUnaryRequest(methodName)
      }
    })
    return client as T
  }

  wrapUnaryUnaryRequest<ReqT = any, RespT = any>(method: string): UnaryUnaryRequest<ReqT, RespT> {
    const serviceClient = this.serviceClient
    return function uuRequest(req: ReqT, meta?: grpc.Metadata, options?: grpc.CallOptions) {
      const args = arguments
      return new Promise<RespT>((resolve, reject) => {
        serviceClient[method](...args, (err, resp) => err ? reject(err) : resolve(resp))
      })
    }
  }

  wrapUnaryStreamRequest<ReqT = any, RespT = any>(method: string): UnaryStreamRequest<ReqT, RespT> {
    const serviceClient = this.serviceClient
    return function usRequst(req: ReqT, meta?: grpc.Metadata, options?: grpc.CallOptions) {
      const args = arguments
      return new Promise((resolve, reject) => {
        const resp = serviceClient[method](...args)
        resp.on('error', e => console.error('resp err', e))
        resp.on('status', s => console.error('resp status', s))
        const reader = new StreamReader<RespT>(resp)
        return resolve(reader)
      })
    }
  }
}

export class ServiceImplBuilder {
  methods: {[x: string]: GrpcRequestHandler} = {}
  uu<ReqT = any, RespT = any>(methodName: string, fn: UnaryUnaryRequest<ReqT, RespT>) {
    return this.add(methodName, fn)
  }
  us<ReqT = any, RespT = any>(methodName: string, fn: UnaryUnaryRequest<ReqT, RespT>) {
    return this.add(methodName, fn)
  }
  su<ReqT = any, RespT = any>(methodName: string, fn: UnaryUnaryRequest<ReqT, RespT>) {
    return this.add(methodName, fn)
  }
  ss<ReqT = any, RespT = any>(methodName: string, fn: UnaryUnaryRequest<ReqT, RespT>) {
    return this.add(methodName, fn)
  }
  private add(methodName: string, fn: GrpcRequestHandler) {
    this.methods[methodName] = fn
  }
  build(): {[x: string]: GrpcRequestHandler} {
    return Object.assign({}, this.methods)
  }
}

// debug
async function main() {
  const server = await new GrpcServerBuilder()
    .service('protos/route-guide.proto', 'routeguide', 'RouteGuide')
    .uu('GetFeature', async (req) => {
      return {name: "hello world"}
    })
    .us('ListFeatures', async (req) => {
      // await new Promise(resolve => setTimeout(resolve, 2000))
      let t = 5
      return {
        async next() {
          if (t-- <= 0) return null
          // await new Promise(resolve => setTimeout(resolve, 500))
          return {name: 't ' + t}
        },
        cancel() {}
      }
    })
    .su('Chat', async (reader) => {
      const t = await reader.next()
    })
    .build()
  // await server.use(, new RouteGuideServiceImpl() as any)
  const p = await server.listen('127.0.0.1:5009')

  const clientBuilder = new GrpcClient('127.0.0.1:5009')
  const client = await clientBuilder.build('protos/route-guide.proto', 'routeguide', 'RouteGuide')
  const point = {latitude: 409146138, longitude: -746188906};

  const resp1 = await client.GetFeature(point)
  console.log('resp1', resp1)

  const resp2: Stream = await client.ListFeatures({})
  while (true) {
    const t = await resp2.next()
    if (!t) break
    console.log('resp', t)
  }
  await server.close(true)
}

main().catch(e => {
  console.error(e.message, e)
})
