# Minify CSS Identifiers

![CI Tests status](https://github.com/adrien-febvay/minify-css-idents/actions/workflows/ci-tests.yml/badge.svg)

Webpack plug-in using [css-loader](https://www.npmjs.com/package/css-loader) to shorten identifiers and make CSS files lighter.

For maximum efficiency, also use a CSS minifier like [css-minimizer-webpack-plugin/](https://webpack.js.org/plugins/css-minimizer-webpack-plugin/).

## Setup

### Installation

```sh
npm install --save-dev minify-css-idents
```

### Webpack configuration

This is the typical configuration that should be compatible all use cases.

Just replace the `css-loader` with `minify-css-idents/css-loader`, ie:

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          "style-loader",
          {
            loader: "minify-css-idents/css-loader",
            options: {
              // Your usual css-loader configuration here,
              // to setup how to build unminified CSS identifiers
              // consistently accross all build steps
              modules:  {
                localIdentContext: 'common-path-for-all-build-steps',
                localIdentName: '[path]___[name]__[local]',
              }
            }
          },
          "postcss-loader"
        ]
      }
    ]
  }
};
```

Then add the minifier to the plugins:

```js
const MinifyCssIdentsPlugin = require("minify-css-idents");
module.exports = {
  plugins: [
    new MinifyCssIdentsPlugin({
      exclude: ["global-identifiers-here"],
      inputMap: "path-to-prior/idents-map.json",
      outputMap: "path-to-new/idents-map.json",
    })
  ]
};
```

## Options

Available options to specify in the instanciation of `MinifyCssIdentsPlugin`:

```js
new MinifyCssIdentsPlugin({
  enabled: true,
  exclude: ["some-ident", "some-ident-prefix-*"],
  inputMap: "path-to-prior/idents.map.json",
  mapIndent: 2,
  outputMap: "path-to-new/idents.map.json",
  startIdent: "some-minified-ident-to-start-with",
});
```

### options.enabled

Default value: Webpack's [optimization.minimize](https://webpack.js.org/configuration/optimization/#optimizationminimize) option value when set, otherwise `true` when [mode](https://webpack.js.org/configuration/mode/) is set to "production" or omitted and `false` in any other mode.

Enables/disables the minification of CSS identifiers.

### options.exclude

Default value: `["ad*", "app", "root"]`

Identifiers of identifier prefixes the minifier should not generate. You should put there all global identifiers your project uses that could match a minified one.

A global identifier is one that wouldn't get changed by `css-loaded`, either because it is wrapped by `:global()`, or because the CSS is not processed by [css-loader](https://www.npmjs.com/package/css-loader) to begin with (typically the stylesheet of an external module in which classnames are hard-coded).

You may also add there identifiers that may be problematics, like any identifier beginning with "ad".

Also, note that a global identifier/prefix longer than 10 characters, not beginning with a letter or having characters others than letters and digits cannot match a minified identifier. It is then not necessary to specify it in this option and it would be ignored anyway.

### options.inputMap

Default value: `null`

Pathname to the identifier map file of the previous build step, relative to Webpack's context path.

If your project has several build steps, loading the previously emitted map is needed in order to keep the identifiers consistent.

### options.mapIndent

Default value: `2`

The indentation size to use in the identifier map file. Set it to `0` if you want a minimal file without spaces and line returns.

### options.outputMap

Default value: `null`

Pathname to the identifier map file to emit, relative to Webpack's output path.

If your project has several build steps, emitting a map for the next build step is needed in order to keep the identifiers consistent.

### options.startIdent

Default value: `null`

Identifier to start the generation with.

Please note that this identifier will be skipped if it matches a value in the "exclude" option, and ignored if it is not valid.

## Alternative syntax

Should `minify-css-idents/css-loader` not work properly or should your configuration not allow to use it, you may rely on the `MinifyCssIdentsPlugin.getLocalIdent` function, ie:

```js
const MinifyCssIdentsPlugin = require("minify-css-idents");
module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          "style-loader",
          {
            loader: "css-loader",
            options: {
              modules: {
                getLocalIdent: MinifyCssIdentsPlugin.getLocalIdent
              }
            }
          },
          "postcss-loader"
        ]
      }
    ]
  }
};
```

If you already rely on a custom [getLocalIdent](https://webpack.js.org/loaders/css-loader/#getlocalident) function to generate unminified CSS identifiers, you may specify it:

```js
  modules: {
    getLocalIdent: MinifyCssIdentsPlugin.getLocalIdent(your_former_getLocalIdent_here)
  }
```

## How the package works and additional notes

### About the loader

The `minify-css-idents/css-loader` wraps [css-loader](https://www.npmjs.com/package/css-loader) in order to override its [getLocalIdent](https://webpack.js.org/loaders/css-loader/#getlocalident) option, which allows to specify a function to generate CSS identifiers.

### About CSS identifiers generation

A minified identifier is a positive integer number representation in base 36 not beginning with a digit. Because of JavaScript's integer limitations (see [Number.MAX_SAFE_INTEGER](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)), they are limited to 10 characters. It matches the regular expression `/^[a-z][0-9a-z]{0,9}$/i`.

In simpler terms, a minified identifier is a letter eventually followed by up to 9 letters and digits.

Before generating a minified identifier, the `MinifyCssIdentsPlugin.getLocalIdent` function generates an unminified one just as [css-loader](https://www.npmjs.com/package/css-loader) would, using the [getLocalIdent](https://webpack.js.org/loaders/css-loader/#getlocalident) function specified in the loader options, or the default one provided with [css-loader](https://www.npmjs.com/package/css-loader).

### About the plugin

When `MinifyCssIdentsPlugin` is registered in Webpack's plug-ins, it has the opportunity to emit and/or load an identifier map file.
This feature is critical to keep the identifiers consistent across build steps.

It uses the `beforeCompile` hook of Webpack's compiler to load the prior map, then the `thisCompilation` and`afterProcessAssets` hooks, at the stage `PROCESS_ASSETS_STAGE_ADDITIONAL`, to emit the new map.

When `MinifyCssIdentsPlugin` is omitted, it will instanciate automatically with its default options. However, it might not be able to detect the value of Webpack's [optimization.minimize](https://webpack.js.org/configuration/optimization/#optimizationminimize) option in the future, as the way of accessing the compiler's options from a loader is deprecated.

### About the "exclude" option

It does not accept regular expressions for two reasons:
1. Lack of efficiency: Every generated identifier would be matched with every provided RegExp. By only accepting string identifiers and prefixes, the identifier generator can instead plan in advance for which identifiers it must avoid and do so very efficiently.
2. Probably useless: Because of the format of minified identifiers, there shouldn't be a lot of exclusions to specify to begin with. Handling regular expressions therefore seems like an overkill.

Such a feature could be developed on request, but at the moment it just seems unecessary.

## Credits

### Author

Adrien Febvay https://github.com/adrien-febvay

### Special thanks

Gajus Kuizinas https://github.com/gajus <br>
For writing an article about [Reducing CSS bundle size 70% by cutting the class names and using scope isolation](https://medium.com/free-code-camp/reducing-css-bundle-size-70-by-cutting-the-class-names-and-using-scope-isolation-625440de600b).
