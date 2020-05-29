import { promisify } from 'util'
import { strict as assert } from 'assert'
import { Readable, PassThrough, pipeline } from 'stream'
import * as grpc from '@grpc/grpc-js'
import { Z_PARTIAL_FLUSH } from 'mz/zlib'

const pipelinePromise = promisify(pipeline)

export function createClient(serviceDef: grpc.ServiceDefinition, serverAddr: string, credentials: grpc.ChannelCredentials) {
  const result = {}
  const client = new grpc.Client(serverAddr, credentials)
  for (const method in serviceDef) {
    const methodDef = serviceDef[method]
    if (!methodDef.requestStream && !methodDef.responseStream) {
      result[method] = async function unaryRequest(request: any, metaData?: any, callOptions?: grpc.CallOptions) {
        client.makeUnaryRequest(
          methodDef.path,
          methodDef.requestSerialize,
          methodDef.responseDeserialize,
          request,
          metaData,
          callOptions,
          (err, result) => {
            if (err) return Promise.reject(err)
            return Promise.resolve(result)
          },
        )
      }
    } else if (methodDef.requestStream && !methodDef.responseStream) {
      result[method] = async function clientStreamRequest(request: Readable, metaData?: any, callOptions?: grpc.CallOptions) {
        request.pipe(client.makeClientStreamRequest(
          methodDef.path,
          methodDef.requestSerialize,
          methodDef.responseDeserialize,
          metaData,
          callOptions,
          (err, result) => {
            if (err) return Promise.reject(err)
            return Promise.resolve(result)
          },
        ))
      }
    } else if (!methodDef.requestStream && methodDef.responseStream) {
      result[method] = async function serverStreamRequest(request: any, metaData?: any, callOptions?: grpc.CallOptions) {
        return client.makeServerStreamRequest(
          methodDef.path,
          methodDef.requestSerialize,
          methodDef.responseDeserialize,
          request,
          metaData,
          callOptions
        )
      }
    } else if (methodDef.requestStream && methodDef.responseStream) {
      result[method] = async function serverStreamRequest(request: Readable, metaData?: any, callOptions?: grpc.CallOptions) {
        return request.pipe(client.makeBidiStreamRequest(
          methodDef.path,
          methodDef.requestSerialize,
          methodDef.responseDeserialize,
          metaData,
          callOptions,
        ))
      }
    }
  }
  return client
}

// var routeguide = grpc.loadPackageDefinition(packageDef).routeguide;
// var client = new routeguide['RouteGuide']('127.0.0.1:5443', grpc.credentials.createInsecure());