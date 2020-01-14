var path = require("path");
var version = require('./package.json').version;

var rules = [
  { test: /\.css$/, use: ["style-loader", "css-loader"]},
  // required to load font-awesome
  { test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/, use: "url-loader?limit=10000&mimetype=application/font-woff" },
  { test: /\.woff(\?v=\d+\.\d+\.\d+)?$/, use: "url-loader?limit=10000&mimetype=application/font-woff" },
  { test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/, use: "url-loader?limit=10000&mimetype=application/octet-stream" },
  { test: /\.eot(\?v=\d+\.\d+\.\d+)?$/, use: "file-loader" },
  { test: /\.svg(\?v=\d+\.\d+\.\d+)?$/, use: "url-loader?limit=10000&mimetype=image/svg+xml" }
]

module.exports = [{
  entry: ["./dist/lib/index.js"],
  output: {
    library: "@bokeh/jupyter_embed",
    filename: "jupyter_embed.js",
    path: path.resolve("./dist"),
    libraryTarget: "amd",
    // publicPath: "/static/js/jupyter_embed/",
    publicPath: 'https://unpkg.com/@bokeh/jupyter_embed@' + version + '/dist/'
  },
  module: {rules: rules},
  devtool: "source-map",
  mode: "development",
  optimization: {
    minimize: true,
  },
}]
