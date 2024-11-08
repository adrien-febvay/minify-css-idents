import { IdentManager as OriginalIdentManager } from './IdentManager';

class IdentManager extends OriginalIdentManager {
  public expectIdent(ident: string, key = `test-${ident}`) {
    try {
      expect(this.generateIdent(key)).toBe(ident);
    } catch (error) {
      if (error instanceof Error) {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        Error.captureStackTrace(error, IdentManager.prototype.expectIdent);
      }
      throw error;
    }
  }

  public setLastIdent(lastIndent: string): this {
    this.lastIdent = lastIndent.split('');
    return this;
  }
}

const someOptions = {
  exclude: ['some-ident', 'some-ident-prefix-*'],
  startIdent: 'some-ident',
} as const;

describe('Check IdentManager class', () => {
  it('Options are defaulted', () => {
    const identManager = new IdentManager();
    expect(identManager.options).toMatchObject({
      exclude: ['app', 'root'],
      excludePrefix: ['ad'],
      startIdent: null,
    });
  });

  it('Options are resolved', () => {
    const identManager = new IdentManager(someOptions);
    expect(identManager.options).toMatchObject({
      ...someOptions,
      exclude: ['some-ident'],
      excludePrefix: ['some-ident-prefix-'],
    });
  });

  it('Invalid options are rejected', () => {
    expect(() => new IdentManager({ exclude: ['*'] })).toThrow(
      'Invalid "exclude" option\n  The * wildchar can only be used at the end of an identifier',
    );
  });

  it('Idents are incremented from "a" to "z"', () => {
    const identManager = new IdentManager();
    for (const char of IdentManager.alphabet) {
      if (isNaN(Number(char))) {
        identManager.expectIdent(char);
      }
    }
  });

  it('Idents are incremented from "z" to "az"', () => {
    const identManager = new IdentManager({ exclude: [], startIdent: 'z' });
    for (const char of IdentManager.alphabet) {
      identManager.expectIdent(`a${char}`);
    }
  });

  it('Idents are incremented from "az" to "b0"', () => {
    new IdentManager({ startIdent: 'az' }).expectIdent(`b0`);
  });

  it('Idents are incremented from "aNz" to "a(N + 1)z" or "b00"', () => {
    const identManager = new IdentManager({ exclude: [] });
    const { alphabet } = IdentManager;
    for (const char of alphabet) {
      if (isNaN(Number(char))) {
        const expectedChar = alphabet[alphabet.indexOf(char) + 1];
        const expectedIdent = expectedChar ? `a${expectedChar}0` : 'b00';
        identManager.setLastIdent(`a${char}z`).expectIdent(expectedIdent);
      }
    }
  });

  it('Idents are stored into and fetched from map', () => {
    const identManager = new IdentManager();
    identManager.expectIdent('a');
    identManager.expectIdent('b');
    identManager.expectIdent('a');
  });

  it('Idents/prefixes are excluded', () => {
    const identManager = new IdentManager({ exclude: ['a', 'ad*'] });
    expect(identManager.options).toMatchObject({ exclude: ['a'], excludePrefix: ['ad'] });
    identManager.expectIdent('b');
    identManager.setLastIdent('ac').expectIdent('ae');
    identManager.setLastIdent('acz').expectIdent('ae0');
    identManager.setLastIdent('aczz').expectIdent('ae00');
  });

  it('Ident map is loaded', () => {
    const identMap = { someIdent: 'a', otherIdent: 'bb', lastIdent: 'cc', postIdent: 'aa' };
    const identManager = new IdentManager();
    identManager.loadMap(identMap, 'some-file');
    expect(identManager.identMap).toStrictEqual(identMap);
    expect(identManager.lastIdent).toStrictEqual(['c', 'c']);
  });

  it('An invalid ident map is rejected', () => {
    const identManager = new IdentManager();
    const loadMap = () => identManager.loadMap(null, 'some-file');
    expect(loadMap).toThrow('Invalid CSS identifier map in some-file\n  Expected string dictionary, got null');
  });

  it('A map with invalid idents is rejected', () => {
    const longString = '................................................................................';
    const identManager = new IdentManager();
    const loadMap = () => identManager.loadMap({ 'a': null, 'b': [], 'c': 0, 'd': '0', 'e!': longString }, 'some-file');
    const details = '\n  a: null\n  b: array\n  c: number\n  d: "0"\n  "e!": string(80)';
    expect(loadMap).toThrow(`Invalid CSS identifier(s) in some-file${details}`);
  });
});
