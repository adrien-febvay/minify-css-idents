# Dev
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
