import 'mocha'
import {strict as assert} from 'assert'
import * as grpcIO from '../src/grpc'

describe('grpc.serverBuilder', () => {
  it('new builder', () => {
    const builder = new grpcIO.ServerBuilder('protos/route-guide.proto', 'routeguide', 'RouteGuide')
    assert(builder)
  })
})
