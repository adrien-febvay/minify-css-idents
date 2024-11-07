import type { LoaderContext } from 'webpack';

function defaultGetLocalIdent(context: LoaderContext<object>, _localIdentName: string, localName: string) {
  return `___${context.resourcePath}__${localName}`;
}

// The IDE might detect a TS error here, but it is actually fine.
export = { defaultGetLocalIdent };
