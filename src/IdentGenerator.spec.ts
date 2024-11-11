import { IdentGenerator as OriginalIdentGenerator } from './IdentGenerator';

class IdentGenerator extends OriginalIdentGenerator {
  public expectIdent(ident: string, key = `test-${ident}`) {
    try {
      expect(this.generateIdent(key)).toBe(ident);
    } catch (error) {
      if (error instanceof Error) {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        Error.captureStackTrace(error, IdentGenerator.prototype.expectIdent);
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

describe('Check IdentGenerator class', () => {
  it('Options are defaulted', () => {
    const identGenerator = new IdentGenerator();
    expect(identGenerator.options).toMatchObject({
      exclude: ['app', 'root'],
      excludePrefix: ['ad'],
      startIdent: null,
    });
  });

  it('Options are resolved', () => {
    const identGenerator = new IdentGenerator(someOptions);
    expect(identGenerator.options).toMatchObject({
      ...someOptions,
      exclude: ['some-ident'],
      excludePrefix: ['some-ident-prefix-'],
    });
  });

  it('Invalid options are rejected', () => {
    expect(() => new IdentGenerator({ exclude: ['*'] })).toThrow(
      'Invalid "exclude" option\n  The * wildchar can only be used at the end of an identifier',
    );
  });

  it('Idents are incremented from "a" to "z"', () => {
    const identGenerator = new IdentGenerator();
    for (const char of IdentGenerator.alphabet) {
      if (isNaN(Number(char))) {
        identGenerator.expectIdent(char);
      }
    }
  });

  it('Idents are incremented from "z" to "az"', () => {
    const identGenerator = new IdentGenerator({ exclude: [], startIdent: 'z' });
    for (const char of IdentGenerator.alphabet) {
      identGenerator.expectIdent(`a${char}`);
    }
  });

  it('Idents are incremented from "az" to "b0"', () => {
    new IdentGenerator({ startIdent: 'az' }).expectIdent(`b0`);
  });

  it('Idents are incremented from "aNz" to "a(N + 1)z" or "b00"', () => {
    const identGenerator = new IdentGenerator({ exclude: [] });
    const { alphabet } = IdentGenerator;
    for (const char of alphabet) {
      if (isNaN(Number(char))) {
        const expectedChar = alphabet[alphabet.indexOf(char) + 1];
        const expectedIdent = expectedChar ? `a${expectedChar}0` : 'b00';
        identGenerator.setLastIdent(`a${char}z`).expectIdent(expectedIdent);
      }
    }
  });

  it('Idents are stored into and fetched from map', () => {
    const identGenerator = new IdentGenerator();
    identGenerator.expectIdent('a');
    identGenerator.expectIdent('b');
    identGenerator.expectIdent('a');
  });

  it('Idents/prefixes are excluded', () => {
    const identGenerator = new IdentGenerator({ exclude: ['a', 'ad*'] });
    expect(identGenerator.options).toMatchObject({ exclude: ['a'], excludePrefix: ['ad'] });
    identGenerator.expectIdent('b');
    identGenerator.setLastIdent('ac').expectIdent('ae');
    identGenerator.setLastIdent('acz').expectIdent('ae0');
    identGenerator.setLastIdent('aczz').expectIdent('ae00');
  });

  it('Ident map is loaded', () => {
    const identMap = { someIdent: 'a', otherIdent: 'bb', lastIdent: 'cc', postIdent: 'aa' };
    const identGenerator = new IdentGenerator();
    identGenerator.loadMap(identMap, 'some-file');
    expect(identGenerator.identMap).toStrictEqual(identMap);
    expect(identGenerator.lastIdent).toStrictEqual(['c', 'c']);
  });

  it('An invalid ident map is rejected', () => {
    const identGenerator = new IdentGenerator();
    const loadMap = () => identGenerator.loadMap(null, 'some-file');
    expect(loadMap).toThrow('Invalid CSS identifier map in some-file\n  Expected string dictionary, got null');
  });

  it('A map with invalid idents is rejected', () => {
    const longString = '................................................................................';
    const someMap = { 'a': null, 'b': [], 'c': 0, 'd': '0', 'e!': longString };
    const identGenerator = new IdentGenerator();
    const loadMap = () => identGenerator.loadMap(someMap, 'some-file');
    const details = '\n  a: null\n  b: array\n  c: number\n  d: "0"\n  "e!": string(80)';
    expect(loadMap).toThrow(`Invalid CSS identifier(s) in some-file${details}`);
  });
});
