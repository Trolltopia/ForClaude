/** sfc32: small, fast, seedable. Plenty for a few million draws per simulation. */
export function createRng(seed: number): () => number {
  let a = 0x9e3779b9;
  let b = 0x243f6a88;
  let c = 0xb7e15162;
  let d = seed >>> 0;
  const next = () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  // Discard the first outputs so similar seeds diverge.
  for (let i = 0; i < 15; i++) next();
  return next;
}

/**
 * Walker's alias method: O(1) weighted sampling after O(n) setup.
 * Returns a sampler that maps a uniform [0, 1) number to an index.
 */
export function createAliasSampler(weights: ArrayLike<number>): (u: number) => number {
  const n = weights.length;
  if (n === 0) return () => -1;
  if (n === 1) return () => 0;

  let total = 0;
  for (let i = 0; i < n; i++) total += weights[i];
  const prob = new Float64Array(n);
  const alias = new Int32Array(n);
  const scaled = new Float64Array(n);
  const small: number[] = [];
  const large: number[] = [];
  for (let i = 0; i < n; i++) {
    scaled[i] = (weights[i] * n) / total;
    (scaled[i] < 1 ? small : large).push(i);
  }
  while (small.length && large.length) {
    const s = small.pop()!;
    const l = large.pop()!;
    prob[s] = scaled[s];
    alias[s] = l;
    scaled[l] = scaled[l] + scaled[s] - 1;
    (scaled[l] < 1 ? small : large).push(l);
  }
  for (const i of large) prob[i] = 1;
  for (const i of small) prob[i] = 1;

  return (u: number) => {
    const x = u * n;
    const i = Math.min(n - 1, Math.floor(x));
    return x - i < prob[i] ? i : alias[i];
  };
}
