import originalFs from 'fs';
import { IdentGenerator } from './__mocks__/IdentGenerator';

jest.mock('fs');
const fs = jest.requireMock<{ [Key in keyof typeof originalFs]: jest.Mock }>('fs');

const someOptions = {
  exclude: ['someident', 'someprefix*'],
  mapIndent: 4,
  startIdent: 'some-ident',
} as const;

describe('Check IdentGenerator class', () => {
  it('Instance is registered and defaulted', () => {
    const fn = () => IdentGenerator.generateIdent('some-ident');
    expect(fn).not.toThrow();
    expect(IdentGenerator.implicitInstance).not.toBe(void 0);
    expect(fn).not.toThrow();
  });

  it('Options are defaulted', () => {
    const identGenerator = new IdentGenerator();
    expect(identGenerator.options).toStrictEqual({
      exclude: ['ad*', 'app', 'root'],
      mapIndent: 2,
      startIdent: null,
    });
  });

  it('Options are resolved', () => {
    const identGenerator = new IdentGenerator(someOptions);
    expect(identGenerator.options).toStrictEqual(someOptions);
  });

  it('Options "exclude" is sanitized', () => {
    const exclude = ['ahf', 'ef0', 'b', 'c', 'egi', 'a*', 'bhi', 'c', 'a', 'a*', ''];
    const identGenerator = new IdentGenerator({ exclude });
    expect(identGenerator.options.exclude).toStrictEqual(['a*', 'b', 'c', 'bhi', 'ef0', 'egi']);
  });

  it('Invalid options are rejected', () => {
    expect(() => new IdentGenerator({ exclude: ['*'] })).toThrow(
      'Invalid "exclude" option\n  The * wildchar can only be used at the end of an identifier',
    );
  });

  it('Option startIdent works as intended', () => {
    new IdentGenerator({ startIdent: '' }).expectIdent('a');
    new IdentGenerator({ startIdent: '-' }).expectIdent('a');
    new IdentGenerator({ startIdent: 'a' }).expectIdent('a');
    new IdentGenerator({ startIdent: 'a0' }).expectIdent('a0');
    new IdentGenerator({ startIdent: 'ad' }).expectIdent('ae');
    new IdentGenerator({ startIdent: 'ad0' }).expectIdent('ae0');
  });

  it('Idents are incremented correctly', () => {
    const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
    const identGenerator = new IdentGenerator({ exclude: [] });
    for (const char of alphabet.slice(10)) {
      identGenerator.expectIdent(char);
    }
    for (const char of alphabet) {
      identGenerator.expectIdent(`a${char}`);
    }
    identGenerator.expectIdent(`b0`);
    for (const char of alphabet.slice(10)) {
      const expectedChar = alphabet[alphabet.indexOf(char) + 1];
      const expectedIdent = expectedChar ? `a${expectedChar}0` : 'b00';
      identGenerator.setLastIdent(`a${char}z`).expectIdent(expectedIdent);
    }
  });

  it('Idents/prefixes are excluded', () => {
    const identGenerator = new IdentGenerator({ exclude: ['a', 'ad*'] });
    identGenerator.expectIdent('b');
    identGenerator.setLastIdent('ac').expectIdent('ae');
    identGenerator.setLastIdent('acz').expectIdent('ae0');
    identGenerator.setLastIdent('aczz').expectIdent('ae00');
  });

  it('Idents are not transformed when hitting Number.MAX_SAFE_INTEGER', () => {
    const identGenerator = new IdentGenerator();
    identGenerator.setLastIdent('zzzzzzzzzz').expectIdent('unminified-ident', 'unminified-ident');
  });

  it('Idents are stored into and fetched from map', () => {
    const identGenerator = new IdentGenerator();
    identGenerator.expectIdent('a');
    identGenerator.expectIdent('b');
    identGenerator.expectIdent('a');
  });

  it('Ident map is loaded', () => {
    const identMap = { someIdent: 'a', otherIdent: 'bb', lastIdent: 'cc', postIdent: 'aa' };
    fs.readFileSync.mockImplementation(() => JSON.stringify(identMap));
    const identGenerator = new IdentGenerator();
    identGenerator.loadMap('some-file');
    expect(identGenerator.identMap).toStrictEqual(identMap);
    expect(identGenerator.lastIdent).toStrictEqual('cc');
  });

  it('A non-existing ident map is ignored', () => {
    fs.readFileSync.mockImplementation(() => {
      throw Object.assign(new Error(), { code: 'ENOENT' });
    });
    const identGenerator = new IdentGenerator();
    expect(() => identGenerator.loadMap('some-file', true)).not.toThrow();
  });

  it('A non-readable ident map is rejected', () => {
    fs.readFileSync.mockImplementation(() => {
      throw Object.assign(new Error(), { code: 'ENOENT' });
    });
    const identGenerator = new IdentGenerator();
    expect(() => identGenerator.loadMap('some-file')).toThrow(`Failure to read some-file\n  Error`);
  });

  it('A non-parsable ident map is rejected', () => {
    fs.readFileSync.mockImplementation(() => 'non-json');
    const identGenerator = new IdentGenerator();
    expect(() => identGenerator.loadMap('some-file')).toThrow(/^Failure to parse some-file\n {2}SyntaxError: /);
  });

  it('An invalid ident map is rejected', () => {
    fs.readFileSync.mockImplementation(() => 'null');
    const identGenerator = new IdentGenerator();
    const loadMap = () => identGenerator.loadMap('some-file');
    expect(loadMap).toThrow('Invalid CSS identifier map in some-file\n  Expected string dictionary, got null');
  });

  it('An ident map with invalid items is rejected', () => {
    const identMap = { a: [], b: 0, c: {} };
    fs.readFileSync.mockImplementation(() => JSON.stringify(identMap));
    const identGenerator = new IdentGenerator();
    const loadMap = () => identGenerator.loadMap('some-file');
    const cause = `
      Expected string dictionary, but:
        - Item "a" is an array
        - Item "b" is a number
        - Item "c" is an object`;
    expect(loadMap).toThrow(`Invalid CSS identifier map in some-file${cause.replace(/\n {4}/g, '\n')}`);
  });

  it('The ident map is stringified', () => {
    const identGenerator = new IdentGenerator();
    identGenerator.generateIdent('alpha');
    expect(identGenerator.stringifyMap()).toBe('{\n  "alpha": "a"\n}\n');
    identGenerator.generateIdent('beta');
    identGenerator.generateIdent('alpha');
    expect(identGenerator.stringifyMap(0)).toBe('{"alpha":"a","beta":"b"}\n');
  });
});
