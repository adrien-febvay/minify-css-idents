# Dev
- Identifier generator greatly more efficient

# Version 0.5.0
- First ident generated is now the actual value of the "startsWith" option
- Function getLocalIdent accepts a custom function to make unminified identifiers
- New wrapper for css-loader with entrypoint in order to simplify Webpack's configuration greatly
- New package entrypoint for IdentGenerator

# Version 0.4.0
- Unminified idents are now made by css-loader's defaultGetLocalIdent
- New "enabled" option to toggle the plug-in, by default true on production
- Add "app" and "root" to default excluded identifiers
- Map filename can now be relative to Webpack's context
- Allow the getLocalIdent to be accessed statically from the plugin class
- Instanciating and registering the plug-in is now optional

# Version 0.3.0
- Use "compilation" and "afterProcessAssets" hooks instead of "afterEmit"
- Use "emitAsset" to generate map file

# Version 0.2.1
- Various configuration adjustments
- Add README file

# Version 0.2.0
- Test Webpack compilation
- Use "afterEmit" hook instead of "make"

# Version 0.1.0
- MinifyCssIdent plugin and loader
