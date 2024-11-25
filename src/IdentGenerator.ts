import { readFileSync } from 'fs';
import { MinifyCssIdentsError } from './MinifyCssIdentsError';
import { Falsy, isDictLike, isTruthy, isError, type } from './utils';

const MAX_IDENT_INDEX = 3656158440062975;
const MAX_REPEATABLE_RANGE_INDEX = 101559956668415;
const noRange = [Infinity, Infinity] as const;

class IdentGenerator {
  public readonly options: IdentGenerator.Options.Sanitized;
  protected readonly excludeRanges: [Range, ...Range[]] = [[1, 10, true], noRange];
  protected currExcludeRange: Range = noRange;
  protected currIdentIndex: number;
  public identMap: IdentGenerator.Map = {};

  public constructor(options?: IdentGenerator.Options | null) {
    if (options?.exclude && options.exclude.filter((ident) => /^\*|\*./.test(ident || '')).length) {
      const details = 'The * wildchar can only be used at the end of an identifier';
      throw new MinifyCssIdentsError('Invalid "exclude" option', details);
    }
    this.options = Object.freeze({
      exclude: IdentGenerator.sanitizeExclusions(options?.exclude) ?? ['ad*', 'app', 'root'],
      mapIndent: options?.mapIndent || 2,
      startIdent: options?.startIdent || null,
    });
    this.currIdentIndex = IdentGenerator.parseIdent(options?.startIdent || '') - 1 || 0;
    for (const item of this.options.exclude) {
      const isPrefix = item.slice(-1) === '*';
      const ident = isPrefix ? item.slice(0, -1) : item;
      const startIndex = parseInt(ident, 36);
      this.addExcludeRange([startIndex, startIndex + 1, isPrefix]);
    }
    this.nextExcludeRange();
    IdentGenerator.implicitInstance = this;
  }

  public get lastIdent() {
    return this.currIdentIndex.toString(36);
  }

  protected addExcludeRange(newRange: Range) {
    const { excludeRanges } = this;
    const [newStartIndex] = newRange;
    let rangeIndex = 0;
    for (const [startIndex] of excludeRanges) {
      if (newStartIndex < startIndex) {
        break;
      } else {
        rangeIndex += 1;
      }
    }
    excludeRanges.splice(rangeIndex, 0, newRange);
  }

  public generateIdent(key: string) {
    let identIndex = this.currIdentIndex;
    if (this.identMap[key]) {
      return this.identMap[key];
    } else if (identIndex >= MAX_IDENT_INDEX) {
      return key;
    } else {
      identIndex += 1;
      for (let [start, end] = this.currExcludeRange; identIndex >= start; [start, end] = this.nextExcludeRange()) {
        identIndex = end > identIndex ? end : identIndex;
      }
      this.currIdentIndex = identIndex;
      return (this.identMap[key] = this.lastIdent);
    }
  }

  public importMap(map: IdentGenerator.Map) {
    let maxIdent = this.lastIdent;
    for (const key in map) {
      const ident = map[key];
      if (typeof ident === 'string') {
        if ((ident.length > maxIdent.length || ident > maxIdent) && IdentGenerator.identRx.test(ident)) {
          maxIdent = ident;
        }
        this.identMap[key] = ident;
      }
    }
    this.currIdentIndex = parseInt(maxIdent, 36);
  }

  public loadMap(filename: string, ignoreNoEnt?: boolean) {
    const mapBytes = readMap(filename, ignoreNoEnt);
    if (mapBytes !== null) {
      this.importMap(parseMap(mapBytes, filename));
    }
  }

  protected nextExcludeRange() {
    this.currExcludeRange = this.excludeRanges[0];
    this.excludeRanges.shift();
    const [startIndex, endIndex, repeat] = this.currExcludeRange;
    if (repeat && startIndex < MAX_REPEATABLE_RANGE_INDEX) {
      this.addExcludeRange([startIndex * 36, endIndex * 36, true]);
    }
    return this.currExcludeRange;
  }

  public stringifyMap(indent = this.options.mapIndent) {
    return `${JSON.stringify(this.identMap, null, indent)}\n`;
  }

  public static readonly Error = MinifyCssIdentsError;

  public static readonly identRx = /^[a-z][^\W_]{0,9}\*?$/i;

  protected static implicitInstance?: IdentGenerator;

  public static generateIdent(key: string) {
    IdentGenerator.implicitInstance ??= new IdentGenerator();
    return IdentGenerator.implicitInstance.generateIdent(key);
  }

  public static parseIdent(ident: string) {
    return this.identRx.test(ident) ? parseInt(ident, 36) : NaN;
  }

  public static sanitizeExclusions(excludeOption: Falsy<readonly Falsy<string>[]>) {
    if (excludeOption) {
      return excludeOption
        .filter(isTruthy)
        .filter((ident) => this.identRx.test(ident))
        .map((ident) => ident.toLowerCase())
        .sort((a, b) => {
          const aPrfx = a.slice(-1) === '*';
          const bPrfx = b.slice(-1) === '*';
          const aId = aPrfx ? a.slice(0, -1) : a;
          const bId = bPrfx ? b.slice(0, -1) : b;
          return aId.length - bId.length || (aId > bId ? 1 : aId < bId ? -1 : Number(bPrfx) - Number(aPrfx));
        })
        .filter((ident, index, idents) => {
          for (const otherIdent of idents.slice(0, index)) {
            if (otherIdent.slice(-1) === '*' ? ident.startsWith(otherIdent.slice(0, -1)) : ident === otherIdent) {
              return false;
            }
          }
          return true;
        });
    } else {
      return null;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/unbound-method
const loadMap = IdentGenerator.prototype.loadMap;

function parseMap(bytes: string, filename: string) {
  let data: unknown;
  try {
    data = JSON.parse(bytes);
  } catch (cause) {
    throw new MinifyCssIdentsError(`Failure to parse ${filename}`, cause, loadMap);
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
    throw new MinifyCssIdentsError(`Invalid CSS identifier map in ${filename}`, causes.join('\n'), loadMap);
  } else {
    return data as IdentGenerator.Map;
  }
}

function readMap(filename: string, ignoreNoEnt?: boolean) {
  try {
    return readFileSync(filename, 'utf-8');
  } catch (cause) {
    if (ignoreNoEnt && isError(cause) && cause.code === 'ENOENT') {
      return null;
    } else {
      throw new MinifyCssIdentsError(`Failure to read ${filename}`, cause, loadMap);
    }
  }
}

namespace IdentGenerator {
  export type Error = MinifyCssIdentsError;

  export type Map = { [Key in string]?: string };

  export interface Options {
    readonly exclude?: Falsy<readonly Falsy<string>[]>;
    readonly mapIndent?: Falsy<number>;
    readonly startIdent?: Falsy<string>;
  }

  export namespace Options {
    export interface Sanitized {
      readonly exclude: readonly string[];
      readonly mapIndent: number;
      readonly startIdent: string | null;
    }
  }
}

type Range = readonly [startIndex: number, endIndex: number, repeat?: boolean];

export = IdentGenerator;
