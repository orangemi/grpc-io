import { Readable } from 'stream'
import * as grpc from 'grpc'
import * as protoLoader from "@grpc/proto-loader"
import { EventEmitter } from 'events'

export interface ServiceClientConstructor<T = any> {
  new(address: string, credentials: grpc.ChannelCredentials, options?: any): ServiceClient
  service: grpc.ServiceDefinition<T>
}

interface ServiceClient {
  [x: string]: Function
}

export interface RequestOptions {
}

export interface Stream<T = any> extends Readable {
  [Symbol.asyncIterator](): AsyncIterableIterator<T>
  cancel?(): any
}

export interface UnaryRequest<ReqT = any, RespT = any> {
  (req: ReqT, options?: grpc.Metadata): Promise<RespT>
}
export interface ServerStreamRequest<ReqT = any, RespT = any> {
  (req: ReqT, options?: grpc.Metadata): Promise<Stream<RespT>>
}
export interface ClientStreamRequest<ReqT = any, RespT = any> {
  (req: Stream<ReqT>, options?: grpc.Metadata): Promise<RespT>
}
export interface BidiStreamRequest<ReqT = any, RespT = any> {
  (req: Stream<ReqT>, options?: grpc.Metadata): Promise<Stream<RespT>>
}

type MethodType = 'uu' | 'us' | 'su' | 'ss' | string

type RequestHandler = UnaryRequest | ServerStreamRequest | ClientStreamRequest | BidiStreamRequest
type ServerCall<T = any> = grpc.ServerUnaryCall<T> | grpc.ServerReadableStream<T> | grpc.ServerWriteableStream<T> | grpc.ServerDuplexStream<T, any>

export async function getService(protoFilePath: string, packageName: string, serviceName: string): Promise<ServiceClientConstructor> {
  const protofile = await protoLoader.load(protoFilePath)
  const pkgDef = grpc.loadPackageDefinition(protofile)
  return pkgDef[packageName][serviceName]
}

export class Reporter {
  report(log: Log) {}
}

export class Log {
  start: Date = new Date()
  end: Date
  remote: string = ''
  level: string = 'INFO'
  call: ServerCall<any>
  methodDef: grpc.MethodDefinition<any, any>
  error: Error = null
  reported = false

  constructor(call: ServerCall<any>, methodDef: grpc.MethodDefinition<any, any>) {
    this.start = new Date()
    this.call = call
    this.remote = this.call.getPeer()
    this.methodDef = methodDef
  }

  logEnd(error?: Error) {
    this.error = this.error || error
    if (this.error) this.level = 'ERROR'
    this.end = this.end || new Date()
    return this
  }
}

export class Logger extends EventEmitter {
}

export class ServerBuilder {
  private serviceImplObj: any = {}
  private protoFilePath: string
  private packageName: string
  private serviceName: string
  private Service: ServiceClientConstructor
  private reporter: Reporter = new Reporter()

  constructor(protofilePath: string, packageName: string, serviceName: string) {
    this.protoFilePath = protofilePath
    this.packageName = packageName
    this.serviceName = serviceName
  }

  public useReporter(reporter: Reporter) {
    this.reporter = reporter
    return this
  }

  public async buildService() {
    if (!this.Service) {
      this.Service = await getService(this.protoFilePath, this.packageName, this.serviceName)
    }
    return this
  }

  async build() {
    await this.buildService()
    const server = new grpc.Server()
    server.addService(this.Service.service, this.serviceImplObj)
    return new Server(server)
  }

  private getMethodDef(methodName: string): grpc.MethodDefinition<any, any> {
    if (this.Service) {
      const methodDef = this.Service.service[methodName]
      return methodDef
    } else {
      return null
    }
  }
  private getMethodType(methodName: string): MethodType {
    let result: string[] = []
    if (this.Service) {
      const methodDef = this.Service.service[methodName]
      if (!methodDef) throw new Error('no method definition for ' + methodName)
      result.push(methodDef.requestStream ? 's' : 'u')
      result.push(methodDef.responseStream ? 's' : 'u')
    }
    return result.join('')
  }

  uu<ReqT = any, RespT = any>(methodName: string, fn: UnaryRequest<ReqT, RespT>) {
    if (this.getMethodType(methodName) && this.getMethodType(methodName) !== 'uu') {
      throw new Error(`Method '${methodName}' is not an 'UnaryRequest'`)
    }
    return this.add(methodName, this.wrapUU(fn, this.getMethodDef(methodName)))
  }
  us<ReqT = any, RespT = any>(methodName: string, fn: ServerStreamRequest<ReqT, RespT>) {
    if (this.getMethodType(methodName) && this.getMethodType(methodName) !== 'us') {
      throw new Error(`Method '${methodName}' is not an 'ServerStreamRequest'`)
    }
    return this.add(methodName, this.wrapUS(fn, this.getMethodDef(methodName)))
  }
  su<ReqT = any, RespT = any>(methodName: string, fn: ClientStreamRequest<ReqT, RespT>) {
    if (this.getMethodType(methodName) && this.getMethodType(methodName) !== 'su') {
      throw new Error(`Method '${methodName}' is not an 'ClientStreamRequest'`)
    }
    return this.add(methodName, this.wrapSU(fn, this.getMethodDef(methodName)))
  }
  ss<ReqT = any, RespT = any>(methodName: string, fn: BidiStreamRequest<ReqT, RespT>) {
    if (this.getMethodType(methodName) && this.getMethodType(methodName) !== 'ss') {
      throw new Error(`Method '${methodName}' is not an 'SreamStreamRequest'`)
    }
    return this.add(methodName, this.wrapSS(fn, this.getMethodDef(methodName)))
  }
  
  private add(methodName: string, fn: grpc.handleCall<any, any>) {
    this.serviceImplObj[methodName] = fn
    return this
  }
  private wrapUU(fn: UnaryRequest<any, any>, methodDef?: grpc.MethodDefinition<any, any>): grpc.handleUnaryCall<any, any> {
    return (call, callback) => {
      const log = new Log(call, methodDef)
      // this.logger.logUnaryCall(call, methodDef)
      fn(call.request, call.metadata).then(data => {
        callback(null, data)
      }, err => {
        callback(err, null)
      }).finally(() => this.reporter.report(log.logEnd()))
    }
  }
  private wrapUS(fn: ServerStreamRequest<any, any>, methodDef?: grpc.MethodDefinition<any, any>): grpc.handleServerStreamingCall<any, any> {
    return async (call) => {
      const log = new Log(call, methodDef)
      const reader = await fn(call.request, call.metadata)
      call.on('cancelled', () => reader.destroy(new Error('client.cancelled')))
      reader.on('error', (err) => call.emit('error', err))
      reader.pipe(call)
      call.on('error', (err) => this.reporter.report(log.logEnd(err)))
      call.on('finish', () => this.reporter.report(log.logEnd()))
    }
  }
  private wrapSU(fn: ClientStreamRequest<any, any>, methodDef?: grpc.MethodDefinition<any, any>): grpc.handleClientStreamingCall<any, any> {
    return (call, callback) => {
      const log = new Log(call, methodDef)
      call.on('error', (err) => this.reporter.report(log.logEnd(err)))
      call.on('finish', () => this.reporter.report(log.logEnd()))
      fn(call, call.metadata).then(result => {
        callback(null, result)
      }, err => {
        callback(err, null)
      }).finally(() => this.reporter.report(log.logEnd()))
    }
  }
  private wrapSS(fn: BidiStreamRequest<any, any>, methodDef?: grpc.MethodDefinition<any, any>): grpc.handleBidiStreamingCall<any, any> {
    return async (call) => {
      const log = new Log(call, methodDef)
      const reader = await fn(call, call.metadata)
      call.on('cancelled', () => reader.destroy(new Error('client.cancelled')))
      reader.on('error', (err) => call.emit('error', err))
      reader.pipe(call)
      call.on('error', (err) => this.reporter.report(log.logEnd(err)))
      call.on('finish', () => this.reporter.report(log.logEnd()))
    }
  }
}

export class Server {
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

export class ClientBuilder {
  addr: string
  credentials: grpc.ChannelCredentials
  serviceClient: ServiceClient
  Service: ServiceClientConstructor

  constructor(addr: string, credentials: grpc.ChannelCredentials = grpc.credentials.createInsecure()) {
    this.addr = addr
    this.credentials = credentials
  }

  async build<T = any>(protofilePath, packageName, serviceName) {
    if (!this.Service) {
      const Service = this.Service = await getService(protofilePath, packageName, serviceName)
      this.serviceClient = new Service(this.addr, this.credentials)
    }
    const client: any = {}
    Object.keys(this.Service.service).forEach(methodName => {
      const serviceDef = this.Service.service[methodName]
      if (!serviceDef.requestStream && !serviceDef.responseStream) {
        client[methodName] = this.wrapUnaryRequest(methodName)
      } else if (!serviceDef.requestStream && serviceDef.responseStream) {
        client[methodName] = this.wrapServerStreamRequest(methodName)
      } else if (serviceDef.requestStream && !serviceDef.responseStream) {
        client[methodName] = this.wrapClientStreamRequest(methodName)
      } else if (serviceDef.requestStream && serviceDef.responseStream) {
        client[methodName] = this.wrapBidiStreamRequest(methodName)
      }
    })
    return client as T
  }

  private wrapUnaryRequest<ReqT = any, RespT = any>(method: string): UnaryRequest<ReqT, RespT> {
    const serviceClient = this.serviceClient
    return function UnaryRequest(req: ReqT, meta?: grpc.Metadata, options?: grpc.CallOptions) {
      const args = arguments
      return new Promise<RespT>((resolve, reject) => {
        serviceClient[method](...args, (err, resp) => err ? reject(err) : resolve(resp))
      })
    }
  }

  private wrapServerStreamRequest<ReqT = any, RespT = any>(method: string): ServerStreamRequest<ReqT, RespT> {
    const serviceClient = this.serviceClient
    return async function ServerStreamRequest(req: ReqT, meta?: grpc.Metadata, options?: grpc.CallOptions) {
      const args = arguments
      const call = serviceClient[method](...args)
      return call
    }
  }

  private wrapClientStreamRequest<ReqT = any, RespT = any>(method: string): ClientStreamRequest<ReqT, RespT> {
    const serviceClient = this.serviceClient
    return function ClientStreamRequest(reader: Stream<ReqT>, meta?: grpc.Metadata, options?: grpc.CallOptions) {
      const args: any[] = Array.prototype.slice.call(arguments)
      args.shift()
      return new Promise(async (resolve, reject) => {
        const call: grpc.ClientWritableStream<ReqT> = serviceClient[method](...args, (err, resp) => err ? reject(err) : resolve(resp))
        for await (const result of reader) {
          await new Promise((resolve, reject) => call.write(result, {}, (err) => err ? reject(err) : resolve()))
        }
      })
    }
  }

  private wrapBidiStreamRequest<ReqT = any, RespT = any>(method: string): BidiStreamRequest<ReqT, RespT> {
    const serviceClient = this.serviceClient
    return function BidiStreamRequest(reader: Stream<ReqT>, meta?: grpc.Metadata, options?: grpc.CallOptions) {
      const args: any[] = Array.prototype.slice.call(arguments)
      args.shift()
      const call: grpc.ClientDuplexStream<ReqT, RespT> = serviceClient[method](...args)
      new Promise(async resolve => {
        for await (const result of reader) {
          await new Promise((resolve, reject) => call.write(result, {}, (err) => err ? reject(err) : resolve()))
        }
      }).finally(() => {
        call.end()
      })
      return call as any
    }
  }
}
