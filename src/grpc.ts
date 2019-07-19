import { Readable } from 'stream'
// import * as grpc from '@grpc/grpc-js'
import * as grpc from 'grpc'
import * as protoLoader from "@grpc/proto-loader"
import { ServiceClient } from '@grpc/grpc-js/build/src/make-client'

export interface ServiceClientConstructor<T = any> {
  new(address: string, credentials: grpc.ChannelCredentials, options?: any): ServiceClient
  service: grpc.ServiceDefinition<T>
}

export interface RequestOptions {
}

export interface Stream<T = any> {
  next(): Promise<T>
  emitError?(error: Error): any
  cancel?(): any
}

export class StreamReader<T> implements Stream<T> {
  call: Readable
  isEnded = false
  error: Error = null

  get request() { return this.call }

  constructor(call: Readable) {
    this.call = call
    this.call.once('end', () => { this.isEnded = true })
    this.call.once('error', (error: Error) => {
      this.isEnded = true
      this.error = error
    })
  }

  emitError(error: Error) {
    if (!this.error) this.error = error
  }

  async next(): Promise<T> {
    if (this.error) throw this.error
    if (this.isEnded) return null
    const result: T = await Promise.race<any>([
      new Promise(resolve => this.call.once('data', resolve)),
      new Promise((_, reject) => this.call.once('error', reject)),
      new Promise(resolve => this.call.once('end', () => resolve(null))),
    ])
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

type MethodType = 'uu' | 'us' | 'su' | 'ss' | string

type RequestHandler = UnaryUnaryRequest | UnaryStreamRequest | StreamUnaryRequest | StreamStreamRequest

export class ServerBuilder {
  private serviceImplObj: any = {}
  private protoFilePath: string
  private packageName: string
  private serviceName: string
  private Service: ServiceClientConstructor

  constructor(protofilePath: string, packageName: string, serviceName: string) {
    this.protoFilePath = protofilePath
    this.packageName = packageName
    this.serviceName = serviceName
  }

  public async buildService() {
    if (this.Service) return
    const protofile = await protoLoader.load(this.protoFilePath)
    const pkgDef = grpc.loadPackageDefinition(protofile)
    this.Service = pkgDef[this.packageName][this.serviceName]
    return this
  }

  async build() {
    await this.buildService()
    const server = new grpc.Server()
    server.addService(this.Service.service, this.serviceImplObj)
    return new Server(server)
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

  uu<ReqT = any, RespT = any>(methodName: string, fn: UnaryUnaryRequest<ReqT, RespT>) {
    if (this.getMethodType(methodName) && this.getMethodType(methodName) !== 'uu') {
      throw new Error(`Method '${methodName}' is not an 'UnaryUnaryRequest'`)
    }
    return this.add(methodName, this.wrapUU(fn))
  }
  us<ReqT = any, RespT = any>(methodName: string, fn: UnaryStreamRequest<ReqT, RespT>) {
    if (this.getMethodType(methodName) && this.getMethodType(methodName) !== 'us') {
      throw new Error(`Method '${methodName}' is not an 'UnaryStreamRequest'`)
    }
    return this.add(methodName, this.wrapUS(fn))
  }
  su<ReqT = any, RespT = any>(methodName: string, fn: StreamUnaryRequest<ReqT, RespT>) {
    if (this.getMethodType(methodName) && this.getMethodType(methodName) !== 'su') {
      throw new Error(`Method '${methodName}' is not an 'StreamUnaryRequest'`)
    }
    return this.add(methodName, this.wrapSU(fn))
  }
  ss<ReqT = any, RespT = any>(methodName: string, fn: StreamStreamRequest<ReqT, RespT>) {
    if (this.getMethodType(methodName) && this.getMethodType(methodName) !== 'ss') {
      throw new Error(`Method '${methodName}' is not an 'SreamStreamRequest'`)
    }
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
        client[methodName] = this.wrapStreamUnaryRequest(methodName)
      } else if (serviceDef.requestStream && serviceDef.responseStream) {
        client[methodName] = this.wrapStreamStreamRequest(methodName)
      }
    })
    return client as T
  }

  private wrapUnaryUnaryRequest<ReqT = any, RespT = any>(method: string): UnaryUnaryRequest<ReqT, RespT> {
    const serviceClient = this.serviceClient
    return function uuRequest(req: ReqT, meta?: grpc.Metadata, options?: grpc.CallOptions) {
      const args = arguments
      return new Promise<RespT>((resolve, reject) => {
        serviceClient[method](...args, (err, resp) => err ? reject(err) : resolve(resp))
      })
    }
  }

  private wrapUnaryStreamRequest<ReqT = any, RespT = any>(method: string): UnaryStreamRequest<ReqT, RespT> {
    const serviceClient = this.serviceClient
    return async function usRequst(req: ReqT, meta?: grpc.Metadata, options?: grpc.CallOptions) {
      const args = arguments
      // return new Promise((resolve, reject) => {
      const call = serviceClient[method](...args)
      const reader = new StreamReader<RespT>(call)
      return reader
        // return resolve(reader)
      // })
    }
  }

  private wrapStreamUnaryRequest<ReqT = any, RespT = any>(method: string): StreamUnaryRequest<ReqT, RespT> {
    const serviceClient = this.serviceClient
    return function suRequst(reader: Stream<ReqT>, meta?: grpc.Metadata, options?: grpc.CallOptions) {
      const args: any[] = Array.prototype.slice.call(arguments)
      args.shift()
      return new Promise(async (resolve, reject) => {
        const call = serviceClient[method](...args, (err, resp) => err ? reject(err) : resolve(resp))
        while (true) {
          const obj = await reader.next()
          if (!obj) break
          call.write(obj)
        }
        call.end()
      })
    }
  }

  private wrapStreamStreamRequest<ReqT = any, RespT = any>(method: string): StreamStreamRequest<ReqT, RespT> {
    const serviceClient = this.serviceClient
    return async function ssRequst(reader: Stream<ReqT>, meta?: grpc.Metadata, options?: grpc.CallOptions) {
      const args: any[] = Array.prototype.slice.call(arguments)
      args.shift()
      const call = serviceClient[method](...args)
      // return new Promise(async (resolve, reject) => {
      // call.on('error', e => console.error('resp err', e))
      // call.on('status', s => console.error('resp status', s))
      const respReader = new StreamReader<RespT>(call)

      new Promise(async (resolve, reject) => {
        while (true) {
          const obj = await reader.next()
          if (!obj) break
          call.write(obj)
        }
        call.end()
      }).catch(e => {
        respReader.emitError(e)
      })

      return respReader
    }
  }
}
