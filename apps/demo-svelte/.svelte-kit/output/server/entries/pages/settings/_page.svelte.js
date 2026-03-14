import { N as NO_KEY_AVAILABLE, c as createKeys, o as openaiProvider, a as anthropicProvider } from "../../../chunks/anthropic.js";
var Yr = Object.defineProperty;
var Pn = (e) => {
  throw TypeError(e);
};
var Gr = (e, t, n) => t in e ? Yr(e, t, { enumerable: true, configurable: true, writable: true, value: n }) : e[t] = n;
var Oe = (e, t, n) => Gr(e, typeof t != "symbol" ? t + "" : t, n), nn = (e, t, n) => t.has(e) || Pn("Cannot " + n);
var h = (e, t, n) => (nn(e, t, "read from private field"), n ? n.call(e) : t.get(e)), U = (e, t, n) => t.has(e) ? Pn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), he = (e, t, n, r) => (nn(e, t, "write to private field"), t.set(e, n), n), be = (e, t, n) => (nn(e, t, "access private method"), n);
const Zr = "5";
var Zn;
typeof window < "u" && ((Zn = window.__svelte ?? (window.__svelte = {})).v ?? (Zn.v = /* @__PURE__ */ new Set())).add(Zr);
const Xr = 1, Jr = 2, Qr = 16, $r = 1, es = 2, H = /* @__PURE__ */ Symbol(), ts = /* @__PURE__ */ Symbol("filename"), $n = "http://www.w3.org/1999/xhtml", ns = "http://www.w3.org/2000/svg", rs = "http://www.w3.org/1998/Math/MathML";
var Xn, Jn;
const Rn = (Jn = (Xn = globalThis.process) == null ? void 0 : Xn.env) == null ? void 0 : Jn.NODE_ENV, g = Rn && !Rn.toLowerCase().startsWith("prod");
var kn = Array.isArray, ss = Array.prototype.indexOf, Qe = Array.prototype.includes, mn = Array.from, _t = Object.defineProperty, Vt = Object.getOwnPropertyDescriptor, is = Object.getOwnPropertyDescriptors, ls = Object.prototype, as = Array.prototype, er = Object.getPrototypeOf;
const os = () => {
};
function fs(e) {
  for (var t = 0; t < e.length; t++)
    e[t]();
}
function tr() {
  var e, t, n = new Promise((r, s) => {
    e = r, t = s;
  });
  return { promise: n, resolve: e, reject: t };
}
const B = 2, ht = 4, yn = 8, nr = 1 << 24, Be = 16, ye = 32, pt = 64, us = 128, ve = 512, V = 1024, Q = 2048, Se = 4096, fe = 8192, me = 16384, et = 32768, On = 1 << 25, Mt = 65536, Ht = 1 << 17, cs = 1 << 18, en = 1 << 19, vs = 1 << 20, Pe = 1 << 25, Ue = 65536, fn = 1 << 21, tn = 1 << 22, je = 1 << 23, xt = /* @__PURE__ */ Symbol("$state"), ds = /* @__PURE__ */ Symbol(""), rr = /* @__PURE__ */ Symbol("proxy path"), ze = new class extends Error {
  constructor() {
    super(...arguments);
    Oe(this, "name", "StaleReactionError");
    Oe(this, "message", "The reaction that called `getAbortSignal()` was re-run or destroyed");
  }
}();
function _s(e) {
  if (g) {
    const t = new Error(`invariant_violation
An invariant violation occurred, meaning Svelte's internal assumptions were flawed. This is a bug in Svelte, not your app — please open an issue at https://github.com/sveltejs/svelte, citing the following message: "${e}"
https://svelte.dev/e/invariant_violation`);
    throw t.name = "Svelte error", t;
  } else
    throw new Error("https://svelte.dev/e/invariant_violation");
}
function hs() {
  if (g) {
    const e = new Error("async_derived_orphan\nCannot create a `$derived(...)` with an `await` expression outside of an effect tree\nhttps://svelte.dev/e/async_derived_orphan");
    throw e.name = "Svelte error", e;
  } else
    throw new Error("https://svelte.dev/e/async_derived_orphan");
}
function ps() {
  if (g) {
    const e = new Error(`derived_references_self
A derived value cannot reference itself recursively
https://svelte.dev/e/derived_references_self`);
    throw e.name = "Svelte error", e;
  } else
    throw new Error("https://svelte.dev/e/derived_references_self");
}
function sr(e, t, n) {
  if (g) {
    const r = new Error(`each_key_duplicate
${n ? `Keyed each block has duplicate key \`${n}\` at indexes ${e} and ${t}` : `Keyed each block has duplicate key at indexes ${e} and ${t}`}
https://svelte.dev/e/each_key_duplicate`);
    throw r.name = "Svelte error", r;
  } else
    throw new Error("https://svelte.dev/e/each_key_duplicate");
}
function gs(e, t, n) {
  if (g) {
    const r = new Error(`each_key_volatile
Keyed each block has key that is not idempotent — the key for item at index ${e} was \`${t}\` but is now \`${n}\`. Keys must be the same each time for a given item
https://svelte.dev/e/each_key_volatile`);
    throw r.name = "Svelte error", r;
  } else
    throw new Error("https://svelte.dev/e/each_key_volatile");
}
function ws(e) {
  if (g) {
    const t = new Error(`effect_in_teardown
\`${e}\` cannot be used inside an effect cleanup function
https://svelte.dev/e/effect_in_teardown`);
    throw t.name = "Svelte error", t;
  } else
    throw new Error("https://svelte.dev/e/effect_in_teardown");
}
function ks() {
  if (g) {
    const e = new Error("effect_in_unowned_derived\nEffect cannot be created inside a `$derived` value that was not itself created inside an effect\nhttps://svelte.dev/e/effect_in_unowned_derived");
    throw e.name = "Svelte error", e;
  } else
    throw new Error("https://svelte.dev/e/effect_in_unowned_derived");
}
function ms(e) {
  if (g) {
    const t = new Error(`effect_orphan
\`${e}\` can only be used inside an effect (e.g. during component initialisation)
https://svelte.dev/e/effect_orphan`);
    throw t.name = "Svelte error", t;
  } else
    throw new Error("https://svelte.dev/e/effect_orphan");
}
function ys() {
  if (g) {
    const e = new Error(`effect_update_depth_exceeded
Maximum update depth exceeded. This typically indicates that an effect reads and writes the same piece of state
https://svelte.dev/e/effect_update_depth_exceeded`);
    throw e.name = "Svelte error", e;
  } else
    throw new Error("https://svelte.dev/e/effect_update_depth_exceeded");
}
function bs(e) {
  if (g) {
    const t = new Error(`rune_outside_svelte
The \`${e}\` rune is only available inside \`.svelte\` and \`.svelte.js/ts\` files
https://svelte.dev/e/rune_outside_svelte`);
    throw t.name = "Svelte error", t;
  } else
    throw new Error("https://svelte.dev/e/rune_outside_svelte");
}
function Es() {
  if (g) {
    const e = new Error("state_descriptors_fixed\nProperty descriptors defined on `$state` objects must contain `value` and always be `enumerable`, `configurable` and `writable`.\nhttps://svelte.dev/e/state_descriptors_fixed");
    throw e.name = "Svelte error", e;
  } else
    throw new Error("https://svelte.dev/e/state_descriptors_fixed");
}
function xs() {
  if (g) {
    const e = new Error("state_prototype_fixed\nCannot set prototype of `$state` object\nhttps://svelte.dev/e/state_prototype_fixed");
    throw e.name = "Svelte error", e;
  } else
    throw new Error("https://svelte.dev/e/state_prototype_fixed");
}
function Ss() {
  if (g) {
    const e = new Error("state_unsafe_mutation\nUpdating state inside `$derived(...)`, `$inspect(...)` or a template expression is forbidden. If the value should not be reactive, declare it without `$state`\nhttps://svelte.dev/e/state_unsafe_mutation");
    throw e.name = "Svelte error", e;
  } else
    throw new Error("https://svelte.dev/e/state_unsafe_mutation");
}
var As = "font-weight: bold", Ms = "font-weight: normal";
function Ts() {
  g ? console.warn("%c[svelte] select_multiple_invalid_value\n%cThe `value` property of a `<select multiple>` element should be an array, but it received a non-array value. The selection will be kept as is.\nhttps://svelte.dev/e/select_multiple_invalid_value", As, Ms) : console.warn("https://svelte.dev/e/select_multiple_invalid_value");
}
function ir(e) {
  return e === this.v;
}
function zs(e, t) {
  return e != e ? t == t : e !== t || e !== null && typeof e == "object" || typeof e == "function";
}
function lr(e) {
  return !zs(e, this.v);
}
let Is = false;
function De(e, t) {
  return e.label = t, ar(e.v, t), e;
}
function ar(e, t) {
  var n;
  return (n = e == null ? void 0 : e[rr]) == null || n.call(e, t), e;
}
function Cs(e) {
  const t = new Error(), n = Ns();
  return n.length === 0 ? null : (n.unshift(`
`), _t(t, "stack", {
    value: n.join(`
`)
  }), _t(t, "name", {
    value: e
  }), /** @type {Error & { stack: string }} */
  t);
}
function Ns() {
  const e = Error.stackTraceLimit;
  Error.stackTraceLimit = 1 / 0;
  const t = new Error().stack;
  if (Error.stackTraceLimit = e, !t) return [];
  const n = t.split(`
`), r = [];
  for (let s = 0; s < n.length; s++) {
    const i = n[s], l = i.replaceAll("\\", "/");
    if (i.trim() !== "Error") {
      if (i.includes("validate_each_keys"))
        return [];
      l.includes("svelte/src/internal") || l.includes("node_modules/.vite") || r.push(i);
    }
  }
  return r;
}
function Ps(e, t) {
  if (!g)
    throw new Error("invariant(...) was not guarded by if (DEV)");
  e || _s(t);
}
let ie = null;
function Yt(e) {
  ie = e;
}
let Tt = null;
function Gt(e) {
  Tt = e;
}
let Lt = null;
function Dn(e) {
  Lt = e;
}
function bn(e, t = false, n) {
  ie = {
    p: ie,
    i: false,
    c: null,
    e: null,
    s: e,
    x: null,
    r: (
      /** @type {Effect} */
      M
    ),
    l: null
  }, g && (ie.function = n, Lt = n);
}
function En(e) {
  var t = (
    /** @type {ComponentContext} */
    ie
  ), n = t.e;
  if (n !== null) {
    t.e = null;
    for (var r of n)
      Ar(r);
  }
  return t.i = true, ie = t.p, g && (Lt = (ie == null ? void 0 : ie.function) ?? null), /** @type {T} */
  {};
}
function or() {
  return true;
}
let lt = [];
function Rs() {
  var e = lt;
  lt = [], fs(e);
}
function Ln(e) {
  if (lt.length === 0) {
    var t = lt;
    queueMicrotask(() => {
      t === lt && Rs();
    });
  }
  lt.push(e);
}
const un = /* @__PURE__ */ new WeakMap();
function Os(e) {
  var t = M;
  if (t === null)
    return E.f |= je, e;
  if (g && e instanceof Error && !un.has(e) && un.set(e, Ds(e, t)), (t.f & et) === 0 && (t.f & ht) === 0)
    throw g && !t.parent && e instanceof Error && fr(e), e;
  Wt(e, t);
}
function Wt(e, t) {
  for (; t !== null; ) {
    if ((t.f & us) !== 0) {
      if ((t.f & et) === 0)
        throw e;
      try {
        t.b.error(e);
        return;
      } catch (n) {
        e = n;
      }
    }
    t = t.parent;
  }
  throw g && e instanceof Error && fr(e), e;
}
function Ds(e, t) {
  var l, a, u;
  const n = Vt(e, "message");
  if (!(n && !n.configurable)) {
    for (var r = "	", s = `
${r}in ${((l = t.fn) == null ? void 0 : l.name) || "<unknown>"}`, i = t.ctx; i !== null; )
      s += `
${r}in ${(a = i.function) == null ? void 0 : a[ts].split("/").pop()}`, i = i.p;
    return {
      message: e.message + `
${s}
`,
      stack: (u = e.stack) == null ? void 0 : u.split(`
`).filter((o) => !o.includes("svelte/src/internal")).join(`
`)
    };
  }
}
function fr(e) {
  const t = un.get(e);
  t && (_t(e, "message", {
    value: t.message
  }), _t(e, "stack", {
    value: t.stack
  }));
}
const Ls = -7169;
function F(e, t) {
  e.f = e.f & Ls | t;
}
function xn(e) {
  (e.f & ve) !== 0 || e.deps === null ? F(e, V) : F(e, Se);
}
function ur(e) {
  if (e !== null)
    for (const t of e)
      (t.f & B) === 0 || (t.f & Ue) === 0 || (t.f ^= Ue, ur(
        /** @type {Derived} */
        t.deps
      ));
}
function Fs(e, t, n) {
  (e.f & Q) !== 0 ? t.add(e) : (e.f & Se) !== 0 && n.add(e), ur(e.deps), F(e, V);
}
const it = /* @__PURE__ */ new Set();
let b = null, W = null, cn = null, rn = false, at = null, Bt = null;
var Fn = 0, js = g ? /* @__PURE__ */ new Set() : null;
let Ks = 1;
var ft, ut, ct, vt, Rt, re, We, Ce, Ne, dt, $, vn, dn, _n, hn, cr;
const Qt = class Qt2 {
  constructor() {
    U(this, $);
    Oe(this, "id", Ks++);
    Oe(this, "current", /* @__PURE__ */ new Map());
    Oe(this, "previous", /* @__PURE__ */ new Map());
    U(this, ft, /* @__PURE__ */ new Set());
    U(this, ut, /* @__PURE__ */ new Set());
    U(this, ct, 0);
    U(this, vt, 0);
    U(this, Rt, null);
    U(this, re, []);
    U(this, We, /* @__PURE__ */ new Set());
    U(this, Ce, /* @__PURE__ */ new Set());
    U(this, Ne, /* @__PURE__ */ new Map());
    Oe(this, "is_fork", false);
    U(this, dt, false);
  }
  /**
   * Add an effect to the #skipped_branches map and reset its children
   * @param {Effect} effect
   */
  skip_effect(t) {
    h(this, Ne).has(t) || h(this, Ne).set(t, { d: [], m: [] });
  }
  /**
   * Remove an effect from the #skipped_branches map and reschedule
   * any tracked dirty/maybe_dirty child effects
   * @param {Effect} effect
   */
  unskip_effect(t) {
    var n = h(this, Ne).get(t);
    if (n) {
      h(this, Ne).delete(t);
      for (var r of n.d)
        F(r, Q), this.schedule(r);
      for (r of n.m)
        F(r, Se), this.schedule(r);
    }
  }
  /**
   * Associate a change to a given source with the current
   * batch, noting its previous and current values
   * @param {Source} source
   * @param {any} old_value
   */
  capture(t, n) {
    n !== H && !this.previous.has(t) && this.previous.set(t, n), (t.f & je) === 0 && (this.current.set(t, t.v), W == null || W.set(t, t.v));
  }
  activate() {
    b = this;
  }
  deactivate() {
    b = null, W = null;
  }
  flush() {
    var t = g ? /* @__PURE__ */ new Set() : null;
    try {
      rn = true, b = this, be(this, $, dn).call(this);
    } finally {
      if (Fn = 0, cn = null, at = null, Bt = null, rn = false, b = null, W = null, Ke.clear(), g)
        for (
          const n of
          /** @type {Set<Source>} */
          t
        )
          n.updated = null;
    }
  }
  discard() {
    for (const t of h(this, ut)) t(this);
    h(this, ut).clear();
  }
  /**
   *
   * @param {boolean} blocking
   */
  increment(t) {
    he(this, ct, h(this, ct) + 1), t && he(this, vt, h(this, vt) + 1);
  }
  /**
   * @param {boolean} blocking
   * @param {boolean} skip - whether to skip updates (because this is triggered by a stale reaction)
   */
  decrement(t, n) {
    he(this, ct, h(this, ct) - 1), t && he(this, vt, h(this, vt) - 1), !(h(this, dt) || n) && (he(this, dt, true), Ln(() => {
      he(this, dt, false), this.flush();
    }));
  }
  /**
   * @param {Set<Effect>} dirty_effects
   * @param {Set<Effect>} maybe_dirty_effects
   */
  transfer_effects(t, n) {
    for (const r of t)
      h(this, We).add(r);
    for (const r of n)
      h(this, Ce).add(r);
    t.clear(), n.clear();
  }
  /** @param {(batch: Batch) => void} fn */
  oncommit(t) {
    h(this, ft).add(t);
  }
  /** @param {(batch: Batch) => void} fn */
  ondiscard(t) {
    h(this, ut).add(t);
  }
  settled() {
    return (h(this, Rt) ?? he(this, Rt, tr())).promise;
  }
  static ensure() {
    if (b === null) {
      const t = b = new Qt2();
      rn || (it.add(b), Ln(() => {
        b === t && t.flush();
      }));
    }
    return b;
  }
  apply() {
    {
      W = null;
      return;
    }
  }
  /**
   *
   * @param {Effect} effect
   */
  schedule(t) {
    var s;
    if (cn = t, (s = t.b) != null && s.is_pending && (t.f & (ht | yn | nr)) !== 0 && (t.f & et) === 0) {
      t.b.defer_effect(t);
      return;
    }
    for (var n = t; n.parent !== null; ) {
      n = n.parent;
      var r = n.f;
      if (at !== null && n === M && (E === null || (E.f & B) === 0))
        return;
      if ((r & (pt | ye)) !== 0) {
        if ((r & V) === 0)
          return;
        n.f ^= V;
      }
    }
    h(this, re).push(n);
  }
};
ft = /* @__PURE__ */ new WeakMap(), ut = /* @__PURE__ */ new WeakMap(), ct = /* @__PURE__ */ new WeakMap(), vt = /* @__PURE__ */ new WeakMap(), Rt = /* @__PURE__ */ new WeakMap(), re = /* @__PURE__ */ new WeakMap(), We = /* @__PURE__ */ new WeakMap(), Ce = /* @__PURE__ */ new WeakMap(), Ne = /* @__PURE__ */ new WeakMap(), dt = /* @__PURE__ */ new WeakMap(), $ = /* @__PURE__ */ new WeakSet(), vn = function() {
  return this.is_fork || h(this, vt) > 0;
}, dn = function() {
  var a, u;
  if (Fn++ > 1e3 && (it.delete(this), Us()), !be(this, $, vn).call(this)) {
    for (const o of h(this, We))
      h(this, Ce).delete(o), F(o, Q), this.schedule(o);
    for (const o of h(this, Ce))
      F(o, Se), this.schedule(o);
  }
  const t = h(this, re);
  he(this, re, []), this.apply();
  var n = at = [], r = [], s = Bt = [];
  for (const o of t)
    try {
      be(this, $, _n).call(this, o, n, r);
    } catch (f) {
      throw hr(o), f;
    }
  if (b = null, s.length > 0) {
    var i = Qt.ensure();
    for (const o of s)
      i.schedule(o);
  }
  if (at = null, Bt = null, be(this, $, vn).call(this)) {
    be(this, $, hn).call(this, r), be(this, $, hn).call(this, n);
    for (const [o, f] of h(this, Ne))
      _r(o, f);
  } else {
    h(this, ct) === 0 && it.delete(this), h(this, We).clear(), h(this, Ce).clear();
    for (const o of h(this, ft)) o(this);
    h(this, ft).clear(), jn(r), jn(n), (a = h(this, Rt)) == null || a.resolve();
  }
  var l = (
    /** @type {Batch | null} */
    /** @type {unknown} */
    b
  );
  if (h(this, re).length > 0) {
    const o = l ?? (l = this);
    h(o, re).push(...h(this, re).filter((f) => !h(o, re).includes(f)));
  }
  if (l !== null) {
    if (it.add(l), g)
      for (const o of this.current.keys())
        js.add(o);
    be(u = l, $, dn).call(u);
  }
  it.has(this) || be(this, $, cr).call(this);
}, /**
* Traverse the effect tree, executing effects or stashing
* them for later execution as appropriate
* @param {Effect} root
* @param {Effect[]} effects
* @param {Effect[]} render_effects
*/
_n = function(t, n, r) {
  t.f ^= V;
  for (var s = t.first; s !== null; ) {
    var i = s.f, l = (i & (ye | pt)) !== 0, a = l && (i & V) !== 0, u = a || (i & fe) !== 0 || h(this, Ne).has(s);
    if (!u && s.fn !== null) {
      l ? s.f ^= V : (i & ht) !== 0 ? n.push(s) : jt(s) && ((i & Be) !== 0 && h(this, Ce).add(s), wt(s));
      var o = s.first;
      if (o !== null) {
        s = o;
        continue;
      }
    }
    for (; s !== null; ) {
      var f = s.next;
      if (f !== null) {
        s = f;
        break;
      }
      s = s.parent;
    }
  }
}, /**
* @param {Effect[]} effects
*/
hn = function(t) {
  for (var n = 0; n < t.length; n += 1)
    Fs(t[n], h(this, We), h(this, Ce));
}, cr = function() {
  var u;
  for (const o of it) {
    var t = o.id < this.id, n = [];
    for (const [f, v] of this.current) {
      if (o.current.has(f))
        if (t && v !== o.current.get(f))
          o.current.set(f, v);
        else
          continue;
      n.push(f);
    }
    if (n.length !== 0) {
      var r = [...o.current.keys()].filter((f) => !this.current.has(f));
      if (r.length > 0) {
        g && Ps(h(o, re).length === 0, "Batch has scheduled roots"), o.activate();
        var s = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Map();
        for (var l of n)
          vr(l, r, s, i);
        if (h(o, re).length > 0) {
          o.apply();
          for (var a of h(o, re))
            be(u = o, $, _n).call(u, a, [], []);
          he(o, re, []);
        }
        o.deactivate();
      }
    }
  }
};
let zt = Qt;
function Us() {
  if (g) {
    var e = /* @__PURE__ */ new Map();
    for (
      const n of
      /** @type {Batch} */
      b.current.keys()
    )
      for (const [r, s] of n.updated ?? []) {
        var t = e.get(r);
        t || (t = { error: s.error, count: 0 }, e.set(r, t)), t.count += s.count;
      }
    for (const n of e.values())
      n.error && console.error(n.error);
  }
  try {
    ys();
  } catch (n) {
    g && _t(n, "stack", { value: "" }), Wt(n, cn);
  }
}
let pe = null;
function jn(e) {
  var t = e.length;
  if (t !== 0) {
    for (var n = 0; n < t; ) {
      var r = e[n++];
      if ((r.f & (me | fe)) === 0 && jt(r) && (pe = /* @__PURE__ */ new Set(), wt(r), r.deps === null && r.first === null && r.nodes === null && r.teardown === null && r.ac === null && Ir(r), (pe == null ? void 0 : pe.size) > 0)) {
        Ke.clear();
        for (const s of pe) {
          if ((s.f & (me | fe)) !== 0) continue;
          const i = [s];
          let l = s.parent;
          for (; l !== null; )
            pe.has(l) && (pe.delete(l), i.push(l)), l = l.parent;
          for (let a = i.length - 1; a >= 0; a--) {
            const u = i[a];
            (u.f & (me | fe)) === 0 && wt(u);
          }
        }
        pe.clear();
      }
    }
    pe = null;
  }
}
function vr(e, t, n, r) {
  if (!n.has(e) && (n.add(e), e.reactions !== null))
    for (const s of e.reactions) {
      const i = s.f;
      (i & B) !== 0 ? vr(
        /** @type {Derived} */
        s,
        t,
        n,
        r
      ) : (i & (tn | Be)) !== 0 && (i & Q) === 0 && dr(s, t, r) && (F(s, Q), Sn(
        /** @type {Effect} */
        s
      ));
    }
}
function dr(e, t, n) {
  const r = n.get(e);
  if (r !== void 0) return r;
  if (e.deps !== null)
    for (const s of e.deps) {
      if (Qe.call(t, s))
        return true;
      if ((s.f & B) !== 0 && dr(
        /** @type {Derived} */
        s,
        t,
        n
      ))
        return n.set(
          /** @type {Derived} */
          s,
          true
        ), true;
    }
  return n.set(e, false), false;
}
function Sn(e) {
  b.schedule(e);
}
function _r(e, t) {
  if (!((e.f & ye) !== 0 && (e.f & V) !== 0)) {
    (e.f & Q) !== 0 ? t.d.push(e) : (e.f & Se) !== 0 && t.m.push(e), F(e, V);
    for (var n = e.first; n !== null; )
      _r(n, t), n = n.next;
  }
}
function hr(e) {
  F(e, V);
  for (var t = e.first; t !== null; )
    hr(t), t = t.next;
}
function Vs(e, t, n, r) {
  const s = An;
  var i = e.filter((d) => !d.settled);
  if (n.length === 0 && i.length === 0) {
    r(t.map(s));
    return;
  }
  var l = (
    /** @type {Effect} */
    M
  ), a = Bs(), u = i.length === 1 ? i[0].promise : i.length > 1 ? Promise.all(i.map((d) => d.promise)) : null;
  function o(d) {
    a();
    try {
      r(d);
    } catch (p) {
      (l.f & me) === 0 && Wt(p, l);
    }
    Zt();
  }
  if (n.length === 0) {
    u.then(() => o(t.map(s)));
    return;
  }
  var f = pr();
  function v() {
    Promise.all(n.map((d) => /* @__PURE__ */ Hs(d))).then((d) => o([...t.map(s), ...d])).catch((d) => Wt(d, l)).finally(() => f());
  }
  u ? u.then(() => {
    a(), v(), Zt();
  }) : v();
}
function Bs() {
  var e = (
    /** @type {Effect} */
    M
  ), t = E, n = ie, r = (
    /** @type {Batch} */
    b
  );
  if (g)
    var s = Tt;
  return function(l = true) {
    Xe(e), Ve(t), Yt(n), l && (e.f & me) === 0 && (r == null || r.activate(), r == null || r.apply()), g && Gt(s);
  };
}
function Zt(e = true) {
  Xe(null), Ve(null), Yt(null), e && (b == null || b.deactivate()), g && Gt(null);
}
function pr() {
  var e = (
    /** @type {Boundary} */
    /** @type {Effect} */
    M.b
  ), t = (
    /** @type {Batch} */
    b
  ), n = e.is_rendered();
  return e.update_pending_count(1, t), t.increment(n), (r = false) => {
    e.update_pending_count(-1, t), t.decrement(n, r);
  };
}
const qs = /* @__PURE__ */ new Set();
// @__NO_SIDE_EFFECTS__
function An(e) {
  var t = B | Q, n = E !== null && (E.f & B) !== 0 ? (
    /** @type {Derived} */
    E
  ) : null;
  return M !== null && (M.f |= en), {
    ctx: ie,
    deps: null,
    effects: null,
    equals: ir,
    f: t,
    fn: e,
    reactions: null,
    rv: 0,
    v: (
      /** @type {V} */
      H
    ),
    wv: 0,
    parent: n ?? M,
    ac: null
  };
}
// @__NO_SIDE_EFFECTS__
function Hs(e, t, n) {
  let r = (
    /** @type {Effect | null} */
    M
  );
  r === null && hs();
  var s = (
    /** @type {Promise<V>} */
    /** @type {unknown} */
    void 0
  ), i = It(
    /** @type {V} */
    H
  );
  g && (i.label = t);
  var l = !E, a = /* @__PURE__ */ new Map();
  return ci(() => {
    var p;
    var u = (
      /** @type {Effect} */
      M
    ), o = tr();
    s = o.promise;
    try {
      Promise.resolve(e()).then(o.resolve, o.reject).finally(Zt);
    } catch (c) {
      o.reject(c), Zt();
    }
    var f = (
      /** @type {Batch} */
      b
    );
    if (l) {
      if ((u.f & et) !== 0)
        var v = pr();
      if (
        /** @type {Boundary} */
        r.b.is_rendered()
      )
        (p = a.get(f)) == null || p.reject(ze), a.delete(f);
      else {
        for (const c of a.values())
          c.reject(ze);
        a.clear();
      }
      a.set(f, o);
    }
    const d = (c, w = void 0) => {
      if (v) {
        var k = w === ze;
        v(k);
      }
      if (!(w === ze || (u.f & me) !== 0)) {
        if (f.activate(), w)
          i.f |= je, Ct(i, w);
        else {
          (i.f & je) !== 0 && (i.f ^= je), Ct(i, c);
          for (const [A, x] of a) {
            if (a.delete(A), A === f) break;
            x.reject(ze);
          }
        }
        f.deactivate();
      }
    };
    o.promise.then(d, (c) => d(null, c || "unknown"));
  }), Sr(() => {
    for (const u of a.values())
      u.reject(ze);
  }), g && (i.f |= tn), new Promise((u) => {
    function o(f) {
      function v() {
        f === s ? u(i) : o(s);
      }
      f.then(v, v);
    }
    o(s);
  });
}
// @__NO_SIDE_EFFECTS__
function Ie(e) {
  const t = /* @__PURE__ */ An(e);
  return Rr(t), t;
}
// @__NO_SIDE_EFFECTS__
function Ys(e) {
  const t = /* @__PURE__ */ An(e);
  return t.equals = lr, t;
}
function Kn(e) {
  var t = e.effects;
  if (t !== null) {
    e.effects = null;
    for (var n = 0; n < t.length; n += 1)
      Re(
        /** @type {Effect} */
        t[n]
      );
  }
}
let sn = [];
function Gs(e) {
  for (var t = e.parent; t !== null; ) {
    if ((t.f & B) === 0)
      return (t.f & me) === 0 ? (
        /** @type {Effect} */
        t
      ) : null;
    t = t.parent;
  }
  return null;
}
function Mn(e) {
  var t, n = M;
  if (Xe(Gs(e)), g) {
    let r = gt;
    Un(/* @__PURE__ */ new Set());
    try {
      Qe.call(sn, e) && ps(), sn.push(e), e.f &= ~Ue, Kn(e), t = pn(e);
    } finally {
      Xe(n), Un(r), sn.pop();
    }
  } else
    try {
      e.f &= ~Ue, Kn(e), t = pn(e);
    } finally {
      Xe(n);
    }
  return t;
}
function gr(e) {
  var t = e.v, n = Mn(e);
  if (!e.equals(n) && (e.wv = Dr(), (!(b != null && b.is_fork) || e.deps === null) && (e.v = n, b == null || b.capture(e, t), e.deps === null))) {
    F(e, V);
    return;
  }
  $e || (W !== null ? (xr() || b != null && b.is_fork) && W.set(e, n) : xn(e));
}
function Ws(e) {
  var t, n;
  if (e.effects !== null)
    for (const r of e.effects)
      (r.teardown || r.ac) && ((t = r.teardown) == null || t.call(r), (n = r.ac) == null || n.abort(ze), r.teardown = os, r.ac = null, Pt(r, 0), In(r));
}
function wr(e) {
  if (e.effects !== null)
    for (const t of e.effects)
      t.teardown && wt(t);
}
let gt = /* @__PURE__ */ new Set();
const Ke = /* @__PURE__ */ new Map();
function Un(e) {
  gt = e;
}
let Tn = false;
function Zs() {
  Tn = true;
}
function It(e, t) {
  var n = {
    f: 0,
    // TODO ideally we could skip this altogether, but it causes type errors
    v: e,
    reactions: null,
    equals: ir,
    rv: 0,
    wv: 0
  };
  return n;
}
// @__NO_SIDE_EFFECTS__
function Y(e, t) {
  const n = It(e);
  return Rr(n), n;
}
// @__NO_SIDE_EFFECTS__
function Xs(e, t = false, n = true) {
  const r = It(e);
  return t || (r.equals = lr), r;
}
function y(e, t, n = false) {
  E !== null && // since we are untracking the function inside `$inspect.with` we need to add this check
  // to ensure we error if state is set inside an inspect effect
  (!ke || (E.f & Ht) !== 0) && or() && (E.f & (B | Be | tn | Ht)) !== 0 && (de === null || !Qe.call(de, e)) && Ss();
  let r = n ? ot(t) : t;
  return g && ar(
    r,
    /** @type {string} */
    e.label
  ), Ct(e, r, Bt);
}
function Ct(e, t, n = null) {
  var i;
  if (!e.equals(t)) {
    var r = e.v;
    $e ? Ke.set(e, t) : Ke.set(e, r), e.v = t;
    var s = zt.ensure();
    if (s.capture(e, r), g) {
      if (M !== null) {
        e.updated ?? (e.updated = /* @__PURE__ */ new Map());
        const l = (((i = e.updated.get("")) == null ? void 0 : i.count) ?? 0) + 1;
        if (e.updated.set("", { error: (
          /** @type {any} */
          null
        ), count: l }), l > 5) {
          const a = Cs("updated at");
          if (a !== null) {
            let u = e.updated.get(a.stack);
            u || (u = { error: a, count: 0 }, e.updated.set(a.stack, u)), u.count++;
          }
        }
      }
      M !== null && (e.set_during_effect = true);
    }
    if ((e.f & B) !== 0) {
      const l = (
        /** @type {Derived} */
        e
      );
      (e.f & Q) !== 0 && Mn(l), W === null && xn(l);
    }
    e.wv = Dr(), mr(e, Q, n), M !== null && (M.f & V) !== 0 && (M.f & (ye | pt)) === 0 && (ce === null ? di([e]) : ce.push(e)), !s.is_fork && gt.size > 0 && !Tn && kr();
  }
  return t;
}
function kr() {
  Tn = false;
  for (const e of gt)
    (e.f & V) !== 0 && F(e, Se), jt(e) && wt(e);
  gt.clear();
}
function ln(e) {
  y(e, e.v + 1);
}
function mr(e, t, n) {
  var r = e.reactions;
  if (r !== null)
    for (var s = r.length, i = 0; i < s; i++) {
      var l = r[i], a = l.f;
      if (g && (a & Ht) !== 0) {
        gt.add(l);
        continue;
      }
      var u = (a & Q) === 0;
      if (u && F(l, t), (a & B) !== 0) {
        var o = (
          /** @type {Derived} */
          l
        );
        W == null || W.delete(o), (a & Ue) === 0 && (a & ve && (l.f |= Ue), mr(o, Se, n));
      } else if (u) {
        var f = (
          /** @type {Effect} */
          l
        );
        (a & Be) !== 0 && pe !== null && pe.add(f), n !== null ? n.push(f) : Sn(f);
      }
    }
}
const Js = /^[a-zA-Z_$][a-zA-Z_$0-9]*$/;
function ot(e) {
  if (typeof e != "object" || e === null || xt in e)
    return e;
  const t = er(e);
  if (t !== ls && t !== as)
    return e;
  var n = /* @__PURE__ */ new Map(), r = kn(e), s = /* @__PURE__ */ Y(0), i = Je, l = (f) => {
    if (Je === i)
      return f();
    var v = E, d = Je;
    Ve(null), Hn(i);
    var p = f();
    return Ve(v), Hn(d), p;
  };
  r && (n.set("length", /* @__PURE__ */ Y(
    /** @type {any[]} */
    e.length
  )), g && (e = /** @type {any} */
  ei(
    /** @type {any[]} */
    e
  )));
  var a = "";
  let u = false;
  function o(f) {
    if (!u) {
      u = true, a = f, De(s, `${a} version`);
      for (const [v, d] of n)
        De(d, Ye(a, v));
      u = false;
    }
  }
  return new Proxy(
    /** @type {any} */
    e,
    {
      defineProperty(f, v, d) {
        (!("value" in d) || d.configurable === false || d.enumerable === false || d.writable === false) && Es();
        var p = n.get(v);
        return p === void 0 ? l(() => {
          var c = /* @__PURE__ */ Y(d.value);
          return n.set(v, c), g && typeof v == "string" && De(c, Ye(a, v)), c;
        }) : y(p, d.value, true), true;
      },
      deleteProperty(f, v) {
        var d = n.get(v);
        if (d === void 0) {
          if (v in f) {
            const p = l(() => /* @__PURE__ */ Y(H));
            n.set(v, p), ln(s), g && De(p, Ye(a, v));
          }
        } else
          y(d, H), ln(s);
        return true;
      },
      get(f, v, d) {
        var k;
        if (v === xt)
          return e;
        if (g && v === rr)
          return o;
        var p = n.get(v), c = v in f;
        if (p === void 0 && (!c || (k = Vt(f, v)) != null && k.writable) && (p = l(() => {
          var A = ot(c ? f[v] : H), x = /* @__PURE__ */ Y(A);
          return g && De(x, Ye(a, v)), x;
        }), n.set(v, p)), p !== void 0) {
          var w = _(p);
          return w === H ? void 0 : w;
        }
        return Reflect.get(f, v, d);
      },
      getOwnPropertyDescriptor(f, v) {
        var d = Reflect.getOwnPropertyDescriptor(f, v);
        if (d && "value" in d) {
          var p = n.get(v);
          p && (d.value = _(p));
        } else if (d === void 0) {
          var c = n.get(v), w = c == null ? void 0 : c.v;
          if (c !== void 0 && w !== H)
            return {
              enumerable: true,
              configurable: true,
              value: w,
              writable: true
            };
        }
        return d;
      },
      has(f, v) {
        var w;
        if (v === xt)
          return true;
        var d = n.get(v), p = d !== void 0 && d.v !== H || Reflect.has(f, v);
        if (d !== void 0 || M !== null && (!p || (w = Vt(f, v)) != null && w.writable)) {
          d === void 0 && (d = l(() => {
            var k = p ? ot(f[v]) : H, A = /* @__PURE__ */ Y(k);
            return g && De(A, Ye(a, v)), A;
          }), n.set(v, d));
          var c = _(d);
          if (c === H)
            return false;
        }
        return p;
      },
      set(f, v, d, p) {
        var D;
        var c = n.get(v), w = v in f;
        if (r && v === "length")
          for (var k = d; k < /** @type {Source<number>} */
          c.v; k += 1) {
            var A = n.get(k + "");
            A !== void 0 ? y(A, H) : k in f && (A = l(() => /* @__PURE__ */ Y(H)), n.set(k + "", A), g && De(A, Ye(a, k)));
          }
        if (c === void 0)
          (!w || (D = Vt(f, v)) != null && D.writable) && (c = l(() => /* @__PURE__ */ Y(void 0)), g && De(c, Ye(a, v)), y(c, ot(d)), n.set(v, c));
        else {
          w = c.v !== H;
          var x = l(() => ot(d));
          y(c, x);
        }
        var j = Reflect.getOwnPropertyDescriptor(f, v);
        if (j != null && j.set && j.set.call(p, d), !w) {
          if (r && typeof v == "string") {
            var O = (
              /** @type {Source<number>} */
              n.get("length")
            ), z = Number(v);
            Number.isInteger(z) && z >= O.v && y(O, z + 1);
          }
          ln(s);
        }
        return true;
      },
      ownKeys(f) {
        _(s);
        var v = Reflect.ownKeys(f).filter((c) => {
          var w = n.get(c);
          return w === void 0 || w.v !== H;
        });
        for (var [d, p] of n)
          p.v !== H && !(d in f) && v.push(d);
        return v;
      },
      setPrototypeOf() {
        xs();
      }
    }
  );
}
function Ye(e, t) {
  return typeof t == "symbol" ? `${e}[Symbol(${t.description ?? ""})]` : Js.test(t) ? `${e}.${t}` : /^\d+$/.test(t) ? `${e}[${t}]` : `${e}['${t}']`;
}
function Vn(e) {
  try {
    if (e !== null && typeof e == "object" && xt in e)
      return e[xt];
  } catch {
  }
  return e;
}
function Qs(e, t) {
  return Object.is(Vn(e), Vn(t));
}
const $s = /* @__PURE__ */ new Set([
  "copyWithin",
  "fill",
  "pop",
  "push",
  "reverse",
  "shift",
  "sort",
  "splice",
  "unshift"
]);
function ei(e) {
  return new Proxy(e, {
    get(t, n, r) {
      var s = Reflect.get(t, n, r);
      return $s.has(
        /** @type {string} */
        n
      ) ? function(...i) {
        Zs();
        var l = s.apply(this, i);
        return kr(), l;
      } : s;
    }
  });
}
var ti, ni, ri;
function St(e = "") {
  return document.createTextNode(e);
}
// @__NO_SIDE_EFFECTS__
function Fe(e) {
  return (
    /** @type {TemplateNode | null} */
    ni.call(e)
  );
}
// @__NO_SIDE_EFFECTS__
function Ft(e) {
  return (
    /** @type {TemplateNode | null} */
    ri.call(e)
  );
}
function m(e, t) {
  return /* @__PURE__ */ Fe(e);
}
function yr(e, t = false) {
  {
    var n = /* @__PURE__ */ Fe(e);
    return n instanceof Comment && n.data === "" ? /* @__PURE__ */ Ft(n) : n;
  }
}
function T(e, t = 1, n = false) {
  let r = e;
  for (; t--; )
    r = /** @type {TemplateNode} */
    /* @__PURE__ */ Ft(r);
  return r;
}
function si(e) {
  e.textContent = "";
}
function br() {
  return false;
}
function Er(e, t, n) {
  return (
    /** @type {T extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[T] : Element} */
    document.createElementNS(t ?? $n, e, void 0)
  );
}
let Bn = false;
function ii() {
  Bn || (Bn = true, document.addEventListener(
    "reset",
    (e) => {
      Promise.resolve().then(() => {
        var t;
        if (!e.defaultPrevented)
          for (
            const n of
            /**@type {HTMLFormElement} */
            e.target.elements
          )
            (t = n.__on_r) == null || t.call(n);
      });
    },
    // In the capture phase to guarantee we get noticed of it (no possibility of stopPropagation)
    { capture: true }
  ));
}
function zn(e) {
  var t = E, n = M;
  Ve(null), Xe(null);
  try {
    return e();
  } finally {
    Ve(t), Xe(n);
  }
}
function li(e, t, n, r = n) {
  e.addEventListener(t, () => zn(n));
  const s = e.__on_r;
  s ? e.__on_r = () => {
    s(), r(true);
  } : e.__on_r = () => r(true), ii();
}
function ai(e) {
  M === null && (E === null && ms(e), ks()), $e && ws(e);
}
function oi(e, t) {
  var n = t.last;
  n === null ? t.last = t.first = e : (n.next = e, e.prev = n, t.last = e);
}
function tt(e, t) {
  var n = M;
  if (g)
    for (; n !== null && (n.f & Ht) !== 0; )
      n = n.parent;
  n !== null && (n.f & fe) !== 0 && (e |= fe);
  var r = {
    ctx: ie,
    deps: null,
    nodes: null,
    f: e | Q | ve,
    first: null,
    fn: t,
    last: null,
    next: null,
    parent: n,
    b: n && n.b,
    prev: null,
    teardown: null,
    wv: 0,
    ac: null
  };
  g && (r.component_function = Lt);
  var s = r;
  if ((e & ht) !== 0)
    at !== null ? at.push(r) : zt.ensure().schedule(r);
  else if (t !== null) {
    try {
      wt(r);
    } catch (l) {
      throw Re(r), l;
    }
    s.deps === null && s.teardown === null && s.nodes === null && s.first === s.last && // either `null`, or a singular child
    (s.f & en) === 0 && (s = s.first, (e & Be) !== 0 && (e & Mt) !== 0 && s !== null && (s.f |= Mt));
  }
  if (s !== null && (s.parent = n, n !== null && oi(s, n), E !== null && (E.f & B) !== 0 && (e & pt) === 0)) {
    var i = (
      /** @type {Derived} */
      E
    );
    (i.effects ?? (i.effects = [])).push(s);
  }
  return r;
}
function xr() {
  return E !== null && !ke;
}
function Sr(e) {
  const t = tt(yn, null);
  return F(t, V), t.teardown = e, t;
}
function fi(e) {
  ai("$effect"), g && _t(e, "name", {
    value: "$effect"
  });
  var t = (
    /** @type {Effect} */
    M.f
  ), n = !E && (t & ye) !== 0 && (t & et) === 0;
  if (n) {
    var r = (
      /** @type {ComponentContext} */
      ie
    );
    (r.e ?? (r.e = [])).push(e);
  } else
    return Ar(e);
}
function Ar(e) {
  return tt(ht | vs, e);
}
function ui(e) {
  return tt(ht, e);
}
function ci(e) {
  return tt(tn | en, e);
}
function oe(e, t = [], n = [], r = []) {
  Vs(r, t, n, (s) => {
    tt(yn, () => e(...s.map(_)));
  });
}
function Mr(e, t = 0) {
  var n = tt(Be | t, e);
  return g && (n.dev_stack = Tt), n;
}
function Nt(e) {
  return tt(ye | en, e);
}
function Tr(e) {
  var t = e.teardown;
  if (t !== null) {
    const n = $e, r = E;
    qn(true), Ve(null);
    try {
      t.call(null);
    } finally {
      qn(n), Ve(r);
    }
  }
}
function In(e, t = false) {
  var n = e.first;
  for (e.first = e.last = null; n !== null; ) {
    const s = n.ac;
    s !== null && zn(() => {
      s.abort(ze);
    });
    var r = n.next;
    (n.f & pt) !== 0 ? n.parent = null : Re(n, t), n = r;
  }
}
function vi(e) {
  for (var t = e.first; t !== null; ) {
    var n = t.next;
    (t.f & ye) === 0 && Re(t), t = n;
  }
}
function Re(e, t = true) {
  var n = false;
  (t || (e.f & cs) !== 0) && e.nodes !== null && e.nodes.end !== null && (zr(
    e.nodes.start,
    /** @type {TemplateNode} */
    e.nodes.end
  ), n = true), F(e, On), In(e, t && !n), Pt(e, 0);
  var r = e.nodes && e.nodes.t;
  if (r !== null)
    for (const i of r)
      i.stop();
  Tr(e), e.f ^= On, e.f |= me;
  var s = e.parent;
  s !== null && s.first !== null && Ir(e), g && (e.component_function = null), e.next = e.prev = e.teardown = e.ctx = e.deps = e.fn = e.nodes = e.ac = null;
}
function zr(e, t) {
  for (; e !== null; ) {
    var n = e === t ? null : /* @__PURE__ */ Ft(e);
    e.remove(), e = n;
  }
}
function Ir(e) {
  var t = e.parent, n = e.prev, r = e.next;
  n !== null && (n.next = r), r !== null && (r.prev = n), t !== null && (t.first === e && (t.first = r), t.last === e && (t.last = n));
}
function Cn(e, t, n = true) {
  var r = [];
  Cr(e, r, true);
  var s = () => {
    n && Re(e), t && t();
  }, i = r.length;
  if (i > 0) {
    var l = () => --i || s();
    for (var a of r)
      a.out(l);
  } else
    s();
}
function Cr(e, t, n) {
  if ((e.f & fe) === 0) {
    e.f ^= fe;
    var r = e.nodes && e.nodes.t;
    if (r !== null)
      for (const a of r)
        (a.is_global || n) && t.push(a);
    for (var s = e.first; s !== null; ) {
      var i = s.next, l = (s.f & Mt) !== 0 || // If this is a branch effect without a block effect parent,
      // it means the parent block effect was pruned. In that case,
      // transparency information was transferred to the branch effect.
      (s.f & ye) !== 0 && (e.f & Be) !== 0;
      Cr(s, t, l ? n : false), s = i;
    }
  }
}
function Nn(e) {
  Nr(e, true);
}
function Nr(e, t) {
  if ((e.f & fe) !== 0) {
    e.f ^= fe, (e.f & V) === 0 && (F(e, Q), zt.ensure().schedule(e));
    for (var n = e.first; n !== null; ) {
      var r = n.next, s = (n.f & Mt) !== 0 || (n.f & ye) !== 0;
      Nr(n, s ? t : false), n = r;
    }
    var i = e.nodes && e.nodes.t;
    if (i !== null)
      for (const l of i)
        (l.is_global || t) && l.in();
  }
}
function Pr(e, t) {
  if (e.nodes)
    for (var n = e.nodes.start, r = e.nodes.end; n !== null; ) {
      var s = n === r ? null : /* @__PURE__ */ Ft(n);
      t.append(n), n = s;
    }
}
let qt = false, $e = false;
function qn(e) {
  $e = e;
}
let E = null, ke = false;
function Ve(e) {
  E = e;
}
let M = null;
function Xe(e) {
  M = e;
}
let de = null;
function Rr(e) {
  E !== null && (de === null ? de = [e] : de.push(e));
}
let se = null, le = 0, ce = null;
function di(e) {
  ce = e;
}
let Or = 1, Ge = 0, Je = Ge;
function Hn(e) {
  Je = e;
}
function Dr() {
  return ++Or;
}
function jt(e) {
  var t = e.f;
  if ((t & Q) !== 0)
    return true;
  if (t & B && (e.f &= ~Ue), (t & Se) !== 0) {
    for (var n = (
      /** @type {Value[]} */
      e.deps
    ), r = n.length, s = 0; s < r; s++) {
      var i = n[s];
      if (jt(
        /** @type {Derived} */
        i
      ) && gr(
        /** @type {Derived} */
        i
      ), i.wv > e.wv)
        return true;
    }
    (t & ve) !== 0 && // During time traveling we don't want to reset the status so that
    // traversal of the graph in the other batches still happens
    W === null && F(e, V);
  }
  return false;
}
function Lr(e, t, n = true) {
  var r = e.reactions;
  if (r !== null && !(de !== null && Qe.call(de, e)))
    for (var s = 0; s < r.length; s++) {
      var i = r[s];
      (i.f & B) !== 0 ? Lr(
        /** @type {Derived} */
        i,
        t,
        false
      ) : t === i && (n ? F(i, Q) : (i.f & V) !== 0 && F(i, Se), Sn(
        /** @type {Effect} */
        i
      ));
    }
}
function pn(e) {
  var w;
  var t = se, n = le, r = ce, s = E, i = de, l = ie, a = ke, u = Je, o = e.f;
  se = /** @type {null | Value[]} */
  null, le = 0, ce = null, E = (o & (ye | pt)) === 0 ? e : null, de = null, Yt(e.ctx), ke = false, Je = ++Ge, e.ac !== null && (zn(() => {
    e.ac.abort(ze);
  }), e.ac = null);
  try {
    e.f |= fn;
    var f = (
      /** @type {Function} */
      e.fn
    ), v = f();
    e.f |= et;
    var d = e.deps, p = b == null ? void 0 : b.is_fork;
    if (se !== null) {
      var c;
      if (p || Pt(e, le), d !== null && le > 0)
        for (d.length = le + se.length, c = 0; c < se.length; c++)
          d[le + c] = se[c];
      else
        e.deps = d = se;
      if (xr() && (e.f & ve) !== 0)
        for (c = le; c < d.length; c++)
          ((w = d[c]).reactions ?? (w.reactions = [])).push(e);
    } else !p && d !== null && le < d.length && (Pt(e, le), d.length = le);
    if (or() && ce !== null && !ke && d !== null && (e.f & (B | Se | Q)) === 0)
      for (c = 0; c < /** @type {Source[]} */
      ce.length; c++)
        Lr(
          ce[c],
          /** @type {Effect} */
          e
        );
    if (s !== null && s !== e) {
      if (Ge++, s.deps !== null)
        for (let k = 0; k < n; k += 1)
          s.deps[k].rv = Ge;
      if (t !== null)
        for (const k of t)
          k.rv = Ge;
      ce !== null && (r === null ? r = ce : r.push(.../** @type {Source[]} */
      ce));
    }
    return (e.f & je) !== 0 && (e.f ^= je), v;
  } catch (k) {
    return Os(k);
  } finally {
    e.f ^= fn, se = t, le = n, ce = r, E = s, de = i, Yt(l), ke = a, Je = u;
  }
}
function _i(e, t) {
  let n = t.reactions;
  if (n !== null) {
    var r = ss.call(n, e);
    if (r !== -1) {
      var s = n.length - 1;
      s === 0 ? n = t.reactions = null : (n[r] = n[s], n.pop());
    }
  }
  if (n === null && (t.f & B) !== 0 && // Destroying a child effect while updating a parent effect can cause a dependency to appear
  // to be unused, when in fact it is used by the currently-updating parent. Checking `new_deps`
  // allows us to skip the expensive work of disconnecting and immediately reconnecting it
  (se === null || !Qe.call(se, t))) {
    var i = (
      /** @type {Derived} */
      t
    );
    (i.f & ve) !== 0 && (i.f ^= ve, i.f &= ~Ue), xn(i), Ws(i), Pt(i, 0);
  }
}
function Pt(e, t) {
  var n = e.deps;
  if (n !== null)
    for (var r = t; r < n.length; r++)
      _i(e, n[r]);
}
function wt(e) {
  var t = e.f;
  if ((t & me) === 0) {
    F(e, V);
    var n = M, r = qt;
    if (M = e, qt = true, g) {
      var s = Lt;
      Dn(e.component_function);
      var i = (
        /** @type {any} */
        Tt
      );
      Gt(e.dev_stack ?? Tt);
    }
    try {
      (t & (Be | nr)) !== 0 ? vi(e) : In(e), Tr(e);
      var l = pn(e);
      e.teardown = typeof l == "function" ? l : null, e.wv = Or;
      var a;
      g && Is && (e.f & Q) !== 0 && e.deps;
    } finally {
      qt = r, M = n, g && (Dn(s), Gt(i));
    }
  }
}
function _(e) {
  var t = e.f, n = (t & B) !== 0;
  if (E !== null && !ke) {
    var r = M !== null && (M.f & me) !== 0;
    if (!r && (de === null || !Qe.call(de, e))) {
      var s = E.deps;
      if ((E.f & fn) !== 0)
        e.rv < Ge && (e.rv = Ge, se === null && s !== null && s[le] === e ? le++ : se === null ? se = [e] : se.push(e));
      else {
        (E.deps ?? (E.deps = [])).push(e);
        var i = e.reactions;
        i === null ? e.reactions = [E] : Qe.call(i, E) || i.push(E);
      }
    }
  }
  if (g && qs.delete(e), $e && Ke.has(e))
    return Ke.get(e);
  if (n) {
    var l = (
      /** @type {Derived} */
      e
    );
    if ($e) {
      var a = l.v;
      return ((l.f & V) === 0 && l.reactions !== null || jr(l)) && (a = Mn(l)), Ke.set(l, a), a;
    }
    var u = (l.f & ve) === 0 && !ke && E !== null && (qt || (E.f & ve) !== 0), o = (l.f & et) === 0;
    jt(l) && (u && (l.f |= ve), gr(l)), u && !o && (wr(l), Fr(l));
  }
  if (W != null && W.has(e))
    return W.get(e);
  if ((e.f & je) !== 0)
    throw e.v;
  return e.v;
}
function Fr(e) {
  if (e.f |= ve, e.deps !== null)
    for (const t of e.deps)
      (t.reactions ?? (t.reactions = [])).push(e), (t.f & B) !== 0 && (t.f & ve) === 0 && (wr(
        /** @type {Derived} */
        t
      ), Fr(
        /** @type {Derived} */
        t
      ));
}
function jr(e) {
  if (e.v === H) return true;
  if (e.deps === null) return false;
  for (const t of e.deps)
    if (Ke.has(t) || (t.f & B) !== 0 && jr(
      /** @type {Derived} */
      t
    ))
      return true;
  return false;
}
function hi(e) {
  var t = ke;
  try {
    return ke = true, e();
  } finally {
    ke = t;
  }
}
const an = /* @__PURE__ */ Symbol("events"), pi = /* @__PURE__ */ new Set(), gi = /* @__PURE__ */ new Set();
function Te(e, t, n) {
  (t[an] ?? (t[an] = {}))[e] = n;
}
function Kr(e) {
  for (var t = 0; t < e.length; t++)
    pi.add(e[t]);
  for (var n of gi)
    n(e);
}
var Qn;
const on = (
  // We gotta write it like this because after downleveling the pure comment may end up in the wrong location
  ((Qn = globalThis == null ? void 0 : globalThis.window) == null ? void 0 : Qn.trustedTypes) && /* @__PURE__ */ globalThis.window.trustedTypes.createPolicy("svelte-trusted-html", {
    /** @param {string} html */
    createHTML: (e) => e
  })
);
function wi(e) {
  return (
    /** @type {string} */
    (on == null ? void 0 : on.createHTML(e)) ?? e
  );
}
function ki(e) {
  var t = Er("template");
  return t.innerHTML = wi(e.replaceAll("<!>", "<!---->")), t.content;
}
function Xt(e, t) {
  var n = (
    /** @type {Effect} */
    M
  );
  n.nodes === null && (n.nodes = { start: e, end: t, a: null, t: null });
}
// @__NO_SIDE_EFFECTS__
function N(e, t) {
  var n = (t & $r) !== 0, r = (t & es) !== 0, s, i = !e.startsWith("<!>");
  return () => {
    s === void 0 && (s = ki(i ? e : "<!>" + e), n || (s = /** @type {TemplateNode} */
    /* @__PURE__ */ Fe(s)));
    var l = (
      /** @type {TemplateNode} */
      r || ti ? document.importNode(s, true) : s.cloneNode(true)
    );
    if (n) {
      var a = (
        /** @type {TemplateNode} */
        /* @__PURE__ */ Fe(l)
      ), u = (
        /** @type {TemplateNode} */
        l.lastChild
      );
      Xt(a, u);
    } else
      Xt(l, l);
    return l;
  };
}
function C(e, t) {
  e !== null && e.before(
    /** @type {Node} */
    t
  );
}
function G(e, t) {
  var n = t == null ? "" : typeof t == "object" ? `${t}` : t;
  n !== (e.__t ?? (e.__t = e.nodeValue)) && (e.__t = n, e.nodeValue = `${n}`);
}
var ge, xe, ae, Ze, Ot, Dt, $t;
class mi {
  /**
   * @param {TemplateNode} anchor
   * @param {boolean} transition
   */
  constructor(t, n = true) {
    Oe(this, "anchor");
    U(this, ge, /* @__PURE__ */ new Map());
    U(this, xe, /* @__PURE__ */ new Map());
    U(this, ae, /* @__PURE__ */ new Map());
    U(this, Ze, /* @__PURE__ */ new Set());
    U(this, Ot, true);
    U(this, Dt, (t2) => {
      if (h(this, ge).has(t2)) {
        var n2 = (
          /** @type {Key} */
          h(this, ge).get(t2)
        ), r = h(this, xe).get(n2);
        if (r)
          Nn(r), h(this, Ze).delete(n2);
        else {
          var s = h(this, ae).get(n2);
          s && (h(this, xe).set(n2, s.effect), h(this, ae).delete(n2), s.fragment.lastChild.remove(), this.anchor.before(s.fragment), r = s.effect);
        }
        for (const [i, l] of h(this, ge)) {
          if (h(this, ge).delete(i), i === t2)
            break;
          const a = h(this, ae).get(l);
          a && (Re(a.effect), h(this, ae).delete(l));
        }
        for (const [i, l] of h(this, xe)) {
          if (i === n2 || h(this, Ze).has(i)) continue;
          const a = () => {
            if (Array.from(h(this, ge).values()).includes(i)) {
              var o = document.createDocumentFragment();
              Pr(l, o), o.append(St()), h(this, ae).set(i, { effect: l, fragment: o });
            } else
              Re(l);
            h(this, Ze).delete(i), h(this, xe).delete(i);
          };
          h(this, Ot) || !r ? (h(this, Ze).add(i), Cn(l, a, false)) : a();
        }
      }
    });
    U(this, $t, (t2) => {
      h(this, ge).delete(t2);
      const n2 = Array.from(h(this, ge).values());
      for (const [r, s] of h(this, ae))
        n2.includes(r) || (Re(s.effect), h(this, ae).delete(r));
    });
    this.anchor = t, he(this, Ot, n);
  }
  /**
   *
   * @param {any} key
   * @param {null | ((target: TemplateNode) => void)} fn
   */
  ensure(t, n) {
    var r = (
      /** @type {Batch} */
      b
    ), s = br();
    if (n && !h(this, xe).has(t) && !h(this, ae).has(t))
      h(this, xe).set(
        t,
        Nt(() => n(this.anchor))
      );
    if (h(this, ge).set(r, t), s) ;
    else
      h(this, Dt).call(this, r);
  }
}
ge = /* @__PURE__ */ new WeakMap(), xe = /* @__PURE__ */ new WeakMap(), ae = /* @__PURE__ */ new WeakMap(), Ze = /* @__PURE__ */ new WeakMap(), Ot = /* @__PURE__ */ new WeakMap(), Dt = /* @__PURE__ */ new WeakMap(), $t = /* @__PURE__ */ new WeakMap();
if (g) {
  let e = function(t) {
    if (!(t in globalThis)) {
      let n;
      Object.defineProperty(globalThis, t, {
        configurable: true,
        // eslint-disable-next-line getter-return
        get: () => {
          if (n !== void 0)
            return n;
          bs(t);
        },
        set: (r) => {
          n = r;
        }
      });
    }
  };
  e("$state"), e("$effect"), e("$derived"), e("$inspect"), e("$props"), e("$bindable");
}
function we(e, t, n = false) {
  var r = new mi(e), s = n ? Mt : 0;
  function i(l, a) {
    r.ensure(l, a);
  }
  Mr(() => {
    var l = false;
    t((a, u = 0) => {
      l = true, i(u, a);
    }), l || i(-1, null);
  }, s);
}
function gn(e, t) {
  return t;
}
function yi(e, t, n) {
  for (var r = [], s = t.length, i, l = t.length, a = 0; a < s; a++) {
    let v = t[a];
    Cn(
      v,
      () => {
        if (i) {
          if (i.pending.delete(v), i.done.add(v), i.pending.size === 0) {
            var d = (
              /** @type {Set<EachOutroGroup>} */
              e.outrogroups
            );
            wn(e, mn(i.done)), d.delete(i), d.size === 0 && (e.outrogroups = null);
          }
        } else
          l -= 1;
      },
      false
    );
  }
  if (l === 0) {
    var u = r.length === 0 && n !== null;
    if (u) {
      var o = (
        /** @type {Element} */
        n
      ), f = (
        /** @type {Element} */
        o.parentNode
      );
      si(f), f.append(o), e.items.clear();
    }
    wn(e, t, !u);
  } else
    i = {
      pending: new Set(t),
      done: /* @__PURE__ */ new Set()
    }, (e.outrogroups ?? (e.outrogroups = /* @__PURE__ */ new Set())).add(i);
}
function wn(e, t, n = true) {
  var r;
  if (e.pending.size > 0) {
    r = /* @__PURE__ */ new Set();
    for (const l of e.pending.values())
      for (const a of l)
        r.add(
          /** @type {EachItem} */
          e.items.get(a).e
        );
  }
  for (var s = 0; s < t.length; s++) {
    var i = t[s];
    if (r != null && r.has(i)) {
      i.f |= Pe;
      const l = document.createDocumentFragment();
      Pr(i, l);
    } else
      Re(t[s], n);
  }
}
var Yn;
function Jt(e, t, n, r, s, i = null) {
  var l = e, a = /* @__PURE__ */ new Map();
  {
    var u = (
      /** @type {Element} */
      e
    );
    l = u.appendChild(St());
  }
  var o = null, f = /* @__PURE__ */ Ys(() => {
    var x = n();
    return kn(x) ? x : x == null ? [] : mn(x);
  }), v, d = /* @__PURE__ */ new Map(), p = true;
  function c(x) {
    (A.effect.f & me) === 0 && (A.pending.delete(x), A.fallback = o, bi(A, v, l, t, r), o !== null && (v.length === 0 ? (o.f & Pe) === 0 ? Nn(o) : (o.f ^= Pe, Et(o, null, l)) : Cn(o, () => {
      o = null;
    })));
  }
  function w(x) {
    A.pending.delete(x);
  }
  var k = Mr(() => {
    v = /** @type {V[]} */
    _(f);
    for (var x = v.length, j = /* @__PURE__ */ new Set(), O = (
      /** @type {Batch} */
      b
    ), z = br(), D = 0; D < x; D += 1) {
      var q = v[D], Z = r(q, D);
      if (g) {
        var I = r(q, D);
        Z !== I && gs(String(D), String(Z), String(I));
      }
      var R = p ? null : a.get(Z);
      R ? (R.v && Ct(R.v, q), R.i && Ct(R.i, D), z && O.unskip_effect(R.e)) : (R = Ei(
        a,
        p ? l : Yn ?? (Yn = St()),
        q,
        Z,
        D,
        s,
        t,
        n
      ), p || (R.e.f |= Pe), a.set(Z, R)), j.add(Z);
    }
    if (x === 0 && i && !o && (p ? o = Nt(() => i(l)) : (o = Nt(() => i(Yn ?? (Yn = St()))), o.f |= Pe)), x > j.size && (g ? xi(v, r) : sr("", "", "")), !p)
      if (d.set(O, j), z) {
        for (const [S, P] of a)
          j.has(S) || O.skip_effect(P.e);
        O.oncommit(c), O.ondiscard(w);
      } else
        c(O);
    _(f);
  }), A = { effect: k, items: a, pending: d, outrogroups: null, fallback: o };
  p = false;
}
function bt(e) {
  for (; e !== null && (e.f & ye) === 0; )
    e = e.next;
  return e;
}
function bi(e, t, n, r, s) {
  var Z;
  var i = t.length, l = e.items, a = bt(e.effect.first), u, o = null, f = [], v = [], d, p, c, w;
  for (w = 0; w < i; w += 1) {
    if (d = t[w], p = s(d, w), c = /** @type {EachItem} */
    l.get(p).e, e.outrogroups !== null)
      for (const I of e.outrogroups)
        I.pending.delete(c), I.done.delete(c);
    if ((c.f & Pe) !== 0)
      if (c.f ^= Pe, c === a)
        Et(c, null, n);
      else {
        var k = o ? o.next : a;
        c === e.effect.last && (e.effect.last = c.prev), c.prev && (c.prev.next = c.next), c.next && (c.next.prev = c.prev), Le(e, o, c), Le(e, c, k), Et(c, k, n), o = c, f = [], v = [], a = bt(o.next);
        continue;
      }
    if ((c.f & fe) !== 0 && Nn(c), c !== a) {
      if (u !== void 0 && u.has(c)) {
        if (f.length < v.length) {
          var A = v[0], x;
          o = A.prev;
          var j = f[0], O = f[f.length - 1];
          for (x = 0; x < f.length; x += 1)
            Et(f[x], A, n);
          for (x = 0; x < v.length; x += 1)
            u.delete(v[x]);
          Le(e, j.prev, O.next), Le(e, o, j), Le(e, O, A), a = A, o = O, w -= 1, f = [], v = [];
        } else
          u.delete(c), Et(c, a, n), Le(e, c.prev, c.next), Le(e, c, o === null ? e.effect.first : o.next), Le(e, o, c), o = c;
        continue;
      }
      for (f = [], v = []; a !== null && a !== c; )
        (u ?? (u = /* @__PURE__ */ new Set())).add(a), v.push(a), a = bt(a.next);
      if (a === null)
        continue;
    }
    (c.f & Pe) === 0 && f.push(c), o = c, a = bt(c.next);
  }
  if (e.outrogroups !== null) {
    for (const I of e.outrogroups)
      I.pending.size === 0 && (wn(e, mn(I.done)), (Z = e.outrogroups) == null || Z.delete(I));
    e.outrogroups.size === 0 && (e.outrogroups = null);
  }
  if (a !== null || u !== void 0) {
    var z = [];
    if (u !== void 0)
      for (c of u)
        (c.f & fe) === 0 && z.push(c);
    for (; a !== null; )
      (a.f & fe) === 0 && a !== e.fallback && z.push(a), a = bt(a.next);
    var D = z.length;
    if (D > 0) {
      var q = i === 0 ? n : null;
      yi(e, z, q);
    }
  }
}
function Ei(e, t, n, r, s, i, l, a) {
  var u = (l & Xr) !== 0 ? (l & Qr) === 0 ? /* @__PURE__ */ Xs(n, false, false) : It(n) : null, o = (l & Jr) !== 0 ? It(s) : null;
  return g && u && (u.trace = () => {
    a()[(o == null ? void 0 : o.v) ?? s];
  }), {
    v: u,
    i: o,
    e: Nt(() => (i(t, u ?? n, o ?? s, a), () => {
      e.delete(r);
    }))
  };
}
function Et(e, t, n) {
  if (e.nodes)
    for (var r = e.nodes.start, s = e.nodes.end, i = t && (t.f & Pe) === 0 ? (
      /** @type {EffectNodes} */
      t.nodes.start
    ) : n; r !== null; ) {
      var l = (
        /** @type {TemplateNode} */
        /* @__PURE__ */ Ft(r)
      );
      if (i.before(r), r === s)
        return;
      r = l;
    }
}
function Le(e, t, n) {
  t === null ? e.effect.first = n : t.next = n, n === null ? e.effect.last = t : n.prev = t;
}
function xi(e, t) {
  const n = /* @__PURE__ */ new Map(), r = e.length;
  for (let s = 0; s < r; s++) {
    const i = t(e[s], s);
    if (n.has(i)) {
      const l = String(n.get(i)), a = String(s);
      let u = String(i);
      u.startsWith("[object ") && (u = null), sr(l, a, u);
    }
    n.set(i, s);
  }
}
function Ur(e, t, n = false, r = false, s = false, i = false) {
  var l = e, a = "";
  if (n)
    var u = (
      /** @type {Element} */
      e
    );
  oe(() => {
    var o = (
      /** @type {Effect} */
      M
    );
    if (a !== (a = t() ?? "")) {
      if (n) {
        o.nodes = null, u.innerHTML = /** @type {string} */
        a, a !== "" && Xt(
          /** @type {TemplateNode} */
          /* @__PURE__ */ Fe(u),
          /** @type {TemplateNode} */
          u.lastChild
        );
        return;
      }
      if (o.nodes !== null && (zr(
        o.nodes.start,
        /** @type {TemplateNode} */
        o.nodes.end
      ), o.nodes = null), a !== "") {
        var f = r ? ns : s ? rs : void 0, v = (
          /** @type {HTMLTemplateElement | SVGElement | MathMLElement} */
          Er(r ? "svg" : s ? "math" : "template", f)
        );
        v.innerHTML = /** @type {any} */
        a;
        var d = r || s ? v : (
          /** @type {HTMLTemplateElement} */
          v.content
        );
        if (Xt(
          /** @type {TemplateNode} */
          /* @__PURE__ */ Fe(d),
          /** @type {TemplateNode} */
          d.lastChild
        ), r || s)
          for (; /* @__PURE__ */ Fe(d); )
            l.before(
              /** @type {TemplateNode} */
              /* @__PURE__ */ Fe(d)
            );
        else
          l.before(d);
      }
    }
  });
}
const Gn = [...` 	
\r\f \v\uFEFF`];
function Si(e, t, n) {
  var r = "" + e;
  if (n) {
    for (var s of Object.keys(n))
      if (n[s])
        r = r ? r + " " + s : s;
      else if (r.length)
        for (var i = s.length, l = 0; (l = r.indexOf(s, l)) >= 0; ) {
          var a = l + i;
          (l === 0 || Gn.includes(r[l - 1])) && (a === r.length || Gn.includes(r[a])) ? r = (l === 0 ? "" : r.substring(0, l)) + r.substring(a + 1) : l = a;
        }
  }
  return r === "" ? null : r;
}
function Ai(e, t, n, r, s, i) {
  var l = e.__className;
  if (l !== n || l === void 0) {
    var a = Si(n, r, i);
    a == null ? e.removeAttribute("class") : e.className = a, e.__className = n;
  } else if (i && s !== i)
    for (var u in i) {
      var o = !!i[u];
      (s == null || o !== !!s[u]) && e.classList.toggle(u, o);
    }
  return i;
}
function Vr(e, t, n = false) {
  if (e.multiple) {
    if (t == null)
      return;
    if (!kn(t))
      return Ts();
    for (var r of e.options)
      r.selected = t.includes(At(r));
    return;
  }
  for (r of e.options) {
    var s = At(r);
    if (Qs(s, t)) {
      r.selected = true;
      return;
    }
  }
  (!n || t !== void 0) && (e.selectedIndex = -1);
}
function Mi(e) {
  var t = new MutationObserver(() => {
    Vr(e, e.__value);
  });
  t.observe(e, {
    // Listen to option element changes
    childList: true,
    subtree: true,
    // because of <optgroup>
    // Listen to option element value attribute changes
    // (doesn't get notified of select value changes,
    // because that property is not reflected as an attribute)
    attributes: true,
    attributeFilter: ["value"]
  }), Sr(() => {
    t.disconnect();
  });
}
function Ti(e, t, n = t) {
  var r = /* @__PURE__ */ new WeakSet(), s = true;
  li(e, "change", (i) => {
    var l = i ? "[selected]" : ":checked", a;
    if (e.multiple)
      a = [].map.call(e.querySelectorAll(l), At);
    else {
      var u = e.querySelector(l) ?? // will fall back to first non-disabled option if no option is selected
      e.querySelector("option:not([disabled])");
      a = u && At(u);
    }
    n(a), e.__value = a, b !== null && r.add(b);
  }), ui(() => {
    var i = t();
    if (e === document.activeElement) {
      var l = (
        /** @type {Batch} */
        b
      );
      if (r.has(l))
        return;
    }
    if (Vr(e, i, s), s && i === void 0) {
      var a = e.querySelector(":checked");
      a !== null && (i = At(a), n(i));
    }
    e.__value = i, s = false;
  }), Mi(e);
}
function At(e) {
  return "__value" in e ? e.__value : e.value;
}
const zi = /* @__PURE__ */ Symbol("is custom element"), Ii = /* @__PURE__ */ Symbol("is html");
function Ee(e, t, n, r) {
  var s = Ci(e);
  s[t] !== (s[t] = n) && (t === "loading" && (e[ds] = n), n == null ? e.removeAttribute(t) : typeof n != "string" && Ni(e).includes(t) ? e[t] = n : e.setAttribute(t, n));
}
function Ci(e) {
  return (
    /** @type {Record<string | symbol, unknown>} **/
    // @ts-expect-error
    e.__attributes ?? (e.__attributes = {
      [zi]: e.nodeName.includes("-"),
      [Ii]: e.namespaceURI === $n
    })
  );
}
var Wn = /* @__PURE__ */ new Map();
function Ni(e) {
  var t = e.getAttribute("is") || e.nodeName, n = Wn.get(t);
  if (n) return n;
  Wn.set(t, n = []);
  for (var r, s = e, i = Element.prototype; i !== s; ) {
    r = is(s);
    for (var l in r)
      r[l].set && n.push(l);
    s = er(s);
  }
  return n;
}
function Pi(e, t, n, r) {
  var s = (
    /** @type {V} */
    r
  ), i = true, l = () => (i && (i = false, s = hi(
    /** @type {() => V} */
    r
  )), s), a;
  a = /** @type {V} */
  e[t], a === void 0 && r !== void 0 && (a = l());
  var u;
  return u = () => {
    var o = (
      /** @type {V} */
      e[t]
    );
    return o === void 0 ? l() : (i = true, o);
  }, u;
}
const Ri = {
  openai: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
  anthropic: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>',
  google: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>'
}, Oi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
function Br(e) {
  return Ri[e] ?? Oi;
}
var Di = /* @__PURE__ */ N('<div class="rk-empty svelte-1dtkzz1"><p class="rk-empty-text svelte-1dtkzz1">No API keys yet. Add your first key to get started.</p> <button type="button" class="rk-btn rk-btn-primary svelte-1dtkzz1" aria-label="Add your first API key">Add key</button></div>'), Li = /* @__PURE__ */ N("<option> </option>"), Fi = /* @__PURE__ */ N('<label for="rk-provider-select" class="rk-label svelte-1dtkzz1">Provider</label> <select id="rk-provider-select" class="rk-select svelte-1dtkzz1" aria-label="Select provider"></select>', 1), ji = /* @__PURE__ */ N('<p class="rk-error svelte-1dtkzz1" role="alert"> </p>'), Ki = /* @__PURE__ */ N('<div class="rk-form svelte-1dtkzz1"><!> <label for="rk-key-input" class="rk-label svelte-1dtkzz1">Your API key</label> <input id="rk-key-input" type="password" class="rk-input svelte-1dtkzz1" placeholder="sk-…" aria-label="API key (never shown in full)" autocomplete="off"/> <!> <div class="rk-actions svelte-1dtkzz1"><button type="button" class="rk-btn rk-btn-secondary svelte-1dtkzz1">Cancel</button> <button type="button" class="rk-btn rk-btn-primary svelte-1dtkzz1"> </button></div></div>'), Ui = /* @__PURE__ */ N('<div class="rk-entry svelte-1dtkzz1" role="dialog" aria-labelledby="rk-entry-heading" aria-modal="true" tabindex="-1"><h2 id="rk-entry-heading" class="rk-heading svelte-1dtkzz1">Add API key</h2> <!></div>'), Vi = /* @__PURE__ */ N('<div class="rk-detail svelte-1dtkzz1" role="region"><p class="rk-detail-meta svelte-1dtkzz1"> </p> <button type="button" class="rk-btn rk-btn-danger svelte-1dtkzz1" aria-label="Remove this API key">Remove key</button></div>'), Bi = /* @__PURE__ */ N('<li class="rk-list-item svelte-1dtkzz1"><div class="rk-list-row svelte-1dtkzz1" role="button" tabindex="0"><span class="rk-list-icon svelte-1dtkzz1" aria-hidden="true"></span> <span class="rk-list-provider svelte-1dtkzz1"> </span> <span class="rk-list-masked svelte-1dtkzz1"> </span> <span class="rk-list-status svelte-1dtkzz1">Active</span> <span class="rk-list-chevron svelte-1dtkzz1" aria-hidden="true"> </span></div> <!></li>'), qi = /* @__PURE__ */ N('<div class="rk-list svelte-1dtkzz1"><div class="rk-list-header svelte-1dtkzz1"><h2 class="rk-heading svelte-1dtkzz1">Your keys</h2> <button type="button" class="rk-btn rk-btn-primary svelte-1dtkzz1" aria-label="Add another API key">Add key</button></div> <ul class="rk-list-ul svelte-1dtkzz1" role="list"></ul></div>'), Hi = /* @__PURE__ */ N('<div class="rk-keys rk-dark svelte-1dtkzz1" role="region" aria-label="API key settings"><div aria-live="polite" aria-atomic="true" class="rk-sr-only svelte-1dtkzz1"> </div> <!></div>');
function fl(e, t) {
  bn(t, true);
  let n = Pi(t, "providers", 19, () => []);
  const r = /* @__PURE__ */ Ie(() => {
    var S;
    return ((S = t.keys.config) == null ? void 0 : S.keys) ?? [];
  });
  let s = /* @__PURE__ */ Y("list"), i = /* @__PURE__ */ Y(null), l = /* @__PURE__ */ Y(""), a = /* @__PURE__ */ Y("provider"), u = /* @__PURE__ */ Y(null), o = /* @__PURE__ */ Y(false), f = /* @__PURE__ */ Y("");
  const v = /* @__PURE__ */ Ie(() => _(r).length === 0 && _(s) !== "entry"), d = /* @__PURE__ */ Ie(() => _(s) === "entry"), p = /* @__PURE__ */ Ie(() => _(r).length > 0 && _(s) !== "entry");
  function c(S) {
    return S && /^[\w-]+$/.test(S) ? S : "••••••••";
  }
  function w() {
    y(s, "entry"), y(a, "provider"), y(l, n().length ? n()[0].id : "", true), y(u, null), y(f, "");
  }
  function k() {
    y(s, "list"), y(a, "provider"), y(u, null), y(o, false);
  }
  async function A() {
    var X, _e, ee, ue, ne;
    const S = (_e = (X = document.getElementById("rk-key-input")) == null ? void 0 : X.value) == null ? void 0 : _e.trim();
    if (!S || !_(l)) {
      y(u, "Enter your API key and select a provider.");
      return;
    }
    const P = n().find((L) => L.id === _(l));
    if (!P) {
      y(u, "Unknown provider.");
      return;
    }
    y(o, true), y(u, null), y(f, "Validating your key…");
    try {
      const L = await P.validateKey(S);
      if (L.valid) {
        y(f, "Key validated. Saving.");
        const te = { id: ((ee = crypto.randomUUID) == null ? void 0 : ee.call(crypto)) ?? `key-${Date.now()}`, provider: _(l), label: c() };
        (ue = t.onKeyAdded) == null || ue.call(t, te, S), y(f, "Key added."), k();
      } else
        y(u, ((ne = L.errors) == null ? void 0 : ne.join(" ")) ?? "Key validation failed.", true), y(f, _(u), true);
    } catch (L) {
      y(u, L instanceof Error ? L.message : "Validation failed.", true), y(f, _(u), true);
    } finally {
      y(o, false);
    }
  }
  function x(S) {
    var P;
    (P = t.onKeyRemoved) == null || P.call(t, S), y(i, null), y(f, "Key removed.");
  }
  function j(S) {
    y(i, _(i) === S ? null : S, true);
  }
  var O = Hi(), z = m(O), D = m(z), q = T(z, 2);
  {
    var Z = (S) => {
      var P = Di(), X = T(m(P), 2);
      Te("click", X, w), C(S, P);
    }, I = (S) => {
      var P = Ui(), X = T(m(P), 2);
      {
        var _e = (ee) => {
          var ue = Ki(), ne = m(ue);
          {
            var L = (Me) => {
              var He = Fi(), rt = T(yr(He), 2);
              Jt(rt, 21, n, gn, (kt, mt) => {
                var J = Li(), st = m(J), yt = {};
                oe(() => {
                  G(st, _(mt).name), yt !== (yt = _(mt).id) && (J.value = (J.__value = _(mt).id) ?? "");
                }), C(kt, J);
              }), Ti(rt, () => _(l), (kt) => y(l, kt)), C(Me, He);
            };
            we(ne, (Me) => {
              n().length > 0 && Me(L);
            });
          }
          var K = T(ne, 4), te = T(K, 2);
          {
            var Ae = (Me) => {
              var He = ji(), rt = m(He);
              oe(() => G(rt, _(u))), C(Me, He);
            };
            we(te, (Me) => {
              _(u) && Me(Ae);
            });
          }
          var Kt = T(te, 2), nt = m(Kt), qe = T(nt, 2), Ut = m(qe);
          oe(() => {
            K.disabled = _(o), nt.disabled = _(o), qe.disabled = _(o), Ee(qe, "aria-busy", _(o)), Ee(qe, "aria-label", _(o) ? "Validating…" : "Validate and save key"), G(Ut, _(o) ? "Validating…" : "Validate and save");
          }), Te("click", nt, k), Te("click", qe, A), C(ee, ue);
        };
        we(X, (ee) => {
          _(a) === "provider" && ee(_e);
        });
      }
      Te("keydown", P, (ee) => ee.key === "Escape" && (ee.preventDefault(), k())), C(S, P);
    }, R = (S) => {
      var P = qi(), X = m(P), _e = T(m(X), 2), ee = T(X, 2);
      Jt(ee, 21, () => _(r), (ue) => ue.id ?? ue.provider, (ue, ne) => {
        const L = /* @__PURE__ */ Ie(() => _(ne).id ?? _(ne).provider), K = /* @__PURE__ */ Ie(() => _(i) === _(L));
        var te = Bi(), Ae = m(te), Kt = m(Ae);
        Ur(Kt, () => Br(_(ne).provider), true);
        var nt = T(Kt, 2), qe = m(nt), Ut = T(nt, 2), Me = m(Ut), He = T(Ut, 4), rt = m(He), kt = T(Ae, 2);
        {
          var mt = (J) => {
            var st = Vi(), yt = m(st), qr = m(yt), Hr = T(yt, 2);
            oe(() => {
              Ee(st, "id", `rk-detail-${_(L) ?? ""}`), Ee(st, "aria-labelledby", `rk-row-${_(L) ?? ""}`), G(qr, `Provider: ${_(ne).provider ?? ""}. Use settings to view models and usage.`);
            }), Te("click", Hr, () => x(_(L))), C(J, st);
          };
          we(kt, (J) => {
            _(K) && J(mt);
          });
        }
        oe(
          (J) => {
            Ee(Ae, "aria-expanded", _(K)), Ee(Ae, "aria-controls", `rk-detail-${_(L) ?? ""}`), Ee(Ae, "id", `rk-row-${_(L) ?? ""}`), G(qe, _(ne).provider), G(Me, J), G(rt, _(K) ? "▼" : "▶");
          },
          [() => c(_(ne).label)]
        ), Te("click", Ae, () => j(_(L))), Te("keydown", Ae, (J) => {
          J.key === "Enter" || J.key === " " ? (J.preventDefault(), j(_(L))) : J.key === "Escape" && (J.preventDefault(), y(i, null));
        }), C(ue, te);
      }), Te("click", _e, w), C(S, P);
    };
    we(q, (S) => {
      _(v) ? S(Z) : _(d) ? S(I, 1) : _(p) && S(R, 2);
    });
  }
  oe(() => G(D, _(f))), C(e, O), En();
}
Kr(["click", "keydown"]);
var Yi = /* @__PURE__ */ N('<p class="rk-model-loading svelte-1dsy3sf" aria-live="polite">Loading availability…</p>'), Gi = /* @__PURE__ */ N('<span class="rk-model-reason svelte-1dsy3sf"> </span>'), Wi = /* @__PURE__ */ N('<li><button type="button"><span class="rk-model-id"> </span> <!></button></li>'), Zi = /* @__PURE__ */ N('<li class="rk-model-group svelte-1dsy3sf"><div class="rk-model-group-head svelte-1dsy3sf"><span class="rk-model-group-icon svelte-1dsy3sf" aria-hidden="true"></span> <span class="rk-model-group-name svelte-1dsy3sf"> </span></div> <ul class="rk-model-list svelte-1dsy3sf" role="list"></ul></li>'), Xi = /* @__PURE__ */ N('<ul class="rk-model-groups svelte-1dsy3sf" role="list"></ul>'), Ji = /* @__PURE__ */ N('<div class="rk-model-selector rk-dark svelte-1dsy3sf" role="region" aria-label="Model selection"><!></div>');
function ul(e, t) {
  bn(t, true);
  let n = /* @__PURE__ */ Y(ot({})), r = /* @__PURE__ */ Y(true);
  const s = /* @__PURE__ */ Ie(() => () => t.providers.map((f) => ({
    providerId: f.id,
    providerName: f.name,
    models: f.models.map((v) => {
      const d = `${f.id}:${v}`, p = _(n)[d];
      return { modelId: v, available: (p == null ? void 0 : p.available) ?? false, reason: p == null ? void 0 : p.reason };
    })
  })));
  fi(() => {
    const f = t.keys, v = t.providers;
    y(r, true);
    const d = [];
    for (const p of v)
      for (const c of p.models)
        d.push({ key: `${p.id}:${c}`, p, modelId: c });
    if (d.length === 0) {
      y(n, {}, true), y(r, false);
      return;
    }
    Promise.all(d.map(({ key: p, p: c, modelId: w }) => f.resolve(c.id, w).then(() => ({ key: p, available: true, reason: void 0 })).catch((k) => ({
      key: p,
      available: false,
      reason: (k == null ? void 0 : k.message) === NO_KEY_AVAILABLE ? "No API key" : "Unavailable"
    })))).then((p) => {
      const c = {};
      for (const w of p)
        c[w.key] = { available: w.available, reason: w.reason };
      y(n, c, true), y(r, false);
    });
  });
  function i(f, v) {
    var d;
    (d = t.onSelect) == null || d.call(t, f, v);
  }
  var l = Ji(), a = m(l);
  {
    var u = (f) => {
      var v = Yi();
      C(f, v);
    }, o = (f) => {
      var v = Xi();
      Jt(v, 21, () => _(s)(), gn, (d, p) => {
        var c = Zi(), w = m(c), k = m(w);
        Ur(k, () => Br(_(p).providerId), true);
        var A = T(k, 2), x = m(A), j = T(w, 2);
        Jt(j, 21, () => _(p).models, gn, (O, z) => {
          var D = Wi(), q = m(D);
          let Z;
          var I = m(q), R = m(I), S = T(I, 2);
          {
            var P = (X) => {
              var _e = Gi(), ee = m(_e);
              oe(() => G(ee, _(z).reason)), C(X, _e);
            };
            we(S, (X) => {
              !_(z).available && _(z).reason && X(P);
            });
          }
          oe(() => {
            Z = Ai(q, 1, "rk-model-item svelte-1dsy3sf", null, Z, { "rk-unavailable": !_(z).available }), q.disabled = !_(z).available, Ee(q, "aria-label", `${_(z).modelId ?? ""} (${(_(z).available ? "available" : _(z).reason ?? "unavailable") ?? ""})`), Ee(q, "title", _(z).reason ?? void 0), G(R, _(z).modelId);
          }), Te("click", q, () => i(_(z).modelId, _(p).providerId)), C(O, D);
        }), oe(() => G(x, _(p).providerName)), C(d, c);
      }), C(f, v);
    };
    we(a, (f) => {
      _(r) ? f(u) : f(o, -1);
    });
  }
  C(e, l), En();
}
Kr(["click"]);
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const providers = [openaiProvider, anthropicProvider];
    const API = "/api/keys";
    const userId = "demo-user";
    let keys = createKeys({ keys: [], routing: { defaultProvider: "openai" } }, { providers });
    let keysList = [];
    async function loadKeys() {
      try {
        const r = await fetch(API, { headers: { "x-user-id": userId } });
        const d = await r.json();
        keysList = Array.isArray(d.keys) ? d.keys : [];
        keys = createKeys({ keys: keysList, routing: { defaultProvider: "openai" } }, { providers });
      } catch {
        keysList = [];
      }
    }
    async function onKeyAdded(key, apiKey) {
      await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({ provider: key.provider, apiKey, id: key.id })
      });
      await loadKeys();
    }
    async function onKeyRemoved(keyId) {
      await fetch(`${API}/${keyId}`, { method: "DELETE", headers: { "x-user-id": userId } });
      await loadKeys();
    }
    $$renderer2.push(`<main class="rm-settings svelte-1i19ct2"><h1 class="rm-page-title svelte-1i19ct2">Settings</h1> <section class="rm-section svelte-1i19ct2">`);
    fl($$renderer2, { keys, userId, providers, onKeyAdded, onKeyRemoved });
    $$renderer2.push(`<!----></section> <section class="rm-section svelte-1i19ct2"><h2 class="rm-heading svelte-1i19ct2">Models</h2> `);
    ul($$renderer2, {
      keys,
      providers,
      onSelect: (modelId, providerId) => console.log("Selected", modelId, providerId)
    });
    $$renderer2.push(`<!----></section></main>`);
  });
}
export {
  _page as default
};
