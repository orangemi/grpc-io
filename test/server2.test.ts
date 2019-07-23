import 'mocha'
import { Readable } from 'stream'
import { strict as assert } from 'assert'
import * as path from 'path'
import * as grpc from 'grpc'
import * as protoLoader from '@grpc/proto-loader'
import * as grpcIO from '../src/grpc-io'

async function delay(timeout: number) {
  return new Promise(resolve => setTimeout(resolve, timeout))
}

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
    let builder: grpcIO.ServerBuilder
    let server: grpcIO.Server

    beforeEach(async () => {
      builder = new grpcIO.ServerBuilder(grpcFilePath, 'routeguide', 'RouteGuide')
      await builder.buildService()
      // builder.useReporter(new ConsoleReporter())
      const protoFile = await protoLoader.load(grpcFilePath)
      const protoDef: any = grpc.loadPackageDefinition(protoFile)
      grpcClient = new protoDef.routeguide.RouteGuide(addr, grpc.credentials.createInsecure())
    })
    afterEach(async () => {
      grpcClient.close()
      await server.close(true)
    })

    it('builder.us', async () => {
      server = await builder.us('ListFeatures', async () => {
        let f = 5
        return new Readable({
          objectMode: true,
          read() {
            if (f-- <= 0) {
              this.push(null)
              return
            }
            setTimeout(() => {
              this.push({name: 'xxx'})
            }, 100)
          }
        })
      }).build()
      server.listen(addr)

      const call = grpcClient.ListFeatures({})
      let count = 0
      for await (const feature of call) {
        assert.equal(feature.name, 'xxx')
        count++
      }
      assert.equal(count, 5)
      // await new Promise(resolve => setTimeout(resolve, 1000))
    })

    it('builder.us (timeout)', async () => {
      server = await builder.us('ListFeatures', async () => {
        let f = 5000
        return new Readable({
          objectMode: true,
          read() {
            if (f-- <= 0) {
              this.push(null)
              return
            }
            setTimeout(() => {
              this.push({name: 'xxx'})
            }, 1000)
          }
        })
      }).build()
      server.listen(addr)

      const call = grpcClient.ListFeatures({})
      await delay(1000)
      // assee
    })
  })
})
