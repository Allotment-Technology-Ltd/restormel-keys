/** Read YAML-style snake or JSON-style camel from a plain object. */
export function pickKey(
  obj: Record<string, unknown>,
  snake: string,
  camel: string,
): unknown {
  if (Object.prototype.hasOwnProperty.call(obj, snake)) {
    return obj[snake];
  }
  if (Object.prototype.hasOwnProperty.call(obj, camel)) {
    return obj[camel];
  }
  return undefined;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
