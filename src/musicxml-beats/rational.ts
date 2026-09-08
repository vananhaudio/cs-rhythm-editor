/** Exact canonical fractions. BigInt is internal only; public values are JSON-safe strings. */
export type Rational = `${bigint}/${bigint}`;
export function rational(
  n: bigint | string | number,
  d: bigint | string | number = 1n
): Rational {
  if (
    (typeof n === "number" && !Number.isSafeInteger(n)) ||
    (typeof d === "number" && !Number.isSafeInteger(d))
  )
    throw new Error("Expected exact integers");
  let a = BigInt(n),
    b = BigInt(d);
  if (b === 0n) throw new Error("Zero denominator");
  if (b < 0n) {
    a = -a;
    b = -b;
  }
  let x = a < 0n ? -a : a,
    y = b;
  while (y) {
    const r = x % y;
    x = y;
    y = r;
  }
  return `${a / x}/${b / x}`;
}
export function decimal(value: string): Rational {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value))
    throw new Error(`Invalid exact decimal: ${value}`);
  const places = value.split(".")[1]?.length ?? 0;
  return rational(value.replace(".", ""), 10n ** BigInt(places));
}
const pair = (r: Rational) => r.split("/").map(BigInt);
export function add(a: Rational, b: Rational): Rational {
  const [n, d] = pair(a),
    [m, e] = pair(b);
  return rational(n * e + m * d, d * e);
}
export function sub(a: Rational, b: Rational): Rational {
  const [n, d] = pair(a),
    [m, e] = pair(b);
  return rational(n * e - m * d, d * e);
}
export function div(a: Rational, b: Rational): Rational {
  const [n, d] = pair(a),
    [m, e] = pair(b);
  return rational(n * e, d * m);
}
export function compare(a: Rational, b: Rational): number {
  const [n, d] = pair(a),
    [m, e] = pair(b);
  const v = n * e - m * d;
  return v < 0n ? -1 : v > 0n ? 1 : 0;
}
export const ZERO: Rational = "0/1";
