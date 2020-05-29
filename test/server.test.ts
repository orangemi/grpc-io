import 'mocha'
import { strict as assert } from 'assert'
import { createServer } from '../src/server'
import * as path from 'path'
import * as protoLoader from '@grpc/proto-loader'
import * as grpc from '@grpc/grpc-js'

describe('server', () => {
  let serviceDef: grpc.ServiceDefinition
  let packageDef: protoLoader.PackageDefinition
  before(async () => {
    const protoFilePath = path.resolve(__dirname, './protos/route_guide.proto')
    packageDef = await protoLoader.load(protoFilePath)
    serviceDef = packageDef['routeguide.RouteGuide'] as grpc.ServiceDefinition
  })

  it('server.createServer', async () => {
    const server = createServer(serviceDef, {
      async GetFeature() { return {} },
      async ListFeatures() {},
      async RecordRoute() {},
      async RouteChat() {},
    })
    console.log('server start')
    await new Promise((resolve, reject) => server.bindAsync('0.0.0.0:5443', grpc.ServerCredentials.createInsecure(), (err, port) => {
      if (err) return reject()
      server.start()
      return resolve(port)
    }))

    console.log('server started')
    console.log('client connect')

    var routeguide = grpc.loadPackageDefinition(packageDef).routeguide;
    var client = new routeguide['RouteGuide']('127.0.0.1:5443', grpc.credentials.createInsecure());
    
    console.log('client connected')
    // console.log('client.GetFeature', client.GetFeature)

    const result = await new Promise((resolve, reject) => client.GetFeature({latitude: 1, longitude: 2}, (err, result) => {
      if (err) return reject(err)
      return resolve(result)
    }))
    console.log(result)
  })
})
