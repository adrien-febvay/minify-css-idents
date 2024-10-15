import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, relative } from 'path';
import { Compiler, Module } from 'webpack';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';

export class MinifyCssIdentsError extends Error {
  public constructor(message: string, cause?: unknown, capture?: (...args: any[]) => void) {
    super(MinifyCssIdentsError.message(message, cause));
    if (capture) {
      Error.captureStackTrace(this, capture);
    }
  }

  public static message(message: string, cause?: unknown) {
    return cause === void 0 ? message : `${message}\n  ${String(cause).replace(/\n/g, '\n  ')}`;
  }
}

function isDictLike(value: unknown): value is NodeJS.Dict<unknown> {
  return value ? typeof value === 'object' : false;
}

function isError(value: unknown): value is Error & { code: unknown } {
  return value instanceof Error;
}

function parseMap(filename: string, bytes: string) {
  try {
    return JSON.parse(bytes);
  } catch (cause) {
    throw new MinifyCssIdentsError(`Failure to parse ${filename}`, cause, parseMap);
  }
}

function readMap(filename: string, ignoreNoEnt?: boolean) {
  try {
    return readFileSync(filename, 'utf-8');
  } catch (cause) {
    if (ignoreNoEnt && isError(cause) && cause.code === 'ENOENT') {
      return null;
    } else {
      throw new MinifyCssIdentsError(`Failure to read ${filename}`, cause, parseMap);
    }
  }
}

function type(value: unknown, limit?: number) {
  if (typeof value === 'string') {
    const str = JSON.stringify(value);
    return limit != null && str.length > limit ? `string(${value.length})` : str;
  } else {
    return value === null ? 'null' : value instanceof Array ? 'array' : typeof value;
  }
}

export class MinifyCssIdents extends Module {
  public readonly options: MinifyCssIdents.Options.Resolved;
  protected lastIdent: string[];
  protected identMap: MinifyCssIdents.Map = {};
  protected applied = false;
  protected contextPath = '';

  public constructor(options?: MinifyCssIdents.Options) {
    super('css/minify-ident');
    if (options?.exclude?.filter((ident) => /^\*|\*./.test(ident)).length) {
      const details = 'The * wildchar can only be used at the end of an identifier';
      throw new MinifyCssIdentsError('Invalid "exclude" option', details);
    }
    const excludePrefix = options?.exclude?.filter((ident) => /\*$/.test(ident));
    this.options = Object.freeze({
      context: options?.context ?? null,
      exclude: options?.exclude?.filter((ident) => !/\*/.test(ident)) ?? [],
      excludePrefix: excludePrefix?.map((ident) => ident.slice(0, -1)) ?? ['ad'],
      filename: options?.filename ?? null,
      mapIndent: options?.mapIndent ?? 2,
      mode: options?.mode ?? 'default',
      startIdent: options?.startIdent ?? null,
    });
    this.lastIdent = options?.startIdent?.split('') ?? [];
    this.getLocalIdent = this.getLocalIdent.bind(this);
  }

  public apply(compiler: Compiler) {
    if (!this.applied) {
      this.contextPath = this.options.context ?? compiler.context;
      const { filename, mode } = this.options;
      if (filename) {
        if (mode === 'default' || mode === 'load-map' || mode === 'extend-map' || mode === 'consume-map') {
          compiler.hooks.beforeCompile.tap(MinifyCssIdents.name, () => this.loadMap(filename, mode === 'default'));
        }
        if (mode !== 'load-map') {
          const action = () => (mode === 'consume-map' ? this.removeMap(filename) : this.saveMap(filename));
          compiler.hooks.afterEmit.tap(MinifyCssIdents.name, action);
        }
      }
      this.applied = true;
    }
  }

  protected checkMap(value: unknown) {
    if (isDictLike(value)) {
      let lastIdent: string = '';
      let invalidIdents = '';
      for (const [key, ident] of Object.entries(value)) {
        if (typeof ident !== 'string' || !/^[a-z][^_\W]*$/i.test(ident)) {
          const strKey = `\n  ${/[^$\w]/.test(key) ? JSON.stringify(key) : key}: `;
          invalidIdents += `${strKey}${type(ident, 80 - strKey.length)}`;
        } else if (ident.length > lastIdent.length || ident > lastIdent) {
          lastIdent = ident;
        }
      }
      if (invalidIdents) {
        throw new MinifyCssIdentsError(`Invalid CSS identifier(s) in ${this.options.filename}${invalidIdents}`);
      }
      this.lastIdent = lastIdent.split('');
      return value as MinifyCssIdents.Map;
    } else {
      const details = `Expected string dictionary, got ${type(value)}`;
      throw new MinifyCssIdentsError(`Invalid CSS identifier map in ${this.options.filename}`, details);
    }
  }

  public generateIdent(key: string) {
    let ident = this.identMap[key];
    if (!ident) {
      let { lastIdent } = this;
      let offset = -1;
      do {
        offset = ~offset ? offset : lastIdent.length;
        do {
          const char = lastIdent[(offset -= 1)] ?? '';
          if (offset >= 0) {
            lastIdent[offset] = alphabet[alphabet.indexOf(char) + 1] ?? '0';
          } else {
            lastIdent = ['a', ...lastIdent.map(() => '0')];
          }
        } while (offset >= 0 && (lastIdent[offset] === '0' || lastIdent[0] === '0'));
        ident = lastIdent.join('');
        offset = this.prefixIndex(ident);
      } while (offset >= 0 || this.options.exclude.includes(ident));
      this.identMap[key] = ident;
      this.lastIdent = lastIdent;
    }
    return ident;
  }

  public getLocalIdent(context: LoaderContext, _localIdentName: string, localName: string) {
    const resourcePath = relative(this.contextPath, context.resourcePath).replace(/\\/g, '/');
    return this.generateIdent(`${resourcePath}/${localName}`);
  }

  protected loadMap(filename: string, ignoreNoEnt?: boolean) {
    const mapBytes = readMap(filename, ignoreNoEnt);
    if (mapBytes !== null) {
      this.identMap = this.checkMap(parseMap(filename, mapBytes));
    }
  }

  protected prefixIndex(ident: string) {
    for (const prefix of this.options.excludePrefix) {
      if (ident.startsWith(prefix)) {
        return prefix.length;
      }
    }
    return -1;
  }

  protected removeMap(filename: string) {
    try {
      rmSync(filename);
    } catch (cause) {
      // eslint-disable-next-line no-console
      console.warn(MinifyCssIdentsError.message(`Failure to remove CSS identifier map file ${filename}`, cause));
    }
  }

  protected saveMap(filename: string) {
    const path = dirname(filename);
    try {
      mkdirSync(path, { recursive: true });
    } catch (cause) {
      // eslint-disable-next-line no-console
      console.warn(MinifyCssIdentsError.message(`Failure to create directory ${path}`, cause));
    }
    try {
      writeFileSync(filename, JSON.stringify(this.identMap, null, this.options.mapIndent), 'utf-8');
    } catch (cause) {
      throw new MinifyCssIdentsError(`Failure to write CSS identifier map ${filename}`, cause);
    }
  }

  public static readonly alphabet = alphabet;
}

export namespace MinifyCssIdents {
  export type Map = { [Key in string]?: string };

  export interface Options {
    context?: string | null;
    exclude?: readonly string[] | null;
    filename?: string | null;
    mapIndent?: number | null;
    mode?: 'default' | 'load-map' | 'extend-map' | 'consume-map' | 'create-map' | null;
    startIdent?: string | null;
  }

  export namespace Options {
    export interface Resolved {
      context: string | null;
      exclude: readonly string[];
      excludePrefix: readonly string[];
      filename: string | null;
      mapIndent: number;
      mode: 'default' | 'load-map' | 'extend-map' | 'consume-map' | 'create-map';
      startIdent: string | null;
    }
  }
}

interface LoaderContext {
  resourcePath: string;
}
