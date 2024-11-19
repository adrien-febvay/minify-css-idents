import type { LoaderContext, PitchLoaderDefinitionFunction } from 'webpack';
import MinifyCssIdentsPlugin from '../MinifyCssIdentsPlugin';

function cssLoader(this: MinifyCssIdentsPlugin.LoaderContext, content: string) {
  const modules = this.getOptions().modules as NodeJS.Dict<unknown>;
  const getLocalIdent = (modules?.getLocalIdent as MinifyCssIdentsPlugin.GetLocalIdentFn) ?? defaultGetLocalIdent;
  return content.replace(/\S+/g, (localName) => getLocalIdent(this, '', localName, {}));
}

function defaultGetLocalIdent(context: LoaderContext<object>, _localIdentName: string, localName: string) {
  const chunks = context.resourcePath.split('/');
  const path = chunks.slice(0, -1).join('_');
  const name = chunks.at(-1)?.replace(/(?<!^)\..*/, '');
  return `${path}___${name}__${localName}`;
}

const pitch = void 0 as PitchLoaderDefinitionFunction | undefined;

// The IDE might detect a TS error here, but it is actually fine.
// It is because mocks are excluded from tsconfig.json (but included in tsconfig.eslint.json).
export = Object.assign(cssLoader, { defaultGetLocalIdent, pitch });
