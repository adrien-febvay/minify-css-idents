import { MinifiyCssIdentsPluginError } from './Error';
import { isDictLike, type } from './utils';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';

export class IdentGenerator {
  public readonly options: IdentGenerator.Options.Resolved;
  public lastIdent: string[];
  public identMap: IdentGenerator.Map = {};

  public constructor(options?: IdentGenerator.Options | null) {
    if (options?.exclude?.filter((ident) => /^\*|\*./.test(ident)).length) {
      const details = 'The * wildchar can only be used at the end of an identifier';
      throw new MinifiyCssIdentsPluginError('Invalid "exclude" option', details);
    }
    const excludePrefix = options?.exclude?.filter((ident) => /\*$/.test(ident));
    this.options = Object.freeze({
      exclude: options?.exclude?.filter((ident) => !/\*/.test(ident)) ?? ['app', 'root'],
      excludePrefix: excludePrefix?.map((ident) => ident.slice(0, -1)) ?? ['ad'],
      startIdent: options?.startIdent ?? null,
    });
    this.lastIdent = options?.startIdent?.split('') ?? [];
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

  public loadMap(data: unknown, filename: string) {
    if (isDictLike(data)) {
      let lastIdent: string = '';
      let invalidIdents = '';
      for (const [key, ident] of Object.entries(data)) {
        if (typeof ident !== 'string' || !/^[a-z][^_\W]*$/i.test(ident)) {
          const strKey = `\n  ${/[^$\w]/.test(key) ? JSON.stringify(key) : key}: `;
          invalidIdents += `${strKey}${type(ident, 80 - strKey.length)}`;
        } else if (ident.length > lastIdent.length || ident > lastIdent) {
          lastIdent = ident;
        }
      }
      if (invalidIdents) {
        throw new MinifiyCssIdentsPluginError(`Invalid CSS identifier(s) in ${filename}${invalidIdents}`);
      }
      this.lastIdent = lastIdent.split('');
      this.identMap = data as IdentGenerator.Map;
    } else {
      const details = `Expected string dictionary, got ${type(data)}`;
      throw new MinifiyCssIdentsPluginError(`Invalid CSS identifier map in ${filename}`, details);
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

  public static readonly alphabet = alphabet;
}

export namespace IdentGenerator {
  export type Map = { [Key in string]?: string };

  export interface Options {
    readonly exclude?: readonly string[] | null;
    readonly startIdent?: string | null;
  }

  export namespace Options {
    export interface Resolved {
      readonly exclude: readonly string[];
      readonly excludePrefix: readonly string[];
      readonly startIdent: string | null;
    }
  }
}
