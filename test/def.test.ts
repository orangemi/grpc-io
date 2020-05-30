import 'mocha'
import { strict as assert } from 'assert'
import * as path from 'path'
import { routeGuideServiceImpl } from './route-guide.service'
import { parseProtofile } from '../src/definition'

describe('def', () => {
  it('def2', async () => {
    const protoFilePath = path.resolve(__dirname, './protos/route_guide.proto')
    await parseProtofile(protoFilePath)
  })
})
