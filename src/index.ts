import { readFileSync, rmSync } from 'fs';
import { isAbsolute, relative } from 'path';
import { Compilation, Compiler, Module, sources } from 'webpack';
import { IdentManager } from './IdentManager';
import { MinifiyCssIdentsPluginError } from './Error';
import { isError } from './utils';

function parseMap(filename: string, bytes: string) {
  try {
    return JSON.parse(bytes);
  } catch (cause) {
    throw new MinifiyCssIdentsPluginError(`Failure to parse ${filename}`, cause, parseMap);
  }
}

function readMap(filename: string, ignoreNoEnt?: boolean) {
  try {
    return readFileSync(filename, 'utf-8');
  } catch (cause) {
    if (ignoreNoEnt && isError(cause) && cause.code === 'ENOENT') {
      return null;
    } else {
      throw new MinifiyCssIdentsPluginError(`Failure to read ${filename}`, cause, parseMap);
    }
  }
}

function removeMap(filename: string) {
  try {
    rmSync(filename);
  } catch (cause) {
    // eslint-disable-next-line no-console
    console.warn(MinifiyCssIdentsPluginError.message(`Failure to remove CSS identifier map file ${filename}`, cause));
  }
}

class MinifiyCssIdentsPlugin extends Module {
  public readonly options: MinifiyCssIdentsPlugin.Options.Resolved;
  protected readonly identManager: IdentManager;
  protected applied = false;
  protected contextPath = '';

  public constructor(options?: MinifiyCssIdentsPlugin.Options) {
    super('css/minify-ident');
    this.identManager = new IdentManager(options);
    this.options = Object.freeze({
      context: options?.context ?? null,
      filename: options?.filename ?? null,
      mapIndent: options?.mapIndent ?? 2,
      mode: options?.mode ?? 'default',
      ...this.identManager.options,
    });
    this.getLocalIdent = this.getLocalIdent.bind(this);
  }

  public apply(compiler: Compiler) {
    if (!this.applied) {
      this.contextPath = this.options.context ?? compiler.context;
      const { filename, mode } = this.options;
      if (filename) {
        if (mode === 'default' || mode === 'load-map' || mode === 'extend-map' || mode === 'consume-map') {
          compiler.hooks.beforeCompile.tap(MinifiyCssIdentsPlugin.name, () =>
            this.loadMap(filename, mode === 'default'),
          );
        }
        if (mode !== 'load-map') {
          const { name } = MinifiyCssIdentsPlugin;
          compiler.hooks.compilation.tap(name, (compilation) => {
            const stage = Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE;
            compilation.hooks.afterProcessAssets.tap({ stage, name }, () => {
              if (mode === 'consume-map') {
                removeMap(filename);
              } else {
                const path = isAbsolute(filename) ? relative(compiler.context, filename) : filename;
                compilation.emitAsset(path, new sources.RawSource(this.stringifyMap()));
              }
            });
          });
        }
      }
      this.applied = true;
    }
  }

  public getLocalIdent(context: LoaderContext, _localIdentName: string, localName: string) {
    const resourcePath = relative(this.contextPath, context.resourcePath).replace(/\\/g, '/');
    return this.identManager.generateIdent(`${resourcePath}/${localName}`);
  }

  protected loadMap(filename: string, ignoreNoEnt?: boolean) {
    const mapBytes = readMap(filename, ignoreNoEnt);
    if (mapBytes !== null) {
      this.identManager.loadMap(parseMap(filename, mapBytes), filename);
    }
  }

  protected stringifyMap() {
    return `${JSON.stringify(this.identManager.identMap, null, this.options.mapIndent)}\n`;
  }

  public static readonly alphabet = IdentManager.alphabet;

  public static readonly Error = MinifiyCssIdentsPluginError;
}

namespace MinifiyCssIdentsPlugin {
  export type Error = MinifiyCssIdentsPluginError;

  export type Map = IdentManager.Map;

  export interface Options extends IdentManager.Options {
    context?: string | null;
    filename?: string | null;
    mapIndent?: number | null;
    mode?: 'default' | 'load-map' | 'extend-map' | 'consume-map' | 'create-map' | null;
  }

  export namespace Options {
    export interface Resolved extends IdentManager.Options.Resolved {
      context: string | null;
      filename: string | null;
      mapIndent: number;
      mode: 'default' | 'load-map' | 'extend-map' | 'consume-map' | 'create-map';
    }
  }
}

interface LoaderContext {
  resourcePath: string;
}

export = MinifiyCssIdentsPlugin;
