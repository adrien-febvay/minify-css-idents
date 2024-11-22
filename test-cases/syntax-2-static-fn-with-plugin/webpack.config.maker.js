const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const MinifyCssIdentsPlugin = require('minify-css-idents');
const dirs = require('../dirs');

function webpackConfig(index, mode) {
  const { context, entry, filename, localIdentContext, path } = dirs(__dirname, index);
  
  return {
    context,
    entry,
    mode: 'production',
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
            index === 1 ? MiniCssExtractPlugin.loader : 'style-loader',
            {
              loader: 'css-loader',
              options: {
                modules: {
                  exportLocalsConvention: 'camelCase',
                  getLocalIdent: MinifyCssIdentsPlugin.getLocalIdent,
                  localIdentContext,
                  localIdentName: '[path]___[name]__[local]',
                  namedExport: index === 1 ? false : void 0,
                },
              },
            },
            'postcss-loader',
          ],
        },
      ],
    },
    output: {
      clean: true,
      filename: 'index.js',
      path,
      publicPath: index === 1 ? '/' : void 0,
    },
    plugins: [
      ...(index === 1 ? [new MiniCssExtractPlugin({ filename: '[name].min.css' })] : []),
      new MinifyCssIdentsPlugin({ filename, mode }),
    ],
    resolve: {
      extensions: ['.js'],
    },
    stats: 'errors-only',
    target: 'node',
  };  
}

module.exports = webpackConfig;
