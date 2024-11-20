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
            }
          },
          "postcss-loader"
        ]
      }
    ]
  }
};
```

Eventually, add the minifier to the plugins:

```js
const MinifyCssIdentsPlugin = require("minify-css-idents");
module.exports = {
  plugins: [
    new MinifyCssIdentsPlugin({
      filename: "path-to/idents.map.json",
      exclude: ["global-identifiers-here"]
    })
  ]
};
```

If your project has a unique build step and you don't want a map file to be emitted or specify any option, you may omit the plugin altogether. The loader will then instanciate one with the default options on its own.

## Options

Available options to specify in the instanciation of `MinifyCssIdentsPlugin`:

```js
new MinifyCssIdentsPlugin({
  enabled: true,
  exclude: ["some-ident", "some-ident-prefix-*"],
  filename: "path-to/idents.map.json",
  mapIndent: 2,
  mode: "default",
  startIdent: "some-minified-ident-to-start-with",
});
```

### options.enabled

Default value: `true` when Webpack is on production mode, `false` otherwise.

Enables the minifying of CSS identifiers. By default, the minifying is active on production mode for optimization, but disabled on development mode for debugging purposes.

It is also active by default if `MinifyCssIdentsPlugin` has not been registered in the "plugins" Webpack option, because then the minifyier has no mean to known in which mode Webpack is running.

### options.exclude

Default value: `["ad*", "app", "root"]`

Identifiers of identifier prefixes the minifier should not generate. You should put there all global identifiers your project uses that could match a minified one.

A global identifier is one that wouldn't get changed by `css-loaded`, either because it is wrapped by `:global()`, or because the CSS is not processed by [css-loader](https://www.npmjs.com/package/css-loader) to begin with (typically the stylesheet of an external module in which classnames are hard-coded).

You may also add there identifiers that may be problematics, like any identifier beginning with "ad".

Also, note that a global identifier/prefix longer than 10 characters, not beginning with a letter or having characters others than letters and digits cannot match a minified identifier. It is then not necessary to specify it in this option and it would be ignored anyway.

### options.filename

Default value: `null`

Pathname to the identifier map file. Useful if:
1. Your project has several build steps, using Webpack several times. Then the map file keeps the identifiers consistent across all steps.
2. You want a map file to be emitted anyway.

### options.mapIndent

Default value: `2`

The indentation size to use in the identifier map file. Set it to `0` if you want a minimal file without spaces and line returns.

### options.mode

Default value: `"default"`

Specify what to do with the identifier map file.

For instance, the first build step should only create then map, while the last one should only load it, and eventually delete it when done.

Possible values:

<table>
  <tr>
    <td><code>"default"</code></td>
    <td>Load the map if available, add newly generated identifiers if any</td>
  </tr>
  <tr>
    <td><code>"load-map"</code></td>
    <td>Only load the map</td>
  </tr>
  <tr>
    <td><code>"extend-map"</code></td>
    <td>Load the map, add newly generated identifiers if any</td>
  </tr>
  <tr>
    <td><code>"consume-map"</code></td>
    <td>Load the map, delete it when done</td>
  </tr>
  <tr>
    <td><code>"create-map"</code></td>
    <td>Only create the map with generated identifiers</td>
  </tr>
</table>

Please note that `"default"` is the only mode where the minifier won't throw an error if it doesn't find the map file when trying to load it.

The creation, update or deletion of the map will occur when Webpack is done processing assets.

### options.startIdent

Default value: `null`

Identifier to start the generation with.

Please note that this identifier will be skipped if it matches a value in the "exclude" option.

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

When `MinifyCssIdentsPlugin` is registered in Webpack's plug-ins, it has the opportunity to create, update and/or load an indentifier map file.
This feature is critical to keep the identifiers consistent across build steps.

It uses the `beforeCompile` hook of Webpack's compiler to read the map file, then the `compilation` and `afterProcessAssets` hooks to write/delete it.

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
