interface ObjectConstructor {
  /**
   * Returns the prototype of an object.
   * @param o The object that references the prototype.
   */
  getPrototypeOf(o: object | boolean | string | number | bigint): unknown;
}
