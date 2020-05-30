import { promisify } from 'util'
import { strict as assert } from 'assert'
import { Readable, PassThrough, pipeline } from 'stream'
import * as grpc from '@grpc/grpc-js'
import { MetadataOptions } from '@grpc/grpc-js/build/src/metadata'

const pipelinePromise = promisify(pipeline)

export function getMetadata(obj: {[x: string]: string} = {}, options?: MetadataOptions) {
  const result = new grpc.Metadata(options)
  for (const [key, value] of Object.entries(obj)) {
    result.set(key, value)
  }
  return result
}

export function createClient(serviceDef: grpc.ServiceDefinition, serverAddr: string, credentials: grpc.ChannelCredentials): any {
  const result = {}
  const client = new grpc.Client(serverAddr, credentials)
  for (const method in serviceDef) {
    const methodDef = serviceDef[method]
    if (!methodDef.requestStream && !methodDef.responseStream) {
      result[method] = function unaryRequest(request: any, metadata?: any, callOptions?: grpc.CallOptions) {
        return new Promise((resolve, reject) => {
          client.makeUnaryRequest(
            methodDef.path,
            methodDef.requestSerialize,
            methodDef.responseDeserialize,
            request,
            getMetadata(metadata),
            callOptions || {},
            (err, result) => {
              if (err) return reject(err)
              return resolve(result)
            },
          )
        })
      }
    } else if (methodDef.requestStream && !methodDef.responseStream) {
      result[method] = async function clientStreamRequest(request: Readable, metadata?: any, callOptions?: grpc.CallOptions) {
        return new Promise((resolve, reject) => {
          request.pipe(client.makeClientStreamRequest(
            methodDef.path,
            methodDef.requestSerialize,
            methodDef.responseDeserialize,
            getMetadata(metadata),
            callOptions || {},
            (err, result) => {
              if (err) return reject(err)
              return resolve(result)
            },
          ))
        })
      }
    } else if (!methodDef.requestStream && methodDef.responseStream) {
      result[method] = async function serverStreamRequest(request: any, metadata?: any, callOptions?: grpc.CallOptions) {
        return client.makeServerStreamRequest(
          methodDef.path,
          methodDef.requestSerialize,
          methodDef.responseDeserialize,
          request,
          getMetadata(metadata),
          callOptions || {},
        )
      }
    } else if (methodDef.requestStream && methodDef.responseStream) {
      result[method] = async function serverStreamRequest(request: Readable, metadata?: any, callOptions?: grpc.CallOptions) {
        return request.pipe(client.makeBidiStreamRequest(
          methodDef.path,
          methodDef.requestSerialize,
          methodDef.responseDeserialize,
          getMetadata(metadata),
          callOptions || {},
        ))
      }
    }
  }
  return result
}
