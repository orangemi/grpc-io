import * as grpc from '@grpc/grpc-js'
// import * as grpc from 'grpc'
import * as protoLoader from "@grpc/proto-loader"
import { ServiceClientConstructor } from '@grpc/grpc-js/build/src/make-client'

interface GrpcRequestHandler<Request = any, Response = any> {
  (req: Request, meta?: grpc.Metadata, options?: grpc.CallOptions): Promise<Response>
}

interface GrpcRequest<RequestType> {
  req:
}

export class GrpcServer {
  server = new grpc.Server()

  async use(protofilePath, packageName, serviceName, methodObj: {[x: string]: GrpcRequestHandler}) {
    const protofile = await protoLoader.load(protofilePath)
    const pkgDef = grpc.loadPackageDefinition(protofile)
    const Service = pkgDef[packageName][serviceName] as ServiceClientConstructor
    const serviceImplObj: any = {}
    Object.keys(methodObj).forEach((method) => {
      serviceImplObj[method] = wrapAsyncToCallback(methodObj[method])
    })
    
    this.server.addService(Service.service, serviceImplObj)
    return this
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
  client: grpc.Client
  static async build<T = any>(protofilePath, packageName, serviceName, addr: string, credentials: grpc.ChannelCredentials = grpc.credentials.createInsecure()) {
    const protofile = await protoLoader.load(protofilePath)
    const pkgDef = grpc.loadPackageDefinition(protofile)
    const Service = pkgDef[packageName][serviceName] as ServiceClientConstructor
    const serviceClient = new Service(addr, credentials)
    const client: any = {}
    Object.keys(Service.service).forEach(method => {
      client[method] = async function grpcRequest (req: any, meta?: grpc.Metadata, options?: grpc.CallOptions) {
        const args = arguments
        return new Promise((resolve, reject) => {
          serviceClient[method].call(serviceClient, ...args, (err, resp) => err ? reject(err) : resolve(resp))
        })
      }
    })
    return client as T
  }
}

function wrapAsyncToCallback<Req = any, Res = any>(fn: GrpcRequestHandler<Req, Res>) {
  return (req: Req, meta: grpc.Metadata, options: grpc.CallOptions, callback: Function) => {
    fn(req, meta, options).then((data) => callback(null, data), (err) => callback(err))
  }
}

// debug
async function main() {
  const server = new GrpcServer()
  await server.use('test/protos/service.proto', 'routeguide', 'RouteGuide', {
    // GetFeature: async (req) => ({name: 'Shanghai'}),
    GetFeature: async (ctx) => {
      // console.log(meta, options)
      return {}
    },
    ListFeatures: async (req) => ({name: 'Shnaghai'}),
    RecordRoute: async (req) => ({name: 'Shnaghai'}),
    RouteChat: async (req) => ({name: 'Shnaghai'}),
  })
  const p = await server.listen('127.0.0.1:5009')

  const client = await GrpcClient.build('test/protos/service.proto', 'routeguide', 'RouteGuide', '127.0.0.1:5009')
  const point = {latitude: 409146138, longitude: -746188906};
  const resp = await client.GetFeature(point) //, (err, resp) => {
  console.log('resp', resp)
}

main().catch(e => {
  console.error(e.message, e)
})
