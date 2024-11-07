const MinifiyCssIdentsPlugin = require('../dist');

const resolve = require('path').resolve.bind(null, __dirname, '..');

const minifyCssIdents = new MinifiyCssIdentsPlugin({
  context: resolve('test/src1'),
  filename: resolve('test/dist1/css/styles.map.json'),
  mode: 'consume-map',
});

module.exports = {
  context: resolve('test/src3'),
  entry: resolve('test/src3/index.js'),
  mode: 'production',
  target: 'node',
  node: { __dirname: true },
  optimization: { minimize: false },
  resolve: {
    extensions: ['.js'],
  },
  output: {
    path: resolve('test/dist3'),
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
