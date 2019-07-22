import * as grpcIO from '../src/grpc-io'
import * as RouteGuide from './route-guide'

const protoFilePath = __dirname + '/protos/route-guide.proto'

async function main() {
  const serverBuilder = await new grpcIO.ServerBuilder(protoFilePath, 'routeguide', 'RouteGuide')
    .buildService()

  const server = await serverBuilder
    .uu<RouteGuide.Point, RouteGuide.Feature>('GetFeature', async (req) => {
      // let e: any = new Error('something error')
      // throw e
      return {name: "hello world"}
    })
    .us<RouteGuide.Rectangle, RouteGuide.Feature>('ListFeatures', async (req) => {
      let t = 5
      return {
        async next() {
          if (t-- <= 0) return null
          return {name: 't ' + t}
        }
      }
    })
    .su<RouteGuide.Point, RouteGuide.RouteSummary>('RecordRoute', async (reader) => {
      let count = 0
      while (true) {
        const t = await reader.next()
        if (!t) break
        count++
      }
      return {feature_count: count}
    })
    .ss<RouteGuide.RouteNote, RouteGuide.RouteNote>('RouteChat', async (reader) => {
      return {
        async next() {
          const message = await reader.next()
          if (message) {
            return {message: message.message + ' server', location: message.location}
          } else {
            return null
          }
        }
      }
    })
    .build()
  // await server.use(, new RouteGuideServiceImpl() as any)
  console.log('start server...')
  const p = await server.listen('127.0.0.1:5009')
  
  // await new Promise(resolve => setTimeout(resolve, 5000))

  // console.log('stop server...')
  // await server.close()
}

main().catch(e => {
  console.error(e.message, e)
})
