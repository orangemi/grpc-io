import { promisify } from 'util'
import { strict as assert } from 'assert'
import { Readable, PassThrough, pipeline } from 'stream'
import * as grpc from '@grpc/grpc-js'
import { ChannelOptions } from '@grpc/grpc-js/build/src/channel-options'

const pipelinePromise = promisify(pipeline)

// grpc not export handleClientStreamingCall function
type handleClientStreamingCall<RequestType, ResponseType> = (call: grpc.ServerReadableStream<RequestType, ResponseType>, callback: grpc.sendUnaryData<ResponseType>) => void

export function createServiceObj(serviceDef: grpc.ServiceDefinition, serviceImpl: any) {
  const serviceObj = {}
  for (const method in serviceDef) {
    const methodDef = serviceDef[method]
    const methodImpl: Function = serviceImpl[method]

    assert.ok(methodImpl, new Error(`method '${method}' is not implemented in service`))
    assert.equal(typeof methodImpl, 'function', new Error(`method '${method}' is not a function in service`))

    if (!methodDef.requestStream && !methodDef.responseStream) {
      const handler: grpc.handleUnaryCall<any, any> = function handleUnaryCall(call, callback) {
        methodImpl.call(serviceImpl, call.request, call.metadata, call)
        .then(result => {
          callback(null, result)
        })
        .catch(err => {
          callback(err, null)
        })
      }
      Object.assign(serviceObj, { [method]: handler })
    } else if (!methodDef.requestStream && methodDef.responseStream) {
      const handler: grpc.handleServerStreamingCall<any, any> = function handleServerStreamingCall(call) {
        methodImpl.call(serviceImpl, call.request, call.metadata, call)
        .then((result: Readable) => {
          return pipelinePromise(result, call)
        })
        .catch(err => {
          call.emit('error', err)
        })
      }
      Object.assign(serviceObj, { [method]: handler })
    } else if (methodDef.requestStream && !methodDef.responseStream) {
      const handler: handleClientStreamingCall<any, any> = function handleClientStreamingCall(call, callback) {
        methodImpl.call(serviceImpl, call.pipe(new PassThrough()), call.metadata, call)
        .then((result: any) => {
          callback(null, result)
        })
        .catch(err => {
          callback(err, null)
        })
      }
      Object.assign(serviceObj, { [method]: handler })
    } else if (methodDef.requestStream && methodDef.responseStream) {
      const handler: grpc.handleBidiStreamingCall<any, any> = function handleBidiStreamingCall(call) {
        methodImpl.call(serviceImpl, call.pipe(new PassThrough()), call.metadata, call)
        .then((result: Readable) => {
          return pipelinePromise(result, call)
        })
        .catch(err => {
          call.emit('error', err)
        })
      }
      Object.assign(serviceObj, { [method]: handler })
    }
  }

  return serviceObj
}

export function createServer(serviceDef: grpc.ServiceDefinition, serviceImpl: any, serverOptions?: ChannelOptions) {
  assert.ok(serviceImpl, new Error(`service is not implemented?`))

  const server = new grpc.Server(serverOptions)
  server.addService(serviceDef, createServiceObj(serviceDef, serviceImpl))
  return server
}
