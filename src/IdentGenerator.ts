import { readFileSync } from 'fs';
import { MinifiyCssIdentsError } from './MinifiyCssIdentsError';
import { isDictLike, isError, type } from './utils';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';

export class IdentGenerator {
  public readonly options: IdentGenerator.Options.Resolved;
  public lastIdent: string[];
  public identMap: IdentGenerator.Map = {};

  public constructor(options?: IdentGenerator.Options | null) {
    if (options?.exclude?.filter((ident) => /^\*|\*./.test(ident)).length) {
      const details = 'The * wildchar can only be used at the end of an identifier';
      throw new MinifiyCssIdentsError('Invalid "exclude" option', details);
    }
    const excludePrefix = options?.exclude?.filter((ident) => /\*$/.test(ident));
    this.options = Object.freeze({
      exclude: options?.exclude?.filter((ident) => !/\*/.test(ident)) ?? ['app', 'root'],
      excludePrefix: excludePrefix?.map((ident) => ident.slice(0, -1)) ?? ['ad'],
      mapIndent: options?.mapIndent ?? 2,
      startIdent: options?.startIdent ?? null,
    });
    this.lastIdent = prevIdent(options?.startIdent ?? '');
    IdentGenerator.implicitInstance = this;
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

  public importMap(map: IdentGenerator.Map) {
    let maxIdent = this.lastIdent.join('');
    for (const key in map) {
      const ident = String(map[key]);
      if (ident.length > maxIdent.length || ident > maxIdent) {
        maxIdent = ident;
      }
      this.identMap[key] = ident;
    }
    this.lastIdent = maxIdent.split('');
  }

  public loadMap(filename: string, ignoreNoEnt?: boolean) {
    const mapBytes = readMap(filename, ignoreNoEnt);
    if (mapBytes !== null) {
      this.importMap(parseMap(mapBytes, filename));
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

  public stringifyMap(indent = this.options.mapIndent) {
    return `${JSON.stringify(this.identMap, null, indent)}\n`;
  }

  public static readonly Error = MinifiyCssIdentsError;

  public static readonly alphabet = alphabet;

  protected static implicitInstance?: IdentGenerator;

  public static generateIdent(key: string) {
    IdentGenerator.implicitInstance ??= new IdentGenerator();
    return IdentGenerator.implicitInstance.generateIdent(key);
  }
}

// eslint-disable-next-line @typescript-eslint/unbound-method
const loadMap = IdentGenerator.prototype.loadMap;

function parseMap(bytes: string, filename: string) {
  let data: unknown;
  try {
    data = JSON.parse(bytes);
  } catch (cause) {
    throw new MinifiyCssIdentsError(`Failure to parse ${filename}`, cause, loadMap);
  }
  const causes: string[] = [];
  if (!isDictLike(data)) {
    causes.push(`Expected string dictionary, got ${type(data)}`);
  } else {
    for (const key in data) {
      if (typeof data[key] !== 'string') {
        causes[0] ??= `Expected string dictionary, but:`;
        causes.push(`  - Item ${JSON.stringify(key)} is ${type(data[key])}`);
      }
    }
  }
  if (causes.length) {
    throw new MinifiyCssIdentsError(`Invalid CSS identifier map in ${filename}`, causes.join('\n'), loadMap);
  } else {
    return data as IdentGenerator.Map;
  }
}

function prevIdent(ident: string) {
  const prevIdent = ident
    .toLowerCase()
    .replace(/^\d+|[^\da-z]+/g, '')
    .split('');
  let offset = prevIdent.length - 1;
  do {
    prevIdent[offset] = alphabet[alphabet.indexOf(prevIdent[offset] ?? '') - 1] ?? 'z';
  } while (prevIdent[offset] === 'z' && --offset >= 0);
  if (prevIdent[0] === '9') {
    prevIdent.shift();
  }
  return prevIdent;
}

function readMap(filename: string, ignoreNoEnt?: boolean) {
  try {
    return readFileSync(filename, 'utf-8');
  } catch (cause) {
    if (ignoreNoEnt && isError(cause) && cause.code === 'ENOENT') {
      return null;
    } else {
      throw new MinifiyCssIdentsError(`Failure to read ${filename}`, cause, loadMap);
    }
  }
}

export namespace IdentGenerator {
  export type Error = MinifiyCssIdentsError;

  export type Map = { [Key in string]?: string };

  export interface Options {
    readonly exclude?: readonly string[] | null;
    readonly mapIndent?: number | null;
    readonly startIdent?: string | null;
  }

  export namespace Options {
    export interface Resolved {
      readonly exclude: readonly string[];
      readonly excludePrefix: readonly string[];
      readonly mapIndent: number;
      readonly startIdent: string | null;
    }
  }
}
