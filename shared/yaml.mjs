function parseScalar(rawValue) {
  const value = rawValue.trim();

  if (!value.length) {
    return '';
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value;
}

function stripComment(line) {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "'" && !inDouble) inSingle = !inSingle;
    if (char === '"' && !inSingle) inDouble = !inDouble;
    if (char === '#' && !inSingle && !inDouble) {
      return line.slice(0, i);
    }
  }

  return line;
}

export function parseSimpleYaml(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => stripComment(line).replace(/\t/g, '  '));

  let index = 0;

  function skipEmpty() {
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }
      break;
    }
  }

  function indentOf(line) {
    return line.match(/^ */)[0].length;
  }

  function parseBlock(expectedIndent) {
    skipEmpty();
    if (index >= lines.length) return undefined;

    const line = lines[index];
    const indent = indentOf(line);
    if (indent < expectedIndent) return undefined;

    const trimmed = line.slice(indent);
    if (trimmed.startsWith('- ')) {
      return parseArray(expectedIndent);
    }

    return parseMap(expectedIndent);
  }

  function parseMap(expectedIndent) {
    const object = {};

    while (index < lines.length) {
      skipEmpty();
      if (index >= lines.length) break;

      const line = lines[index];
      const indent = indentOf(line);
      if (indent < expectedIndent) break;
      if (indent > expectedIndent) {
        throw new Error(`Invalid indentation near line ${index + 1}`);
      }

      const trimmed = line.slice(indent);
      if (trimmed.startsWith('- ')) break;

      const separator = trimmed.indexOf(':');
      if (separator === -1) {
        throw new Error(`Expected key/value pair at line ${index + 1}`);
      }

      const key = trimmed.slice(0, separator).trim();
      const rest = trimmed.slice(separator + 1).trim();
      index += 1;

      if (rest) {
        object[key] = parseScalar(rest);
        continue;
      }

      const nested = parseBlock(expectedIndent + 2);
      object[key] = nested === undefined ? {} : nested;
    }

    return object;
  }

  function parseArray(expectedIndent) {
    const array = [];

    while (index < lines.length) {
      skipEmpty();
      if (index >= lines.length) break;

      const line = lines[index];
      const indent = indentOf(line);
      if (indent < expectedIndent) break;
      if (indent !== expectedIndent) {
        throw new Error(`Invalid list indentation near line ${index + 1}`);
      }

      const trimmed = line.slice(indent);
      if (!trimmed.startsWith('- ')) break;

      const rest = trimmed.slice(2).trim();
      index += 1;

      if (!rest) {
        array.push(parseBlock(expectedIndent + 2));
        continue;
      }

      if (rest.includes(':')) {
        const separator = rest.indexOf(':');
        const key = rest.slice(0, separator).trim();
        const remainder = rest.slice(separator + 1).trim();
        const item = {};
        item[key] = remainder ? parseScalar(remainder) : parseBlock(expectedIndent + 2);

        while (index < lines.length) {
          skipEmpty();
          if (index >= lines.length) break;

          const nestedLine = lines[index];
          const nestedIndent = indentOf(nestedLine);
          if (nestedIndent < expectedIndent + 2) break;
          if (nestedIndent > expectedIndent + 2) {
            throw new Error(`Invalid nested indentation near line ${index + 1}`);
          }

          const nestedTrimmed = nestedLine.slice(nestedIndent);
          if (nestedTrimmed.startsWith('- ')) break;

          const nestedSeparator = nestedTrimmed.indexOf(':');
          if (nestedSeparator === -1) {
            throw new Error(`Expected key/value pair at line ${index + 1}`);
          }

          const nestedKey = nestedTrimmed.slice(0, nestedSeparator).trim();
          const nestedRest = nestedTrimmed.slice(nestedSeparator + 1).trim();
          index += 1;
          item[nestedKey] = nestedRest
            ? parseScalar(nestedRest)
            : parseBlock(expectedIndent + 4);
        }

        array.push(item);
        continue;
      }

      array.push(parseScalar(rest));
    }

    return array;
  }

  return parseBlock(0) ?? {};
}
