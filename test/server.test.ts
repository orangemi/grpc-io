import 'mocha'
import {strict as assert} from 'assert'
import * as grpcIO from '../src/grpc-io'
import * as path from 'path'
import * as grpc from 'grpc'
import * as protoLoader from '@grpc/proto-loader'

describe('grpc.serverBuilder', () => {
  const grpcFilePath = path.resolve(__dirname, './protos/route-guide.proto')
  it('new builder', () => {
    const builder = new grpcIO.ServerBuilder(grpcFilePath, 'routeguide', 'RouteGuide')
    assert.ok(builder)
  })
  it('builder.buildService', async () => {
    const builder = new grpcIO.ServerBuilder(grpcFilePath, 'routeguide', 'RouteGuide')
    await builder.buildService()
    assert.ok((builder as any).Service)
  })
  describe('', () => {
    const addr = '127.0.0.1:5001'
    let grpcClient: any
    beforeEach(async () => {
      const protoFile = await protoLoader.load(grpcFilePath)
      const protoDef: any = grpc.loadPackageDefinition(protoFile)
      grpcClient = new protoDef.routeguide.RouteGuide(addr, grpc.credentials.createInsecure())
    })
    afterEach(() => {
      grpcClient.close()
    })
    it('builder.uu', async () => {
      const builder = new grpcIO.ServerBuilder(grpcFilePath, 'routeguide', 'RouteGuide')
      await builder.buildService()
      const server = await builder.uu('GetFeature', async () => {return {name: 'test_name'}}).build()
      server.listen(addr)
      const resp: any = await new Promise((resolve, reject) => {
        grpcClient.GetFeature({}, (err, resp) => {
          if (err) return reject(err)
          resolve(resp)
        })
      })
      server.close(true)
      assert.equal(resp.name, 'test_name')
    })
  })
})
