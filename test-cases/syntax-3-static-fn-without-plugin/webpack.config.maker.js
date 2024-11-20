const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const MinifyCssIdentsPlugin = require('minify-css-idents');
const dirs = require('../dirs');

function webpackConfig(index, mode) {
  const { context, entry, path } = dirs(__dirname, '', index);
  
  return {
    context,
    entry,
    mode,
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
                  getLocalIdent: MinifyCssIdentsPlugin.getLocalIdent,
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
    optimization: { minimize: false },
    output: {
      clean: true,
      filename: 'index.js',
      path,
      publicPath: '/',
    },
    plugins: [
      new MiniCssExtractPlugin({ filename: '[name].min.css' }),
    ],
    resolve: {
      extensions: ['.js'],
    },
    stats: 'errors-only',
    target: 'node',
  };  
}

module.exports = webpackConfig;
