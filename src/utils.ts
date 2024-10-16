export function isDictLike(value: unknown): value is NodeJS.Dict<unknown> {
  return value ? typeof value === 'object' : false;
}

export function isError(value: unknown): value is Error & { code: unknown } {
  return value instanceof Error;
}

export function type(value: unknown, limit?: number) {
  if (typeof value === 'string') {
    const str = JSON.stringify(value);
    return limit != null && str.length > limit ? `string(${value.length})` : str;
  } else {
    return value === null ? 'null' : value instanceof Array ? 'array' : typeof value;
  }
}
