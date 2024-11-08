const MinifyCssIdentsPlugin = require('../dist/MinifyCssIdentsPlugin');

const resolve = require('path').resolve.bind(null, __dirname, '..');

const minifyCssIdents = new MinifyCssIdentsPlugin({
  context: resolve('test/src1'),
  filename: resolve('test/dist1/css/styles.map.json'),
  mode: 'extend-map',
});

module.exports = {
  context: resolve('test/src2'),
  entry: resolve('test/src2/index.js'),
  mode: 'production',
  target: 'node',
  node: { __dirname: true },
  optimization: { minimize: false },
  resolve: {
    extensions: ['.js'],
  },
  output: {
    path: resolve('test/dist2'),
    filename: 'index.js',
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
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: {
                exportLocalsConvention: 'camelCase',
                getLocalIdent: minifyCssIdents.getLocalIdent,
                localIdentContext: resolve('test/src1'),
                localIdentName: '[path]___[name]__[local]',
              },
            },
          },
          'postcss-loader',
        ],
      },
    ],
  },
  plugins: [
    minifyCssIdents
  ],
  stats: 'errors-only',
};
