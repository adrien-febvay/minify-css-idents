const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const SourceMapDevToolPlugin = require('webpack').SourceMapDevToolPlugin;
const MinifiyCssIdentsPlugin = require('../dist/MinifiyCssIdentsPlugin');

const resolve = require('path').resolve.bind(null, __dirname, '..');

const minifyCssIdents = new MinifiyCssIdentsPlugin({
  filename: resolve('test/dist1/css/styles.map.json'),
  mode: 'create-map',
});

module.exports = {
  context: resolve('test/src1'),
  entry: resolve('test/src1/index.js'),
  mode: 'production',
  resolve: {
    extensions: ['.js'],
  },
  output: {
    path: resolve('test/dist1'),
    publicPath: '/',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules|dist*/,
        use: 'babel-loader',
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              modules: {
                exportLocalsConvention: 'camelCase',
                getLocalIdent: minifyCssIdents.getLocalIdent,
                // getLocalIdent: require('css-loader').defaultGetLocalIdent,
                localIdentName: '[path]___[name]__[local]',
                namedExport: false,
              },
            },
          },
          'postcss-loader',
        ],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'css/[name].[chunkhash].min.css',
    }),
    new SourceMapDevToolPlugin({
      exclude: /node_modules|dist-*/,
      columns: true,
      test: /\.js$/,
      filename: 'js/[name].[chunkhash].min.map',
    }),
    minifyCssIdents
  ],
  stats: 'errors-only',
};
