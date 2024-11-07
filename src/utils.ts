// This function has been extracted from css-loader/dist/utils.js
const regexSingleEscape = /[ -,./:-@[\]^`{-~]/;
const regexExcessiveSpaces = /(^|\\+)?(\\[A-F0-9]{1,6})\x20(?![a-fA-F0-9\x20])/g;
/* istanbul ignore next @preserve */
export function escape(str: string) {
  let output = '';

  for (let counter = 0; counter < str.length; counter += 1) {
    const character = str.charAt(counter);
    // eslint-disable-next-line no-control-regex
    if (/[\t\n\f\r\x0B]/.test(character)) {
      output += `\\${character.charCodeAt(0).toString(16).toUpperCase()} `;
    } else if (character === '\\' || regexSingleEscape.test(character)) {
      output += `\\${character}`;
    } else {
      output += character;
    }
  }

  const firstChar = str.charAt(0);
  if (/^-[-\d]/.test(output)) {
    output = `\\${output}`;
  } else if (/\d/.test(firstChar)) {
    output = `\\3${firstChar} ${output.slice(1)}`;
  }

  // Remove spaces after `\HEX` escapes that are not followed by a hex digit,
  // since they’re redundant. Note that this is only possible if the escape
  // sequence isn’t preceded by an odd number of backslashes.
  return output.replace(regexExcessiveSpaces, ($0, $1: string = '', $2: string) => {
    if ($1.length % 2) {
      // It’s not safe to remove the space, so don’t.
      return $0;
    } else {
      // Strip the space.
      return $1 + $2;
    }
  });
}

// This function has been extracted from css-loader/dist/utils.js
// eslint-disable-next-line no-control-regex
const reControlChars = /[\u0000-\u001f\u0080-\u009f]/g;
const filenameReservedRegex = /[<>:"/\\|?*]/g;
/* istanbul ignore next @preserve */
export function escapeLocalIdent(localident: string) {
  return escape(
    localident
      .replace(/^((-?[0-9])|--)/, '_$1')
      .replace(filenameReservedRegex, '-')
      .replace(reControlChars, '-')
      .replace(/\./g, '-'),
  );
}

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
