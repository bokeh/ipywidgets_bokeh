declare const requirejs: any

// XXX: we need to rename requirejs, because otherwise webpack would rewrite `requirejs.config()`
// into `undefined`, for an unspecified and possibly stupid reason. However, we need this exact
// setup to allow loading thirdparty Jupyter widgets.
const _requirejs = requirejs

function require_promise(pkg: string | string[]): Promise<any> {
  return new Promise((resolve, reject) => requirejs(pkg, resolve, reject))
}

function get_cdn_url(moduleName: string, moduleVersion: string, cdn: string) {
  let packageName = moduleName
  let fileName = "index" // default filename
  // if a '/' is present, like 'foo/bar', packageName is changed to 'foo', and path to 'bar'
  // We first find the first '/'
  let index = moduleName.indexOf("/")
  if ((index != -1) && (moduleName[0] == "@")) {
    // if we have a namespace, it's a different story
    // @foo/bar/baz should translate to @foo/bar and baz
    // so we find the 2nd '/'
    index = moduleName.indexOf("/", index+1)
  }
  if (index != -1) {
    fileName = moduleName.substr(index+1)
    packageName = moduleName.substr(0, index)
  }
  return `${cdn}/${packageName}@${moduleVersion}/dist/${fileName}`
}

const mods = new Set()

export function generate_require_loader(cdn: string): any {
  return function require_loader(moduleName: string, moduleVersion: string): Promise<any> {
    if (!mods.has(moduleName)) {
      mods.add(moduleName)
      const conf: {paths: {[key: string]: string}} = {paths: {}}
      conf.paths[moduleName] = get_cdn_url(moduleName, moduleVersion, cdn)
      _requirejs.config(conf)
    }
    console.debug(`Loading ${moduleName}@${moduleVersion} from ${cdn}`)
    return require_promise([moduleName])
  }
}
