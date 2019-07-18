import * as pbjs from 'protobufjs'

const filepath = './protos/route-guide.proto'

async function main() {
  const root = new pbjs.Root()
  await root.load([filepath])
  root.resolveAll()
  console.log(JSON.stringify(root.toJSON(), null, 2))
  // detect(root)
}

function detect(root: pbjs.Namespace) {
  // console.log('detect', root.name)
  root.nestedArray.forEach(v => {
    // console.log('PBObject', v.fullName, (v as any).constructor.name)
    // console.log(Object.keys(v))
    detect(v as pbjs.Namespace)
  })

  // console.log(root)
  root.nestedArray
  .filter(v => v instanceof pbjs.Type)
  .forEach(v => {
    const v2 = v as pbjs.Type
    console.log(v)
    // console.log((v as any).$type)
    // console.log(v2.fromObject({}))
    // console.log('Type', v.name)
    // console.log((v as any).fromObject)
    // console.log((v as any).encode)
  })
  // root.nestedArray
  // .filter(v => v instanceof pbjs.Service)
  // .forEach(v => {
  //   console.log('Service', v.fullName)
  //   const s = (v as pbjs.Service)
  //   s.methodsArray.forEach(m => {
  //     console.log('Method', m)
  //   })
  //   // detect(v as pbjs.Service)
  // })
  // root.nestedArray
  // .filter(v => v instanceof pbjs.Message)
  // .forEach(v => {
  //   console.log('Message', v.name)
  // })
  // root.nestedArray
  // .filter(v => v instanceof pbjs.Namespace)
  // .forEach(v => {
  //   console.log('Namespace', v.name)
  //   detect(v as pbjs.Namespace)
  // })
}

main()