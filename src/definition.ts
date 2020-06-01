import * as grpc from '@grpc/grpc-js'
import * as protobufjs from 'protobufjs'
import * as protoLoader from '@grpc/proto-loader'
export const GRPC_STATUS = grpc.status

export interface GrpcExtendError extends Error {
  code: number
  data?: any
}

export function createError(code: number, message: string, data?: any): GrpcExtendError {
  const error = new Error(message)
  return Object.assign(error, { code, data })
}

export async function parseProtofile(filepath: string) {
  // const packageDef = await protoLoader.load(filepath)
  // console.log(Object.keys(packageDef))
  // console.log(packageDef['routeguide'])
  const packageDef2 = await protobufjs.load(filepath)
  // const packageDef3 = await protobufjs.parse(filepath, {
  //   alternateCommentMode: true
  // })
  // console.log('resolved', packageDef2.resolved)
  // packageDef2.resolveAll()
  // console.log('resolved', packageDef2.resolved)
  // console.log(Object.keys(packageDef2))
  // console.log('parent', packageDef2.parent)
  // console.log('nest', packageDef2.nestedArray)
  packageDef2.nestedArray.forEach(obj => {
    if (obj instanceof protobufjs.Namespace)
    parseNamespace(obj as protobufjs.Namespace)
    // console.log('packageDef2.obj', obj)
  })
  // console.log(Object.keys(packageDef2))
  // for (const key in packageDef) {
  //   const anyDef: protobufjs.Service = packageDef[key]
  //   if (anyDef instanceof protobufjs.Service) {

  //   }

  // }
  // packageDef['a']

}

export function parseNamespace(ns: protobufjs.Namespace) {
  // console.log('ns.name:', ns.name)
  // console.log('ns.fullName:', ns.fullName)
  // console.log('ns.filename :', ns.filename)
  // console.log('ns.filename :', ns.filename)
  ns.nestedArray.forEach(obj => {
    // console.log('ns.obj.name', obj.name)
    if (obj instanceof protobufjs.Type) {
      // const message = obj as protobufjs.Type
      parseType(obj)
      // console.log('ns.Type.t', message)
    } else if (obj instanceof protobufjs.Service) {
      parseService(obj)
    } else {
      console.log('ns.unknown.type', obj.name)
    }
  })
}

export function parseService(service: protobufjs.Service) {
  // console.log('service.name', )
  console.log(`interface ${service.name} {`)
  service.methodsArray.forEach(method => {
    let requestType = method.requestType
    let responseType = method.responseType
    let callType = 'grpc.ServerUnaryCall'
    if (method.requestStream) {
      requestType = `Readable<${requestType}>`
    }
    if (method.responseStream) {
      responseType = `Readable<${responseType}>`
    }
    console.log(`  ${method.name}(req: ${requestType}, meta?: Metadata, call?: ${callType}): Promise<${responseType}>`)
    // console.log('method:', method.name)
    // console.log('method:', method.requestType)
    // console.log('method:', method.responseType)
  })
  console.log(`}`)
  console.log()
}

export function parseType(t: protobufjs.Type) {
  // console.log('type.name', t.name)
  // console.log('type.comment:', t.comment)

  console.log(`interface ${t.name} {`)

  t.fieldsArray.forEach(field => {
    const type = 
    // console.log('field.name', field.name)
    console.log(`  ${field.name}: ${getTsTypeFromGrpcType(field.type)}`)
    // console.log('field.comment:', field.comment)
    // console.log('field.type', field.type)
  })
  console.log(`}`)
  console.log()
}

export function getTsTypeFromGrpcType(origin: string) {
  if (origin === 'int32') return 'number'
  return origin
}
