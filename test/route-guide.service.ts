import { strict as assert } from 'assert'
import { createError, GRPC_STATUS } from '../src/definition'
const features: Feature[] = []

interface Point {
  latitude: number
  longitude: number
}

interface Feature {
  name: string
  location: Point
}

export const routeGuideServiceImpl = {
  async GetFeature(point: Point): Promise<Feature> {
    console.log('on request GetFeature')
    const result = features.find(feature => {
      return feature.location.latitude === point.latitude
       && feature.location.longitude === point.longitude
    })
    assert.ok(result, createError(GRPC_STATUS.NOT_FOUND, 'resource not found'))
    return result
  },
  async ListFeatures() {},
  async RecordRoute() {},
  async RouteChat() {},
}

export default routeGuideServiceImpl
