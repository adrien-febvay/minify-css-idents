# Minify CSS Identifiers

![CI Tests status](https://github.com/adrien-febvay/minify-css-idents/actions/workflows/ci-tests.yml/badge.svg)

A Webpack plug-in to shorten identifiers to make CSS files lighter.

## Disclaimer: package still in development stage

The solutions it uses are not optimal yet:
- At the moment it uses `css-loader` to do its job, instead of having a loader of its own.
- It cannot detect global CSS identifiers yet, which must therefore be declared in the options.

This package will be improved over time. In the meantime, while it seems to do its job correctly,
it may not work as intended with all building solutions.

All suggestions are welcome, should you have any idea for a feature or
insight about how this package should operate, especially when it comes to
how it should interact with Webpack.

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

### Alternative syntax

Should `minify-css-idents/css-loader` not work properly, or should your configuration not allow its use, you may rely on the `MinifyCssIdentsPlugin.getLocalIdent` function, ie:


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

If you already rely on a custom `getLocalIdent` function to generate unminified CSS identifiers, you may specify it:

```js
  modules: {
    getLocalIdent: MinifyCssIdentsPlugin.getLocalIdent(your_former_getLocalIdent_here)
  }
```


## Options

Available options to specify in the instanciation of the minifier:

```js
const minifyCssIdentsPlugin = new MinifyCssIdentsPlugin({
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

Default value: `["app", "root", "ad*"]`

Identifiers of identifier prefixes the minifier should not generate. For instance, by default the minifier won't generate any identifier "app", "root", or starting with "ad".

You should put there all global identifiers your project use, meaning all identifiers that wouldn't get changed by `css-loaded`.

You may also add there identifiers that may be problematics, like `ad*`.

While the risk of generating an identifier already used as a global one is very low (it cannot happen if you have less than 900 generated identifiers and your shorter global identifier has 3 characters), you should set this options to cover your bases.

Future versions of this package should offer better means to avoid overlapping with global identifiers.

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

The creation, update or deletion of the map will occur when Webpack is done precessing assets.

### options.startIdent

Default value: `null`

Identifier to start the generation with.

Note: Will be skipped if excluded in the options.

## How the package works

The `minify-css-idents/css-loader` wraps `css-loader` in order to override its [getLocalIdent](https://webpack.js.org/loaders/css-loader/#getlocalident) option, which allows to specify a function to generate CSS identifiers.

Before generating a minified identifier, the `MinifyCssIdentsPlugin.getLocalIdent` generates an unminified one as `css-loader` would, using the [getLocalIdent](https://webpack.js.org/loaders/css-loader/#getlocalident) function specified, or the default one.

When `MinifyCssIdentsPlugin` is registered in Webpack's plug-ins, it has the opportunity to create, update and/or load an indentifier map file.
This feature is critical to keep the identifiers consistent across build steps.

It uses the `beforeCompile` hook of Webpack's compiler to read the map file, then the `compilation` and `afterProcessAssets` hooks to write/delete it.

## Credits

### Author

Adrien Febvay https://github.com/adrien-febvay

### Special thanks

Gajus Kuizinas https://github.com/gajus <br>
For writing an article about [Reducing CSS bundle size 70% by cutting the class names and using scope isolation](https://medium.com/free-code-camp/reducing-css-bundle-size-70-by-cutting-the-class-names-and-using-scope-isolation-625440de600b).