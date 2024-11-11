// Meant to be imported, not called with jest.mock().
import OriginalIdentGenerator from '../IdentGenerator';

export class IdentGenerator extends OriginalIdentGenerator {
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

  public static get implicitInstance() {
    return OriginalIdentGenerator.implicitInstance;
  }
}
