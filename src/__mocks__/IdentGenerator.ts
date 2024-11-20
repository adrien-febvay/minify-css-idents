// Meant to be imported, not called with jest.mock().
import OriginalIdentGenerator from '../IdentGenerator';

export class IdentGenerator extends OriginalIdentGenerator {
  public expectIdent(outputIdent: string, inputIdent = `test-${outputIdent}`) {
    try {
      expect(this.generateIdent(inputIdent)).toBe(outputIdent);
    } catch (error) {
      if (error instanceof Error) {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        Error.captureStackTrace(error, IdentGenerator.prototype.expectIdent);
      }
      throw error;
    }
  }

  public setLastIdent(ident: string): this {
    this.currIdentIndex = parseInt(ident, 36);
    return this;
  }

  public static get implicitInstance() {
    return OriginalIdentGenerator.implicitInstance;
  }
}
