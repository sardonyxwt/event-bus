const CleanWebpackPlugin = require('clean-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const plugins = [
  new CleanWebpackPlugin({ dry: true }),
  new BundleAnalyzerPlugin({
    openAnalyzer: false,
    analyzerMode: 'static',
    reportFilename: `${__dirname}/bundle-report.html`
  })
];

module.exports = {
  entry: './src/index.ts',
  devtool: 'source-map',
  output: {
    filename: "event-bus.min.js",
    library: 'eventBus',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        options: {
          configFile: "tsconfig.webpack.json"
        }
      }
    ]
  },
  plugins
};
