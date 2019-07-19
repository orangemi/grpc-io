gRPC-IO *(Development)*
====

Use gRPC easily in node.js using [typescript](https://www.typescriptlang.org/). It support Unary2Unary, Unary2Stream, Stream2Unary, Stream2Stream all 4 type requests. Use wisely reference by [this example](./example).

This project is inspired from [grpc-kit](https://github.com/YoshiyukiKato/grpc-kit)

## Get Started
```typescript
import * as grpcIO from '@imxiaomi/grpc-io'

// Server Side
const serverBuilder = await new grpcIO.ServerBuilder('some.proto', 'package', 'service')
  .buildService()
serverBuilder.uu('someRpcMethod', async (req) => {
  return {msg: 'ok'}
})
const server = await serverBuilder.build()
await server.listen(':8443')

// Client side
const client = await new grpcIO.ClientBuilder('127.0.0.1:8443')
  .build<RouteGuide.RouteGuideService>('some.proto', 'package', 'service')
const resp = await client.someRpcMethod({})

```

## RoadMap
TODO

## About generated code
So far, this project does not use generated code for users and allow user to implement their interface to have some `friendly IDE intelligence`. But it is limited to have more `intelligence` in some case. For example, server side need to use `buildService()` promise to decide which request type the rpc method should be.

## API
TODO

## TODO
- [ ] API Documentation
- [ ] More comments
- [ ] More test
