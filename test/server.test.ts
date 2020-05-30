import 'mocha'
import { strict as assert } from 'assert'
import { createServer } from '../src/server'
import { createClient } from '../src/client'
import * as path from 'path'
import * as protoLoader from '@grpc/proto-loader'
import * as grpc from '@grpc/grpc-js'
import { routeGuideServiceImpl } from './route-guide.service'

describe.skip('server', () => {
  let serviceDef: grpc.ServiceDefinition
  let packageDef: protoLoader.PackageDefinition
  let nativeClient: any
  let server: grpc.Server
  // let serviceImplObject: any
  beforeEach(async () => {
    const protoFilePath = path.resolve(__dirname, './protos/route_guide.proto')
    packageDef = await protoLoader.load(protoFilePath)
    serviceDef = packageDef['routeguide.RouteGuide'] as grpc.ServiceDefinition
    const nativeClientConstrocutor = grpc.loadPackageDefinition(packageDef).routeguide['RouteGuide']
    nativeClient = new nativeClientConstrocutor('127.0.0.1:5443', grpc.ChannelCredentials.createInsecure())
  })

  afterEach(async () => {
    if (server) {
      try {
        await new Promise((resolve, reject) => server.tryShutdown((err) => {
          if (err) return reject(err)
          return resolve()
        }))
      } catch (e) {
        console.error(e)
      }
    }
  })

  it('server.createServer', async () => {
    server = createServer(serviceDef, routeGuideServiceImpl)
    await new Promise((resolve, reject) => server.bindAsync('0.0.0.0:5443', grpc.ServerCredentials.createInsecure(), (err, port) => {
      if (err) return reject()
      server.start()
      return resolve(port)
    }))

    // console.log('server started')
    // console.log('client connect')

    // const client = createClient(serviceDef, '127.0.0.1:5443', grpc.ChannelCredentials.createInsecure())
    // console.log('client connected')
    // const result = await client.GetFeature({})
    // console.log('==== last ====', result)

    // var routeguide = grpc.loadPackageDefinition(packageDef).routeguide;
    // var client = new routeguide['RouteGuide']('127.0.0.1:5443', grpc.credentials.createInsecure());
    
    // console.log('client connected')
    // // console.log('client.GetFeature', client.GetFeature)

    const result = await new Promise((resolve, reject) => nativeClient.GetFeature({latitude: 1, longitude: 2}, (err, result) => {
      if (err) return reject(err)
      return resolve(result)
    }))
    console.log(result)
  })

  it('server.createServer & client.createClient', async () => {
    const server = createServer(serviceDef, routeGuideServiceImpl)
    await new Promise((resolve, reject) => server.bindAsync('0.0.0.0:5443', grpc.ServerCredentials.createInsecure(), (err, port) => {
      if (err) return reject()
      server.start()
      return resolve(port)
    }))

    const client = createClient(serviceDef, '127.0.0.1:5443', grpc.ChannelCredentials.createInsecure())
    const result = await client.GetFeature({})
    console.log('==== last ====', result)

  })
})
