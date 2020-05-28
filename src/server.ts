import { promisify } from 'util'
import { Readable, PassThrough, pipeline } from 'stream'
import * as grpc from '@grpc/grpc-js'
import { ChannelOptions } from '@grpc/grpc-js/build/src/channel-options'

const pipelinePromise = promisify(pipeline)

// grpc not export handleClientStreamingCall function
type handleClientStreamingCall<RequestType, ResponseType> = (call: grpc.ServerReadableStream<RequestType, ResponseType>, callback: grpc.sendUnaryData<ResponseType>) => void

export function createServer(serviceDef: grpc.ServiceDefinition, serviceObjectImpl: any, serverOptions?: ChannelOptions) {
  const serviceObj = {}
  for (const method in serviceDef) {
    const methodDef = serviceDef[method]
    if (!methodDef.requestStream && !methodDef.responseStream) {
      const methodImpl: grpc.handleUnaryCall<any, any> = function handleUnaryCall(call, callback) {
        serviceObjectImpl[method](call.request, call)
        .then(result => {
          callback(null, result)
        })
        .catch(err => {
          callback(err, null)
        })
      }
      Object.assign(serviceObj, { [method]: methodImpl })
    } else if (!methodDef.requestStream && methodDef.responseStream) {
      const methodImpl: grpc.handleServerStreamingCall<any, any> = function handleServerStreamingCall(call) {
        serviceObjectImpl[method](call.request)
        .then((result: Readable) => {
          return pipelinePromise(result, call)
        })
        .catch(err => {
          call.emit('error', err)
        })
      }
      Object.assign(serviceObj, { [method]: methodImpl })
    } else if (methodDef.requestStream && !methodDef.responseStream) {
      const methodImpl: handleClientStreamingCall<any, any> = function handleClientStreamingCall(call, callback) {
        serviceObjectImpl[method](call.pipe(new PassThrough()), call)
        .then((result: any) => {
          callback(null, result)
        })
        .catch(err => {
          callback(err, null)
        })
      }
      Object.assign(serviceObj, { [method]: methodImpl })
    } else if (methodDef.requestStream && methodDef.responseStream) {
      const methodImpl: grpc.handleBidiStreamingCall<any, any> = function handleBidiStreamingCall(call) {
        serviceObjectImpl[method](call.pipe(new PassThrough()), call)
        .then((result: Readable) => {
          return pipelinePromise(result, call)
        })
        .catch(err => {
          call.emit('error', err)
        })
      }
      Object.assign(serviceObj, { [method]: methodImpl })
    }
  }

  const server = new grpc.Server(serverOptions)
  server.addService(serviceDef, serviceObj)
  return server
}

