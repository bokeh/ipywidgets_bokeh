// Minimal AMD loader for third-party ipywidgets bundles, used instead of a
// global requirejs. Widget packages published for embedding (e.g. bqplot,
// ipyleaflet) are built as a single anonymous AMD module (webpack's `amd`
// libraryTarget) with dependencies limited to a handful of well-known
// modules that we already have in hand (e.g. "@jupyter-widgets/base"), plus
// occasionally a peer widget package (e.g. ipyvuetify's "jupyter-vuetify"
// depends on "jupyter-vue"). We don't need a general purpose AMD/CommonJS
// resolver, only enough to evaluate that one `define(deps, factory)` call,
// recursing into the CDN for any dependency that isn't already in hand.
import * as base from "@jupyter-widgets/base"
import * as controls from "@jupyter-widgets/controls"
import * as outputWidgets from "@jupyter-widgets/output"
import * as luminoWidgets from "@lumino/widgets"

const known_modules = new Map<string, any>([
  ["@jupyter-widgets/base", base],
  ["@jupyter-widgets/controls", controls],
  ["@jupyter-widgets/output", outputWidgets],
  ["@lumino/widgets", luminoWidgets],
])

function split_package(moduleName: string): {package_name: string, file_name: string} {
  let package_name = moduleName
  let file_name = "index" // default filename
  // if a '/' is present, like 'foo/bar', package_name is changed to 'foo', and path to 'bar'
  // We first find the first '/'
  let index = moduleName.indexOf("/")
  if ((index != -1) && (moduleName[0] == "@")) {
    // if we have a namespace, it's a different story
    // @foo/bar/baz should translate to @foo/bar and baz
    // so we find the 2nd '/'
    index = moduleName.indexOf("/", index+1)
  }
  if (index != -1) {
    file_name = moduleName.substr(index+1)
    package_name = moduleName.substr(0, index)
  }
  return {package_name, file_name}
}

function get_cdn_url(moduleName: string, moduleVersion: string, cdn: string): string {
  const {package_name, file_name} = split_package(moduleName)
  return `${cdn}/${package_name}@${moduleVersion}/dist/${file_name}`
}

function get_package_json_url(packageName: string, moduleVersion: string, cdn: string): string {
  return `${cdn}/${packageName}@${moduleVersion}/package.json`
}

// `_model_module_version`/`_view_module_version` are meant to be treated as
// semver ranges, but some packages (e.g. nglview) declare an exact version
// that doesn't quite match what's actually published (a missing patch
// release, or a typo'd version bump), so the exact pin 404s on the CDN. Try
// the exact version first - widening every request to a caret range by
// default would silently resolve to the newest matching release even when
// the exact pin exists (e.g. bqplot@0.5.20 exists, but bqplot@^0.5.20
// resolves to 0.5.46), which risks loading JS that's out of sync with
// whatever the kernel actually sent. Only widen as a fallback once the
// exact version has failed.
function widen_version(moduleVersion: string): string | null {
  return /^[\^~*]|^[<>=]/.test(moduleVersion) ? null : `^${moduleVersion}`
}

// Peer widget packages (e.g. "jupyter-vue") aren't declared with a version by
// the AMD `define()` call that depends on them, only by name. Look up the
// version range the dependent package itself declares, so that we don't just
// grab whatever happens to be "latest" on the CDN.
async function resolve_peer_version(packageName: string, moduleVersion: string, dep: string, cdn: string): Promise<string> {
  const versions = [moduleVersion, widen_version(moduleVersion)].filter((v): v is string => v != null)
  for (const version of versions) {
    try {
      const response = await fetch(get_package_json_url(packageName, version, cdn))
      if (response.ok) {
        const pkg = await response.json()
        const range = pkg.dependencies?.[dep] ?? pkg.peerDependencies?.[dep]
        if (typeof range == "string") {
          return range
        }
      }
    } catch {
      // try the next candidate version, or fall through to "latest" below
    }
  }
  return "latest"
}

type AMDModule = {id: string, uri: string}

async function resolve_dependency(name: string, mod: AMDModule, exports: object, packageName: string, moduleVersion: string, cdn: string): Promise<any> {
  switch (name) {
    case "module": return mod
    case "exports": return exports
    case "require": throw new Error(`AMD module ${mod.id} depends on "require", which isn't supported`)
    default: {
      const known = known_modules.get(name)
      if (known !== undefined) {
        return known
      }
      const range = await resolve_peer_version(packageName, moduleVersion, name, cdn)
      return load_module(name, range, cdn)
    }
  }
}

async function fetch_module_source(moduleName: string, moduleVersion: string, cdn: string): Promise<{url: string, source: string}> {
  const versions = [moduleVersion, widen_version(moduleVersion)].filter((v): v is string => v != null)
  for (const [i, version] of versions.entries()) {
    const url = get_cdn_url(moduleName, version, cdn)
    const is_last = i === versions.length - 1
    try {
      const response = await fetch(url)
      if (response.ok) {
        return {url, source: await response.text()}
      }
      if (is_last) {
        throw new Error(`Failed to fetch ${url} (status ${response.status})`)
      }
    } catch (e) {
      if (is_last) {
        // A CDN 404 for a nonexistent version typically comes back without
        // CORS headers, which makes the browser report a same-looking
        // "blocked by CORS policy" error for what is really a missing
        // package/version.
        throw e instanceof Error && e.message.startsWith("Failed to fetch") ? e : new Error(
          `Failed to fetch ${url}. This may be reported as a CORS error, but is ` +
          `most likely because no version of ${moduleName} compatible with ` +
          `${moduleVersion} is published on ${cdn}.`,
        )
      }
    }
  }
  // unreachable: `versions` always has at least one entry
  throw new Error(`Could not resolve ${moduleName}@${moduleVersion}`)
}

async function load_amd_module(moduleName: string, moduleVersion: string, cdn: string): Promise<any> {
  const {url, source} = await fetch_module_source(moduleName, moduleVersion, cdn)

  const {package_name} = split_package(moduleName)
  const mod: AMDModule = {id: moduleName, uri: url}
  const exports = {}
  const state: {defined: Promise<any> | null} = {defined: null}

  function define(...args: any[]): void {
    const factory = args[args.length - 1]
    const deps: string[] = args.length >= 2 && Array.isArray(args[args.length - 2]) ? args[args.length - 2] : []
    state.defined = Promise.all(deps.map((dep) => resolve_dependency(dep, mod, exports, package_name, moduleVersion, cdn))).then((resolved) => {
      const result = typeof factory == "function" ? factory(...resolved) : factory
      return result !== undefined ? result : exports
    })
  }
  define.amd = {}

  // `new Function` runs in the global scope (unlike a closure), which matches
  // how these bundles are normally executed (as an injected <script> tag).
  const run = new Function("define", `${source}\n//# sourceURL=${url}`)
  run(define)

  if (state.defined === null) {
    throw new Error(`Module ${moduleName} did not call define()`)
  }
  return state.defined
}

const mods = new Map<string, Promise<any>>()

function load_module(moduleName: string, moduleVersion: string, cdn: string): Promise<any> {
  // Cache by name alone, not name+version: different widgets (or a widget and
  // one of its peer dependencies, e.g. jupyter-vuetify's "jupyter-vue") may
  // request the same underlying package under different version specifiers,
  // and loading it twice would create two independent module instances -
  // fatal for packages like Vue that assume a single global instance.
  let promise = mods.get(moduleName)
  if (promise == null) {
    console.debug(`Loading ${moduleName}@${moduleVersion} from ${cdn}`)
    promise = load_amd_module(moduleName, moduleVersion, cdn)
    mods.set(moduleName, promise)
  }
  return promise
}

export function generate_require_loader(cdn: string): (moduleName: string, moduleVersion: string) => Promise<any> {
  return function require_loader(moduleName: string, moduleVersion: string): Promise<any> {
    return load_module(moduleName, moduleVersion, cdn)
  }
}
