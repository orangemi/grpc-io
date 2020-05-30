import * as grpc from '@grpc/grpc-js'
export const GRPC_STATUS = grpc.status

export interface GrpcExtendError extends Error {
  code: number
  data?: any
}

export function createError(code: number, message: string, data?: any): GrpcExtendError {
  const error = new Error(message)
  return Object.assign(error, { code, data })
}
