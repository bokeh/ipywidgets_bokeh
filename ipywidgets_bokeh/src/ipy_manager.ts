declare const requirejs: any

function require_promise(pkg: string | string[]): Promise<any> {
  return new Promise((resolve, reject) => requirejs(pkg, resolve, reject))
}

const cdn = 'https://unpkg.com'

function get_cdn_url(moduleName: string, moduleVersion: string) {
  let packageName = moduleName
  let fileName = 'index' // default filename
  // if a '/' is present, like 'foo/bar', packageName is changed to 'foo', and path to 'bar'
  // We first find the first '/'
  let index = moduleName.indexOf('/')
  if ((index != -1) && (moduleName[0] == '@')) {
    // if we have a namespace, it's a different story
    // @foo/bar/baz should translate to @foo/bar and baz
    // so we find the 2nd '/'
    index = moduleName.indexOf('/', index+1)
  }
  if (index != -1) {
    fileName = moduleName.substr(index+1)
    packageName = moduleName.substr(0, index)
  }
  return `${cdn}/${packageName}@${moduleVersion}/dist/${fileName}`
}

const mods = new Set()

export function require_loader(moduleName: string, moduleVersion: string): Promise<any> {
  if (!mods.has(moduleName)) {
    mods.add(moduleName)
    const conf: {paths: {[key: string]: string}} = {paths: {}}
    conf.paths[moduleName] = get_cdn_url(moduleName, moduleVersion)
    requirejs.config(conf)
  }
  console.log(`Loading ${moduleName}@${moduleVersion} from ${cdn}`)
  return require_promise([moduleName])
}

export type WidgetManager = {
  render(bundle: unknown, el: HTMLElement): Promise<unknown>
}

//import type {WidgetManager} from "@bokeh/jupyter_embed"

export async function create_widget_manager(): Promise<WidgetManager> {
  const {WidgetManager} = await require_promise(["@bokeh/jupyter_embed"])
  return new WidgetManager({loader: require_loader})
}
