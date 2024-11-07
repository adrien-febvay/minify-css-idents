declare module 'css-loader' {
  import type { LoaderContext, LoaderDefinition } from 'webpack';
  const cssLoader: LoaderDefinition & {
    defaultGetLocalIdent(context: LoaderContext<object>, localIdentName: string, localName: string, options: object): string;
  };
  export = cssLoader;
}
