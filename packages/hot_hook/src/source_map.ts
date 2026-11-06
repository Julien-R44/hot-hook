const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
/**
 * Inline source map comment. Not necessarily at the very end: ts-exec appends
 * a `//# sourceURL=` comment after it
 */
const INLINE_MAP =
  /^\/\/[#@] sourceMappingURL=data:application\/json(?:;charset=[^,;]+)?;base64,([\d+/=A-Za-z]+)[\t ]*$/gm

/**
 * Decodes the first Base64 VLQ value of `mappings`
 */
function decodeFirstVlq(mappings: string) {
  let shift = 0
  let value = 0
  let length = 0

  for (;;) {
    const digit = BASE64.indexOf(mappings[length++])
    value += (digit & 31) << shift
    shift += 5
    if (!(digit & 32)) break
  }

  return { value: value & 1 ? -(value >>> 1) : value >>> 1, length }
}

function encodeVlq(value: number) {
  let vlq = value < 0 ? (-value << 1) | 1 : value << 1
  let encoded = ''

  do {
    let digit = vlq & 31
    vlq >>>= 5
    if (vlq) digit |= 32
    encoded += BASE64[digit]
  } while (vlq)

  return encoded
}

/**
 * Shifts the generated columns of the first line of an inline source map by
 * `offset`, to account for code prepended on that line.
 *
 * Only the first segment of line 1 holds an absolute column, the following
 * ones are relative to it, so rewriting that single value is enough.
 * Sources without an inline source map are returned unchanged.
 */
export function shiftInlineSourceMap(source: string, offset: number) {
  /**
   * Like Node.js, use the last source map comment
   */
  const match = [...source.matchAll(INLINE_MAP)].at(-1)
  if (!match) return source

  let map: { mappings?: string; sections?: unknown }
  try {
    map = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'))
  } catch {
    return source
  }

  /**
   * Nothing is mapped on line 1, or an index map (not supported)
   */
  if (!map.mappings || map.mappings[0] === ';' || map.sections) return source

  const first = decodeFirstVlq(map.mappings)
  map.mappings = encodeVlq(first.value + offset) + map.mappings.slice(first.length)

  const encoded = Buffer.from(JSON.stringify(map)).toString('base64')
  return (
    source.slice(0, match.index) +
    `//# sourceMappingURL=data:application/json;base64,${encoded}` +
    source.slice(match.index + match[0].length)
  )
}
