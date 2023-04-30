const path = require("path");
const version = require('./package.json').version;

const rules = [
  { test: /\.css$/, use: ["style-loader", "css-loader"] },
  // required to load font-awesome
  { test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/, use: "url-loader?limit=10000&mimetype=application/font-woff" },
  { test: /\.woff(\?v=\d+\.\d+\.\d+)?$/, use: "url-loader?limit=10000&mimetype=application/font-woff" },
  { test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/, use: "url-loader?limit=10000&mimetype=application/octet-stream" },
  { test: /\.eot(\?v=\d+\.\d+\.\d+)?$/, use: "file-loader" },
  { test: /\.svg(\?v=\d+\.\d+\.\d+)?$/, use: "url-loader?limit=10000&mimetype=image/svg+xml" }
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
    devtool: minimize ? false : "source-map",
    mode,
    optimization: {minimize},
  }
}
