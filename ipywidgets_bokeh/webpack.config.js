const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
const version = require('./package.json').version;

const rules = [
  { test: /\.css$/, use: ["style-loader", "css-loader"] },
  // required to load font-awesome
  // `type: "javascript/auto"` disables webpack 5's built-in Asset Modules for these
  // rules; without it, css-loader's `new URL()` references make webpack double-process
  // the file (its own asset/resource handling *and* url-loader/file-loader), emitting a
  // second, bogus asset that's just the tiny "export default publicPath + filename" glue
  // module written to disk under the original font extension.
  { test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/, type: "javascript/auto", use: "url-loader?limit=10000&mimetype=application/font-woff" },
  { test: /\.woff(\?v=\d+\.\d+\.\d+)?$/, type: "javascript/auto", use: "url-loader?limit=10000&mimetype=application/font-woff" },
  { test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/, type: "javascript/auto", use: "url-loader?limit=10000&mimetype=application/octet-stream" },
  { test: /\.eot(\?v=\d+\.\d+\.\d+)?$/, type: "javascript/auto", use: "file-loader" },
  { test: /\.svg(\?v=\d+\.\d+\.\d+)?$/, type: "javascript/auto", use: "url-loader?limit=10000&mimetype=image/svg+xml" }
]

module.exports = (env={}, argv={}) => {
  const mode = argv.mode ?? "production"
  const minimize = mode === "production"
  return {
    entry: ["./dist/lib/index.js"],
    output: {
      library: "@bokeh/ipywidgets_bokeh",
      filename: "ipywidgets_bokeh.js",
      path: path.resolve("./dist"),
      libraryTarget: "global",
      publicPath: "" // will be filled in dynamically
      // publicPath: "/static/extensions/ipywidgets_bokeh/",
      // publicPath: 'https://unpkg.com/@bokeh/ipywidgets_bokeh@' + version + '/dist/'
    },
    externals: [
      function({context, request}, callback) {
        if (/^@bokehjs\//.test(request)){
          return callback(null, ["Bokeh", "loader", request])
        }
        callback();
      }
    ],
    module: {rules},
    devtool: mode === "development" ? 'inline-source-map' : false,
    mode,
    optimization: {
      minimize,
      // bokeh resolves models by their (unmangled) class name, so it must survive minification
      minimizer: [new TerserPlugin({terserOptions: {keep_classnames: true, keep_fnames: true}})],
    },
  }
}
