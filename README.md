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

First, import the minifier. 

```js
const MinifiyCssIdentsPlugin = require("minify-css-idents");
```

Then set `getLocalIdent` option of the `css-loader`.

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          {
            loader: "css-loader",
            options: {
              modules: {
                getLocalIdent: MinifiyCssIdentsPlugin.getLocalIdent,
              }
            }
          }
        ]
      }
    ]
  }
};
```

Finally, add the minifier instance to the plugins.

```js
module.exports = {
  plugins: [
    new MinifiyCssIdentsPlugin({
      filename: "path-to/idents.map.json",
      exclude: ["global-identifiers-here"]
    })
  ]
};
```

If your project has a unique build step, thus using Webpack a single time, and you don't want a map file to be emitted or specify any option, you may omit the last step.

## Options

Available options to specify in the instanciation of the minifier:

```js
const minifyCssIdentsPlugin = new MinifiyCssIdentsPlugin({
  enabled: true,
  exclude: ["some-ident", "some-ident-prefix-*"],
  filename: "path-to/idents.map.json",
  mapIndent: 2,
  mode: "default",
  startIdent: "some-minified-ident-to-start-with",
});
```

### options.enabled

Default value: `true` on production mode, `false` otherwise.

Enables the minifying of CSS identifiers. By default, the minifying is active on production mode for optimization, but disabled on development mode for debugging purposes.

It is also active by default if `MinifiyCssIdentsPlugin` has not been registered in the "plugins" Webpack option, because then the minifyier has no mean to known in which mode Webpack is running.

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

The identation size in the identifier map file. Set it to `0` if you don't want spaces and line returns.

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

Please note that `"default"` is the only mode where the minifier won't throw an error if the map doesn't exist.

The creation, update or deletion of the map will occur when Webpack is done emitting files.

### options.startIdent

Default value: `null`

Identifier to start the generation with. In example, if you set it to `"z"`, the first generated identifier will be `"a0"` (unless it is excluded in the options).

Future versions should actually return the identifier you specified as the first generated one instead of incrementing it right away.

### How the package works

It uses the `getLocalIdent` option of `css-loader` to replace the CSS identifiers with generated ones.

When registered in Webpack's plug-ins, it has the opportunity to create, update and/or load an indentifier map file.
This feature is critical to keep the identifiers consistent across build steps.

It uses the `beforeCompile` hook of Webpack's compiler to read the map file, then the `compilation` and`afterProcessAssets` hooks to write/delete it.

## Credits

### Author

Adrien Febvay https://github.com/adrien-febvay

### Special thanks

Gajus Kuizinas https://github.com/gajus <br>
For writing an article about [Reducing CSS bundle size 70% by cutting the class names and using scope isolation](https://medium.com/free-code-camp/reducing-css-bundle-size-70-by-cutting-the-class-names-and-using-scope-isolation-625440de600b).