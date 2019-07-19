import * as grpcIO from '../src/grpc'
import * as RouteGuide from './route-guide'

// debug
async function main() {
  const client = await new grpcIO.ClientBuilder('127.0.0.1:5009')
    .build<RouteGuide.RouteGuideService>('protos/route-guide.proto', 'routeguide', 'RouteGuide')

  console.log('request 1')
  const resp1 = await client.GetFeature({latitude: 409146138, longitude: -746188906})
  console.log('resp1', resp1)

  console.log('request 2')
  const resp2 = await client.ListFeatures({})
  let count = 0
  while (true) {
    const t = await resp2.next()
    if (!t) break
    console.log('resp2 ', count++, {name: t.name})
  }

  console.log('request 3')
  let t3 = 5
  const resp3 = await client.RecordRoute({
    async next() {
      if (t3--) return {latitude: t3, longitude: t3}
      return null
    }
  })
  console.log('resp3', resp3)

  console.log('request 4')
  let t4 = 5
  const resp4 = await client.RouteChat({
    async next() {
      if (t4--) return {location: {longitude: t4, latitude: t4}, message: 'ok'}
      return null
    }
  })
  let count4 = 0
  while (true) {
    const n4 = await resp4.next()
    if (!n4) break
    console.log('resp4 ', count4++, n4)
  }

}

main().catch(e => {
  console.error(e.message, e)
})
