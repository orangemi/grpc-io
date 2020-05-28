import 'mocha'
import { strict as assert } from 'assert'
import { createServer } from '../src/server'
import * as path from 'path'
import * as protoLoader from '@grpc/proto-loader'
import { ServiceDefinition, ServerCredentials } from '@grpc/grpc-js'

describe('server', async () => {
  const protoFilePath = path.resolve(__dirname, './protos/route_guide.proto')
  const packageDef = await protoLoader.load(protoFilePath)
  const serviceDef = packageDef['routeguide.RouteGuide'] as ServiceDefinition
  it('server.createServer', async () => {
    const server = createServer(serviceDef, {})
    await new Promise((resolve, reject) => server.bindAsync('0.0.0.0:5443', ServerCredentials.createInsecure(), (err, port) => {
      if (err) return reject()
      return resolve(port)
    }))

    
  })
})