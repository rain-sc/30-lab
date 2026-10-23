// 攪珠台的容器：金色電光的水晶球 + 號碼刻度環（一格一個號碼）上的彗星（設計稿：https://claude.ai/artifact/SmoCs9XGLjyjWFY3UC5Q3p）
//
// 改寫自 React Bits（https://reactbits.dev，MIT + Commons Clause）：
// - Crystalized Ball（https://reactbits.dev/animations/crystalized-ball）：水晶球邊緣的電光、霧、微塵、電弧
//   原版是獨立的 ogl 元件（自己一個 WebGL），這裡把 shader 搬進舞台的 three.js 場景（一頁只能有一個 WebGL）；
//   座標從螢幕像素改成平面的本地座標；拿掉游標攪動微塵的 GPU 模擬、開場動畫、淺色主題；配色固定用 token 的金色；
//   「熱點」改成跟著彗星 / 開出的號碼，不跟游標
// - Comet Dial（https://reactbits.dev/micro/comet-dial）：刻度環上拖著尾巴的彗星
//   原版是 SVG + Motion 的旋鈕元件，這裡只取外觀，改成一個 shader 算出軌道、亮起的弧、彗星尾巴和頭
//
// 只在瀏覽器執行（engine.ts 動態載入時一起載入）
import * as THREE from "three";
import { TICK } from "./layout";

/** 舞台給容器的狀態（每一幀） */
export type CrystalState =
  /** 可下注：cutoff = 離截止的進度 0–1，lit = 上一期開出的號碼（刻度亮金色） */
  | { kind: "idle"; cutoff: number; lit: number[] }
  /** 攪珠中：彗星繞圈 */
  | { kind: "mixing" }
  /** 開獎中：current = 正在開的號碼（彗星停在它的刻度），lit = 已經開出的號碼 */
  | { kind: "drawing"; current: number | null; lit: number[] };

export type CrystalOptions = {
  /** 水晶球（球窗）的中心和半徑（場景單位） */
  cy: number;
  r: number;
  reducedMotion: boolean;
  /** 號碼範圍 1–maxNumber：刻度環的格數 */
  maxNumber: number;
};

// ---------- 顏色（globals.css 的 token） ----------
const GOLD = 0xf4b63f;
const GOLD_BRIGHT = 0xffd27a;
const LINE_STRONG = 0x2f3a5c;

/** 位置（0–1，正上方順時針）→ 數學角度（y 朝上） */
const angleOfTurn = (f: number) => Math.PI / 2 - f * Math.PI * 2;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const wrapAngle = (a: number) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
/** 往目標靠近（和幀率無關） */
const approach = (v: number, target: number, dt: number, tau: number) => v + (target - v) * (1 - Math.exp(-dt / tau));

// ---------- 配色：React Bits buildPalette 的深色版（在 Oklab 調亮度、色相） ----------
type Rgb = [number, number, number];
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toGamma = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const toOklab = (rgb: Rgb): Rgb => {
  const [r, g, b] = rgb.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
const fromOklab = ([L, a, b]: Rgb): Rgb => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => clamp(toGamma(clamp(v, 0, 1)), 0, 1)) as Rgb;
};
const mixRgb = (a: Rgb, b: Rgb, t: number) => a.map((v, i) => v + (b[i] - v) * t) as Rgb;
const blend = (a: Rgb, b: Rgb, t: number) => fromOklab(mixRgb(toOklab(a), toOklab(b), t));
const shift = (rgb: Rgb, hue: number, lightness: number, chroma: number) => {
  const [L, a, b] = toOklab(rgb);
  const c = Math.hypot(a, b) * chroma;
  const h = Math.atan2(b, a) + (hue * Math.PI) / 180;
  return fromOklab([clamp(L + lightness, 0, 1), c * Math.cos(h), c * Math.sin(h)]);
};

const palette = () => {
  const c = new THREE.Color(GOLD);
  const base: Rgb = [c.r, c.g, c.b]; // ShaderMaterial 不做色彩空間轉換：直接用 sRGB 值，和原版一樣
  const white: Rgb = [1, 1, 1];
  const black: Rgb = [0, 0, 0];
  return {
    rim: base,
    rimHot: mixRgb(base, white, 0.72),
    rimMid: mixRgb(base, black, 0.15),
    rimDeep: mixRgb(base, black, 0.45),
    spark: mixRgb(base, white, 0.45),
    sparkGlow: shift(base, 0, -0.15, 1),
    haze: mixRgb(base, black, 0.6),
    edge: shift(base, 0, -0.3, 0.9),
    tones: [
      shift(base, 0, -0.06, 1),
      shift(base, 16, -0.02, 1),
      shift(base, -16, -0.12, 1.05),
      shift(blend(base, white, 0.25), 0, 0.04, 1),
      blend(base, white, 0.7),
    ],
  };
};
const vec3 = (c: Rgb) => new THREE.Vector3(...c);

// ---------- 固定亂數（重新整理後電光、微塵的樣子一樣） ----------
const seeded = (start: number) => {
  let s = start >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** 電光：8 條線，每條由 4 個頻段的正弦波疊出抖動（React Bits buildStrands） */
const buildStrands = () => {
  const rnd = seeded(99);
  const bands = [
    [6, 12, 0.6, 1.6],
    [18, 34, 1.5, 3.5],
    [40, 70, 3, 7],
    [80, 130, 6, 12],
  ];
  const d = { harmonics: [] as number[], rates: [] as number[], phases: [] as number[], flareHarmonics: [] as number[], flareRates: [] as number[], flarePhases: [] as number[] };
  for (let s = 0; s < 8; s++) {
    for (const [lo, hi, slow, fast] of bands) {
      d.harmonics.push(Math.round(lo + rnd() * (hi - lo)));
      d.rates.push((slow + rnd() * (fast - slow)) * (rnd() < 0.5 ? -1 : 1));
      d.phases.push(rnd() * Math.PI * 2);
    }
    for (let j = 0; j < 3; j++) {
      d.flareHarmonics.push(4 + Math.floor(rnd() * 6));
      d.flareRates.push((0.4 + rnd() * 0.8) * (rnd() < 0.5 ? -1 : 1));
      d.flarePhases.push(rnd() * Math.PI * 2);
    }
    const lead = s === 0;
    d.flareHarmonics.push(lead ? 0.75 : 0.95 + rnd() * 0.3);
    d.flareRates.push(lead ? 1.15 : 0.8 + rnd() * 0.2);
    d.flarePhases.push(lead ? 1 : 0.7 + rnd() * 0.25);
  }
  const vec4s = (arr: number[]) => Array.from({ length: 8 }, (_, i) => new THREE.Vector4(...arr.slice(i * 4, i * 4 + 4)));
  return {
    uHarmonics: vec4s(d.harmonics),
    uRates: vec4s(d.rates),
    uPhases: vec4s(d.phases),
    uFlareHarmonics: vec4s(d.flareHarmonics),
    uFlareRates: vec4s(d.flareRates),
    uFlarePhases: vec4s(d.flarePhases),
  };
};

/** 微塵：沉在球底（碗狀）+ 沿著邊緣一圈（React Bits buildDust，數量少很多） */
const buildDust = (count: number) => {
  const rnd = seeded(1337);
  const home: number[] = [];
  const seed: number[] = [];
  let k = 0;
  let guard = 0;
  while (k < count && guard < count * 80) {
    guard++;
    let x: number;
    let y: number;
    let tone: number;
    if (rnd() < 0.28) {
      const a = rnd() * Math.PI * 2;
      const rad = 0.87 + Math.sqrt(rnd()) * 0.105;
      x = Math.cos(a) * rad;
      y = Math.sin(a) * rad;
      if (rnd() > smooth(-0.6, 0.3, -y)) continue;
      const q = rnd();
      tone = q < 0.5 ? 3 : q < 0.8 ? 2 : 1;
    } else {
      x = rnd() * 2 - 1;
      y = rnd() * 2 - 1;
      const rad = Math.hypot(x, y);
      if (rad > 0.975) continue;
      const bowl = Math.pow(smooth(-0.25, 0.85, -y), 1.3);
      const band = smooth(0.66, 0.96, rad) * smooth(-0.7, 0.3, -y);
      const w = Math.max(bowl, band * 0.9);
      if (rnd() > 0.012 + 0.988 * w) continue;
      if (w < 0.12) tone = 4;
      else {
        const q = rnd();
        tone = q < 0.32 ? 0 : q < 0.52 ? 1 : q < 0.8 ? 2 : 3;
      }
    }
    const chord = Math.sqrt(Math.max(0, 0.95 - x * x - y * y));
    home.push(x, y, (rnd() * 2 - 1) * chord, tone);
    seed.push(tone === 4 ? 1.8 : rnd() < 0.22 ? 2.1 : 1.3, rnd(), 2.5 + rnd() * 3.5, 0.16 + rnd() * 0.26);
    k++;
  }
  return { home: new Float32Array(home), seed: new Float32Array(seed), count: k };
};

// ---------- shader ----------
const common = /* glsl */ `
uint scramble(uint v) { v = v * 747796405u + 2891336453u; uint w = ((v >> ((v >> 28u) + 4u)) ^ v) * 277803737u; return (w >> 22u) ^ w; }
float random(uint v) { return float(scramble(v)) * (1.0 / 4294967295.0); }
// 亮部柔和地壓下來（原版最後合成時的 tone curve）
vec3 soften(vec3 x) { vec3 over = max(x - 0.6, 0.0); return min(x, 0.6) + 0.4 * (1.0 - exp(-over / 0.4)); }
`;

const planeVertex = /* glsl */ `
varying vec2 vLocal;
void main() { vLocal = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

/** 水晶球邊緣的電光、閃焰、霧、電弧（React Bits fieldFragment；uPx = 每個場景單位幾個 CSS 像素） */
const fieldFragment = /* glsl */ `
precision highp float;
uniform float uPx; uniform float uRadius; uniform float uLine; uniform float uTime; uniform float uFrame; uniform float uBins;
uniform float uStrands; uniform float uCrackle; uniform float uFlares; uniform float uGlow; uniform float uHaze; uniform float uFill;
// 0 = 後層（球的後面）：只畫球窗裡的霧；1 = 前層（球的前面）：電光、光暈、電弧，貼著玻璃的球不會擋住光圈
uniform float uLayer;
uniform vec3 uRim; uniform vec3 uRimHot; uniform vec3 uRimMid; uniform vec3 uRimDeep;
uniform vec3 uSpark; uniform vec3 uSparkGlow; uniform vec3 uHazeColor; uniform vec3 uEdgeColor;
uniform vec4 uHeat;
uniform vec4 uHarmonics[8]; uniform vec4 uRates[8]; uniform vec4 uPhases[8];
uniform vec4 uFlareHarmonics[8]; uniform vec4 uFlareRates[8]; uniform vec4 uFlarePhases[8];
uniform vec4 uArcs[4];
varying vec2 vLocal;
${common}
const float PI = 3.14159265;
const float TAU = 6.28318531;
const vec4 AMPS = vec4(0.35, 0.3, 0.22, 0.13);
float bell(float d, float w) { float x = d / w; return exp(-x * x); }
float pool(vec2 q) {
  float t = length(q - vec2(0.0, mix(-1.0, -0.66, uFill))) / mix(0.8, 1.35, uFill);
  return t < 0.6 ? mix(0.5, 0.22, t / 0.6) : mix(0.22, 0.0, clamp((t - 0.6) / 0.4, 0.0, 1.0));
}
void main() {
  vec2 p = vLocal * uPx;
  float r = length(p);
  float R = uRadius;
  float theta = atan(p.y, p.x);
  float lift = p.y / max(r, 1e-3);
  float topDim = 1.0 - 0.35 * pow(max(lift, 0.0), 1.5);
  vec3 col = vec3(0.0);
  uint frame = uint(uFrame);

  if (uLayer < 0.5) {
    if (r < R) {
      vec2 q = p / R;
      float chord = sqrt(max(1.0 - dot(q, q), 0.0));
      col += uHazeColor * pool(q) * (0.55 + 0.45 * chord) * uHaze;
      float e = length(q - vec2(0.0, 0.2)) / 1.2;
      col += uEdgeColor * 0.5 * pow(smoothstep(0.62, 1.0, e), 1.4) * (0.5 + 0.5 * uHaze);
    }
    vec3 haze = soften(max(col, 0.0));
    gl_FragColor = vec4(haze, max(haze.r, max(haze.g, haze.b)));
    return;
  }

  float dr = r - R;
  float halo = 1.0 - smoothstep(R * 0.05, R * 0.105, abs(dr - R * 0.0213));
  col += uRimDeep * 0.18 * halo * topDim * uGlow;
  col += uRim * 0.12 * bell(dr + R * 0.0383, R * 0.032) * uGlow;
  col += uRim * 0.32 * bell(dr, max(R * 0.0117, uLine));

  float delta = mod(theta - uHeat.x + PI, TAU) - PI;
  float heat = uHeat.z * uHeat.y * exp(-delta * delta / 0.3);
  float crackle = uCrackle + heat * 0.9;
  float amp = R * 0.016 * (0.3 + 1.4 * crackle);
  float jitterAmp = R * 0.0048 * (0.3 + 1.4 * uCrackle) * (1.0 + heat * 0.3);
  float flareAmp = R * 0.064 * (0.4 + 1.2 * crackle) * uFlares * 1.6;

  if (abs(dr) < amp * 2.0 + flareAmp + R * 0.3) {
    float stp = TAU / uBins;
    float binPos = (theta + PI) / stp;
    float bin0 = floor(binPos);
    float binF = binPos - bin0;
    float th0 = bin0 * stp - PI;
    float th1 = th0 + stp;
    uint b0 = uint(mod(bin0, uBins));
    uint b1 = uint(mod(bin0 + 1.0, uBins));
    float gain = min(1.0, 2.4 / max(uStrands, 1.0));
    for (int k = 0; k < 8; k++) {
      if (float(k) >= uStrands) break;
      vec4 m = uHarmonics[k];
      vec4 lead = uRates[k] * uTime + uPhases[k];
      float wave0 = dot(AMPS, sin(m * th0 + lead));
      float wave1 = dot(AMPS, sin(m * th1 + lead));
      uint salt = uint(k) * 1013u + frame * 7919u;
      vec4 shape = uFlareHarmonics[k];
      vec4 look = uFlareRates[k];
      vec4 tone = uFlarePhases[k];
      float a = amp * shape.w;
      float off0 = a * wave0 + jitterAmp * (random(b0 + salt) - 0.5);
      float off1 = a * wave1 + jitterAmp * (random(b1 + salt) - 0.5);
      float rc = R + mix(off0, off1, binF);
      float grade = (off1 - off0) / (stp * max(r, 1.0));
      float d = abs(r - rc) * inversesqrt(1.0 + grade * grade);
      float swell = 0.8 + 0.4 * (0.5 + 0.5 * sin(3.0 * theta + uTime * 0.7 + tone.x * 1.7));
      float width = uLine * look.w * swell * (1.0 + heat * 0.25);
      float core = exp(-d * d / (width * width));
      float sheath = exp(-d * d / (width * width * 3.0));
      float bright = tone.w * (1.0 + heat * 0.45);
      col += (uRimHot * core * 0.8 + uRim * sheath * 0.32) * bright;
      vec3 fargs = shape.xyz * theta + look.xyz * uTime + tone.xyz;
      float flare = max(0.0, (sin(fargs.x) + sin(fargs.y) + sin(fargs.z)) / 3.0);
      flare = (flare * flare + heat * 0.35) * flareAmp;
      float dw = abs(r - rc - flare);
      float dm = abs(r - rc - flare * 0.6);
      float dn = abs(r - rc - flare * 0.25);
      vec3 glow = uRimDeep * (0.07 * bell(dw, R * 0.09) + 0.16 * bell(dw, R * 0.05));
      glow += uRimMid * 0.28 * bell(dm, R * 0.027) + uRim * 0.38 * bell(dn, R * 0.013);
      col += glow * gain * topDim * uGlow * (1.0 + heat * 1.4);
    }
  }

  for (int i = 0; i < 4; i++) {
    vec4 arc = uArcs[i];
    if (arc.w <= 0.002) continue;
    float mid = arc.x + arc.y * 0.5;
    vec2 center = R * 0.93 * vec2(cos(mid), sin(mid));
    if (distance(p, center) > R * (abs(arc.y) * 0.6 + 0.1) + 12.0) continue;
    float ar = R * 0.955;
    vec2 a0 = ar * vec2(cos(arc.x), sin(arc.x));
    vec2 a2 = ar * vec2(cos(arc.x + arc.y), sin(arc.x + arc.y));
    vec2 a1 = R * (0.955 - arc.z) * vec2(cos(mid), sin(mid));
    float dmin = 1e5;
    float along = 0.0;
    vec2 prev = a0;
    for (int s = 1; s <= 10; s++) {
      float u = float(s) / 10.0;
      vec2 b = mix(mix(a0, a1, u), mix(a1, a2, u), u);
      vec2 pa = p - prev;
      vec2 ba = b - prev;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
      float dist = length(pa - ba * h);
      if (dist < dmin) { dmin = dist; along = (float(s) - 1.0 + h) / 10.0; }
      prev = b;
    }
    float taper = sqrt(max(sin(PI * along), 0.0));
    float arcWidth = uLine * (0.55 + 0.6 * taper);
    float arcCore = exp(-dmin * dmin / (arcWidth * arcWidth));
    float arcGlow = exp(-dmin * dmin / (arcWidth * arcWidth * 12.0));
    col += (uSpark * 0.95 * arcCore + uSparkGlow * 0.4 * arcGlow) * arc.w * taper;
  }

  vec3 shown = soften(max(col, 0.0));
  gl_FragColor = vec4(shown, max(shown.r, max(shown.g, shown.b)));
}
`;

/** 微塵：繞小圈漂浮、閃爍（React Bits dustVertex 的 orbit 模式，沒有游標攪動） */
const dustVertex = /* glsl */ `
precision highp float;
attribute vec4 aHome; attribute vec4 aSeed; attribute float aIndex;
uniform float uDustTime; uniform vec2 uTurn; uniform float uFill;
uniform float uRadius; uniform float uDpr; uniform float uPointScale; uniform float uBright;
uniform vec3 uTones[5]; uniform vec3 uRimTone;
varying vec3 vColor; varying float vSize;
${common}
vec3 settle(vec3 p, out float spread) {
  float bend = exp2((0.5 - uFill) * 1.8);
  float h = clamp((p.y + 1.0) * 0.5, 0.0, 1.0);
  float y = 2.0 * pow(h, bend) - 1.0;
  float from = sqrt(max(1.0 - p.y * p.y, 1e-4));
  float to = sqrt(max(1.0 - y * y, 0.0));
  spread = clamp(bend * pow(max(h, 1e-3), bend - 1.0) * to / from, 0.25, 1.0);
  return vec3(p.xz * (to / from), y).xzy;
}
void main() {
  uint id = uint(aIndex);
  float spread;
  vec3 p = settle(aHome.xyz, spread);
  float t = uDustTime;
  float life = sin(3.14159265 * fract(t / aSeed.z + aSeed.y));
  float loop = t * (0.6 + 0.9 * random(id * 7u + 3u)) * (random(id * 7u + 10u) < 0.5 ? -1.0 : 1.0) + aSeed.y * 6.2831853;
  p.xy += (0.025 + 0.05 * random(id * 7u + 16u)) * vec2(cos(loop), sin(loop));
  float wobble = 0.002 + 0.006 * random(id * 7u + 1u);
  float w1 = 0.8 + 2.4 * random(id * 7u + 2u);
  float w2 = 0.8 + 2.4 * random(id * 7u + 4u);
  p += wobble * vec3(sin(t * w1 + aSeed.y * 40.0), cos(t * w2 + aSeed.z * 30.0), sin(t * (w1 + w2) * 0.5 + aSeed.w * 20.0));
  float cy = cos(uTurn.x); float sy = sin(uTurn.x); p.xz = mat2(cy, -sy, sy, cy) * p.xz;
  float cx = cos(uTurn.y); float sx = sin(uTurn.y); p.yz = mat2(cx, -sx, sx, cx) * p.yz;
  float inside = 1.0 - smoothstep(0.955, 0.985, length(p.xy));
  float len = length(p);
  if (len > 0.975) p *= 0.975 / len;
  float front = p.z * 0.5 + 0.5;
  float depthSize = 0.82 + 0.36 * front;
  float depthLight = 0.6 + 0.48 * front;
  float blink = sin(t * (2.0 + 6.0 * random(id * 7u + 5u)) + random(id * 7u + 6u) * 6.2831853);
  float twinkle = mix(1.0, smoothstep(-0.9, -0.6, blink), 0.5);
  float fade = smoothstep(0.04, 0.12, life);
  float alpha = random(id * 7u + 9u) < 0.5 || aHome.w > 3.5 ? 1.0 : 0.6;
  float size = aSeed.x * uPointScale * (0.35 + 0.95 * life) * depthSize;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p.xy * uRadius, 0.0, 1.0);
  float px = size * uDpr;
  gl_PointSize = px + 2.0;
  vSize = px;
  int tone = int(aHome.w + 0.5);
  vec3 c = tone == 0 ? uTones[0] : tone == 1 ? uTones[1] : tone == 2 ? uTones[2] : tone == 3 ? uTones[3] : uTones[4];
  float rimLit = smoothstep(0.8, 0.97, length(p.xy));
  vColor = (c + uRimTone * rimLit * rimLit * 0.12) * alpha * fade * twinkle * depthLight * inside * sqrt(spread) * uBright;
}
`;
const dustFragment = /* glsl */ `
precision highp float;
varying vec3 vColor; varying float vSize;
${common}
void main() {
  vec2 q = (gl_PointCoord - 0.5) * (vSize + 2.0);
  float h = max(vSize * 0.5, 0.5);
  vec2 c = clamp(h - abs(q) + 0.5, 0.0, 1.0);
  float cover = c.x * c.y;
  if (cover <= 0.0) discard;
  vec3 shown = soften(vColor * cover);
  gl_FragColor = vec4(shown, max(shown.r, max(shown.g, shown.b)));
}
`;

/** 彗星環（Comet Dial 的外觀）：軌道、亮起的弧（0 → uLit）、頭和後面的尾巴 */
const dialFragment = /* glsl */ `
precision highp float;
uniform float uRing; uniform float uHalf; uniform float uHead; uniform float uLit; uniform float uSpeed; uniform float uReach; uniform float uHeadSize;
uniform vec3 uGold; uniform vec3 uTrack;
varying vec2 vLocal;
const float TAU = 6.28318531;
void main() {
  float r = length(vLocal);
  float f = fract((1.5707963 - atan(vLocal.y, vLocal.x)) / TAU); // 正上方順時針 0 → 1
  float d = abs(r - uRing);
  float aa = fwidth(r) * 1.2;
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  float track = 1.0 - smoothstep(uHalf * 0.35 - aa, uHalf * 0.35 + aa, d);
  col += uTrack * track;
  alpha = max(alpha, track * 0.9);
  float lit = step(f, uLit) * (1.0 - smoothstep(uHalf * 0.55 - aa, uHalf * 0.55 + aa, d));
  col = mix(col, uGold, lit * 0.8);
  alpha = max(alpha, lit * 0.8);
  float behind = fract(uHead - f);
  float w = clamp(1.0 - behind / max(uReach, 1e-4), 0.0, 1.0) * uSpeed;
  float tail = w * (1.0 - smoothstep(uHalf * (0.4 + 1.6 * w) - aa, uHalf * (0.4 + 1.6 * w) + aa, d));
  col = mix(col, uGold, tail);
  alpha = max(alpha, tail * w);
  vec2 hp = uRing * vec2(cos(1.5707963 - uHead * TAU), sin(1.5707963 - uHead * TAU));
  float hd = length(vLocal - hp);
  float head = 1.0 - smoothstep(uHeadSize - aa, uHeadSize + aa, hd);
  float glow = exp(-hd * hd / (uHeadSize * uHeadSize * 6.0)) * 0.55;
  col = mix(col, vec3(1.0, 0.92, 0.7), head);
  alpha = max(alpha, head);
  col += uGold * glow;
  alpha = max(alpha, glow);
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

/** 顏色相加，alpha 用 over：畫布是預乘 alpha，透明的地方才會透出卡片底色 */
const ADDITIVE = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
} as const;

/** 霧在球的後面、電光在球的前面（球在 z = 0，半徑 0.8） */
const BACK_Z = -1.2;
const FRONT_Z = 0.9;

/** 電弧：在水晶球邊緣某個角度閃一下（React Bits spawnArc） */
type Arc = { start: number; span: number; curl: number; life: number; duration: number; drift: number; strength: number };
const MAX_ARCS = 4;

/**
 * 建立容器，加進場景。z 都在球（z = 0）後面：球窗的底 → 霧和電光 → 微塵 → 彗星環、刻度。
 * 每一幀呼叫 update；畫面大小改變時呼叫 setPixelScale。
 */
export function createCrystal(scene: THREE.Scene, { cy, r, reducedMotion, maxNumber }: CrystalOptions) {
  /** 號碼 n 在刻度環上的位置：正上方順時針 1 → maxNumber（0–1） */
  const turnOf = (n: number) => (n - 1) / maxNumber;
  /** 每幾格一條長刻度：能被 5 整除用 5（30 → 1、6、11…），否則用 7（49 → 1、8、15…） */
  const major = maxNumber % 5 === 0 ? 5 : 7;
  const group = new THREE.Group();
  group.position.y = cy;
  scene.add(group);

  const crystalR = r + 0.1; // 電光的位置：比物理邊界（球撞的圓）稍微外面
  const dialR = r + 0.78;
  const tickR = TICK.r;
  const pal = palette();

  // 球窗的底：sunken 深色，接收球的影子；上面疊一層中間微亮、邊緣變暗的漸層
  const back = new THREE.Mesh(new THREE.CircleGeometry(crystalR, 128), new THREE.MeshStandardMaterial({ color: 0x0e1428, roughness: 1 }));
  back.position.z = -1.3;
  back.receiveShadow = true;
  group.add(back);
  const shadeTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, "rgba(36,50,94,0.5)");
    gr.addColorStop(0.65, "rgba(20,28,52,0.2)");
    gr.addColorStop(1, "rgba(4,6,14,0.6)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const shade = new THREE.Mesh(new THREE.CircleGeometry(crystalR, 128), new THREE.MeshBasicMaterial({ map: shadeTex, transparent: true, depthWrite: false }));
  shade.position.z = -1.25;
  group.add(shade);

  // 水晶球的電光 + 霧
  const fieldSize = crystalR * 2.8;
  const F = {
    uPx: { value: 20 },
    uRadius: { value: 200 },
    uLine: { value: 0.8 },
    uTime: { value: 0 },
    uFrame: { value: 0 },
    uBins: { value: 600 },
    uStrands: { value: 4 },
    uCrackle: { value: 0.3 },
    uFlares: { value: 0.45 },
    uGlow: { value: 0.6 },
    uHaze: { value: 0.3 },
    uFill: { value: 0.45 },
    uRim: { value: vec3(pal.rim) },
    uRimHot: { value: vec3(pal.rimHot) },
    uRimMid: { value: vec3(pal.rimMid) },
    uRimDeep: { value: vec3(pal.rimDeep) },
    uSpark: { value: vec3(pal.spark) },
    uSparkGlow: { value: vec3(pal.sparkGlow) },
    uHazeColor: { value: vec3(pal.haze) },
    uEdgeColor: { value: vec3(pal.edge) },
    uHeat: { value: new THREE.Vector4() },
    uArcs: { value: Array.from({ length: MAX_ARCS }, () => new THREE.Vector4()) },
    ...Object.fromEntries(Object.entries(buildStrands()).map(([k, v]) => [k, { value: v }])),
  };
  // 同一組 uniforms 畫兩層（展開複製的是 { value } 物件的參照，更新 F 兩層一起變），只有 uLayer 不同：
  // 後層在球的後面畫霧；前層在球的前面畫電光，光是相加上去的，不會擋住球
  const fieldGeo = new THREE.PlaneGeometry(fieldSize, fieldSize);
  const haze = new THREE.Mesh(
    fieldGeo,
    new THREE.ShaderMaterial({ vertexShader: planeVertex, fragmentShader: fieldFragment, uniforms: { ...F, uLayer: { value: 0 } }, ...ADDITIVE }),
  );
  haze.position.z = BACK_Z;
  group.add(haze);
  const rim = new THREE.Mesh(
    fieldGeo,
    new THREE.ShaderMaterial({ vertexShader: planeVertex, fragmentShader: fieldFragment, uniforms: { ...F, uLayer: { value: 1 } }, ...ADDITIVE }),
  );
  rim.position.z = FRONT_Z;
  group.add(rim);

  // 微塵
  const dust = buildDust(7000);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(dust.count * 3), 3));
  dustGeo.setAttribute("aHome", new THREE.BufferAttribute(dust.home, 4));
  dustGeo.setAttribute("aSeed", new THREE.BufferAttribute(dust.seed, 4));
  dustGeo.setAttribute("aIndex", new THREE.BufferAttribute(Float32Array.from({ length: dust.count }, (_, i) => i), 1));
  const D = {
    uDustTime: { value: 0 },
    uTurn: { value: new THREE.Vector2() },
    uFill: { value: 0.45 },
    uRadius: { value: crystalR },
    uDpr: { value: 1 },
    uPointScale: { value: 1 },
    uBright: { value: 0.22 },
    uTones: { value: pal.tones.map(vec3) },
    uRimTone: { value: vec3(pal.rim) },
  };
  const points = new THREE.Points(dustGeo, new THREE.ShaderMaterial({ vertexShader: dustVertex, fragmentShader: dustFragment, uniforms: D, ...ADDITIVE }));
  points.frustumCulled = false; // 位置在 shader 裡算，包圍球不準
  points.position.z = -1.15;
  group.add(points);

  // 彗星環
  const U = {
    uRing: { value: dialR },
    uHalf: { value: 0.16 },
    uHead: { value: 0 },
    uLit: { value: 0 },
    uSpeed: { value: 0 },
    uReach: { value: 0.32 },
    uHeadSize: { value: 0.26 },
    uGold: { value: new THREE.Color(GOLD) },
    uTrack: { value: new THREE.Color(LINE_STRONG) },
  };
  const dialSize = (dialR + 1) * 2;
  const dial = new THREE.Mesh(
    new THREE.PlaneGeometry(dialSize, dialSize),
    new THREE.ShaderMaterial({ vertexShader: planeVertex, fragmentShader: dialFragment, uniforms: U, transparent: true, depthWrite: false }),
  );
  dial.position.z = -1.1;
  group.add(dial);

  // 刻度：一格一個號碼，每 major 格長一點
  const majorGeo = new THREE.PlaneGeometry(0.16, TICK.major);
  const minorGeo = new THREE.PlaneGeometry(0.12, 0.42);
  const ticks = Array.from({ length: maxNumber }, (_, i) => {
    const n = i + 1;
    const a = angleOfTurn(turnOf(n));
    const material = new THREE.MeshBasicMaterial({ color: LINE_STRONG });
    const mesh = new THREE.Mesh(i % major === 0 ? majorGeo : minorGeo, material);
    mesh.position.set(tickR * Math.cos(a), tickR * Math.sin(a), -1.1);
    mesh.rotation.z = a - Math.PI / 2;
    group.add(mesh);
    return { n, material, flash: 0 };
  });

  // ---------- 狀態 ----------
  const arcs: Arc[] = [];
  const spawnArc = (angle: number, strength: number) => {
    if (reducedMotion || arcs.length >= MAX_ARCS) return;
    arcs.push({
      start: angle,
      span: (0.05 + Math.random() * 0.07) * (Math.random() < 0.5 ? -1 : 1),
      curl: 0.02 + Math.random() * 0.04,
      life: 0,
      duration: 0.2 + Math.random() * 0.2,
      drift: (Math.random() - 0.5) * 0.3,
      strength,
    });
  };
  let rimTime = 0;
  let dustTime = 0;
  let nextArc = 0.5;
  let surge = 0;
  let heatPower = 0;
  /** 彗星頭的位置（圈數，連續累加；畫的時候取小數） */
  let head = 0;
  let goal: number | null = null;
  let lastCurrent: number | null = null;
  const cBase = new THREE.Color(LINE_STRONG);
  const cGold = new THREE.Color(GOLD);
  const cBright = new THREE.Color(GOLD_BRIGHT);

  return {
    /**
     * pxPerUnit：每個場景單位在畫面上幾個 CSS 像素（電光的線寬、微塵的大小用像素算）
     * cameraDistance：相機到 z = 0 的距離。前層比較靠近相機，透視下會變大，照距離比例縮小，畫面上和後層一樣大
     */
    setPixelScale(pxPerUnit: number, dpr: number, cameraDistance: number) {
      rim.scale.setScalar((cameraDistance - FRONT_Z) / (cameraDistance - BACK_Z));
      const radiusPx = crystalR * pxPerUnit;
      F.uPx.value = pxPerUnit;
      F.uRadius.value = radiusPx;
      F.uLine.value = Math.max(0.6, radiusPx * 0.0035);
      F.uBins.value = clamp(Math.round((Math.PI * 2 * radiusPx) / 2.6), 240, 900);
      D.uDpr.value = dpr;
      D.uPointScale.value = Math.max(1, radiusPx / 491);
    },

    /** dt：秒 */
    update(dt: number, state: CrystalState) {
      const moving = !reducedMotion;

      // 開獎：新的一顆開始開 → 彗星往前甩到那個號碼的刻度，刻度閃亮，水晶球在那裡閃電弧
      const current = state.kind === "drawing" ? state.current : null;
      if (current !== null && current !== lastCurrent) {
        const want = turnOf(current);
        const ahead = (((want - head) % 1) + 1) % 1;
        goal = head + ahead + (lastCurrent === null && moving ? 1 : 0); // 第一顆多繞一圈
        ticks[current - 1].flash = 1;
        const a = angleOfTurn(want);
        spawnArc(a + (Math.random() - 0.5) * 0.3, 1.4);
        spawnArc(a + (Math.random() - 0.5) * 0.5, 1.1);
        surge = 1;
      }
      if (state.kind !== "drawing") goal = null;
      lastCurrent = state.kind === "drawing" ? (current ?? lastCurrent) : null;

      // 彗星頭
      const prev = head;
      if (state.kind === "mixing") {
        if (moving) head += dt * 1.15;
      } else {
        const target = state.kind === "idle" ? Math.floor(head) + state.cutoff : (goal ?? head);
        head = moving ? approach(head, target, dt, state.kind === "drawing" ? 0.18 : 0.4) : target;
      }
      const speed = moving && dt > 0 ? clamp(Math.abs(head - prev) / dt / 1.1, 0, 1) : 0;
      U.uHead.value = ((head % 1) + 1) % 1;
      U.uSpeed.value = approach(U.uSpeed.value, speed, dt, 0.08);
      U.uLit.value = moving ? approach(U.uLit.value, state.kind === "idle" ? state.cutoff : 0, dt, 0.3) : state.kind === "idle" ? state.cutoff : 0;

      // 電光：可下注安靜；攪珠時亮、跟著彗星；開獎時在開出的號碼那裡最亮
      const live = state.kind !== "idle";
      surge *= Math.exp(-dt / 0.7);
      const crackle = state.kind === "mixing" ? 0.85 : state.kind === "drawing" ? 0.6 : 0.3;
      const glow = state.kind === "mixing" ? 1.05 : state.kind === "drawing" ? 0.9 : 0.6;
      F.uCrackle.value = approach(F.uCrackle.value, crackle + surge * 0.5, dt, 0.4);
      F.uGlow.value = approach(F.uGlow.value, glow * (1 + surge * 0.5), dt, 0.4);
      F.uFlares.value = live ? 0.85 : 0.45;
      F.uStrands.value = live ? 6 : 4;
      const headAngle = angleOfTurn(U.uHead.value);
      const heatAngle = state.kind === "drawing" && lastCurrent !== null ? angleOfTurn(turnOf(lastCurrent)) : headAngle;
      heatPower = approach(heatPower, live ? (state.kind === "mixing" ? 0.7 : 0.9) : 0, dt, 0.3);
      F.uHeat.value.set(wrapAngle(heatAngle), 1, moving ? heatPower : 0, 0);

      if (moving) {
        const step = dt * (live ? 1.8 : 1) * (1 + surge * 0.6 + heatPower * 0.3);
        rimTime += step;
        dustTime += dt * (state.kind === "mixing" ? 2.2 : 0.8) * (1 + surge * 0.4);
        const sparks = state.kind === "mixing" ? 0.7 : state.kind === "drawing" ? 0.35 : 0.12;
        nextArc -= step * sparks * 2 * (0.6 + F.uCrackle.value * 0.6);
        if (nextArc <= 0) {
          const angle =
            state.kind === "mixing" && Math.random() < 0.6
              ? headAngle + (Math.random() - 0.5) * 0.8
              : Math.random() < 0.7
                ? Math.PI / 2 + (Math.random() - 0.5) * 1.5
                : Math.random() * Math.PI * 2;
          spawnArc(angle, 0.8 + surge * 0.4);
          nextArc = 0.15 + Math.random() * 0.6;
        }
        for (let i = arcs.length - 1; i >= 0; i--) {
          const a = arcs[i];
          a.life += step;
          a.start += a.drift * step;
          if (a.life >= a.duration) arcs.splice(i, 1);
        }
      }
      for (let i = 0; i < MAX_ARCS; i++) {
        const a = arcs[i];
        F.uArcs.value[i].set(a?.start ?? 0, a?.span ?? 0, a?.curl ?? 0, a ? Math.sin((Math.PI * a.life) / a.duration) * a.strength : 0);
      }
      F.uTime.value = rimTime;
      F.uFrame.value = Math.floor(rimTime * 24) % 100000;
      D.uDustTime.value = dustTime;
      D.uTurn.value.set(0.29 * Math.sin(dustTime * 0.23), 0.084 * Math.sin(dustTime * 0.17 + 1.3));
      D.uBright.value = approach(D.uBright.value, state.kind === "mixing" ? 0.5 : 0.22, dt, 0.5);

      // 刻度：開出的號碼金色；彗星經過、剛開出時短暫變亮
      const lit = state.kind === "mixing" ? null : state.lit;
      for (const tick of ticks) {
        const behind = (((U.uHead.value - turnOf(tick.n)) % 1) + 1) % 1;
        const pass = U.uSpeed.value * clamp(1 - behind / 0.12, 0, 1);
        tick.flash *= Math.exp(-dt / 0.6);
        tick.material.color.copy(lit?.includes(tick.n) ? cGold : cBase).lerp(cBright, Math.max(pass, tick.flash));
      }
    },

    dispose() {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
      shadeTex.dispose();
      scene.remove(group);
    },
  };
}
