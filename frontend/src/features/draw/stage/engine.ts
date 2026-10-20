// 開獎舞台：three.js 渲染 + matter.js 2D 物理（從 docs/prototypes/draw-stage.html 搬過來）
// - 49 顆號碼球堆在玻璃球底部；可下注時可以點（彈跳）、按住（放大看號碼）、拖動甩球
// - 截止後吹氣攪珠；開獎時開出的那顆球從球堆彈出、飛到上方結果列、沿軌道滾到位置
// - 階段（含開獎號碼）每一幀向外部要（getPhase，見 timeline.ts 的 stagePhaseAt），重新整理、切回分頁都會接著播
//
// 和原型的差別：
// - three 改用 npm 的 r186：顏色空間改名（SRGBColorSpace）；光照改成物理單位，強度乘 π 維持原型的亮度
// - 開獎時間、號碼來自後端（由 DrawStage 透過 getPhase 提供），不是按鈕觸發
// - 看不到時（捲出畫面、切到別的分頁）暫停渲染和物理，省電
// - dispose() 釋放 WebGL 資源：Next 的 Activity 隱藏頁面時會執行 effect 清除，回來再重建
//
// 這個檔案只在瀏覽器執行，由 DrawStage 動態載入（three + matter 不進首頁的初始 JS）
import Matter from "matter-js";
import * as THREE from "three";
import { ballColor, type BallColor } from "@/lib/ball";
import { BALL_ANIM_MS, T, type StagePhase } from "./timeline";

const { Engine, Bodies, Body, Composite, Constraint } = Matter;

// ---------- 常數 ----------
const S = 20; // 物理 px / 場景單位
const R = 0.8; // 球半徑（場景單位）
const STEP = 1000 / 60; // 固定的物理步長

const HEX: Record<BallColor, [body: string, ink: string]> = {
  red: ["#d7263d", "#7a0c1b"],
  blue: ["#2363d6", "#0c2c70"],
  green: ["#1f9d57", "#0a4d29"],
};

// 玻璃球（扭蛋機造型）
const GLOBE = { cy: -1.2, r: 9.4, seg: 48 };
const halfWidthAt = (y: number) => Math.sqrt(Math.max(0, GLOBE.r * GLOBE.r - (y - GLOBE.cy) ** 2));
const OUTLINE: [number, number][] = Array.from({ length: GLOBE.seg }, (_, k) => {
  const a = (k / GLOBE.seg) * Math.PI * 2;
  return [GLOBE.r * Math.cos(a), GLOBE.cy + GLOBE.r * Math.sin(a)];
});

// 結果列：6 個正碼 + 特別號碼的位置
const ROW_Y = 11.6;
const SLOT_X = [-8.1, -5.85, -3.6, -1.35, 0.9, 3.15, 6.9];
const ENTRY_X = 8.9;

// 相機要框住的範圍
const VIEW = { xMin: -10.2, xMax: 10.2, yMin: -13, yMax: 13.2 };

type Mode = "physics" | "draw" | "slot";
type Pose = { x: number; y: number; q: THREE.Quaternion };
type Ball = {
  n: number;
  mesh: THREE.Mesh;
  body: Matter.Body | null;
  mode: Mode;
  /** 攪珠時累積的翻滾 */
  qT: THREE.Quaternion;
  /** 按住放大的程度 0–1 */
  mag: number;
  /** 開始飛出時的姿勢 */
  start: Pose | null;
  spinAxis: THREE.Vector3;
};

export type StageOptions = {
  canvas: HTMLCanvasElement;
  /** 決定畫布大小的容器 */
  container: HTMLElement;
  /** 目前的舞台階段（每一幀呼叫）；開獎的號碼在階段資料裡 */
  getPhase: () => StagePhase;
  reducedMotion: boolean;
  /** 第一次畫完時通知（用來移除佔位圖） */
  onReady?: () => void;
};

export function createStage({ canvas, container, getPhase, reducedMotion, onReady }: StageOptions) {
  // ---------- three.js ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // r186 已移除 PCFSoftShadowMap

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 1, 400);
  const fitCamera = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const W = VIEW.xMax - VIEW.xMin;
    const H = VIEW.yMax - VIEW.yMin;
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max(H, W / camera.aspect) / (2 * half) + 1.5;
    const cy = (VIEW.yMax + VIEW.yMin) / 2;
    camera.position.set(0, cy + 2, d);
    camera.lookAt(0, cy, 0);
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(fitCamera);
  resizeObserver.observe(container);

  // 光：r155 之後是物理單位，強度乘 π 才會和原型（r149 legacy lights）一樣亮
  scene.add(new THREE.AmbientLight(0xffffff, 0.35 * Math.PI));
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a2238, 0.45 * Math.PI));
  const sun = new THREE.DirectionalLight(0xffffff, 0.85 * Math.PI);
  sun.position.set(-7, 14, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 16, bottom: -15, near: 1, far: 60 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  const warm = new THREE.PointLight(0xffc56b, 0.35 * Math.PI, 60, 0); // decay 0 = 原型的衰減方式
  warm.position.set(9, 4, 12);
  scene.add(warm);

  // 玻璃球：背板、前面的反光、弧形高光、上下兩圈邊框
  const back = new THREE.Mesh(
    new THREE.CircleGeometry(GLOBE.r, 64),
    new THREE.MeshPhongMaterial({ color: 0x24365f, transparent: true, opacity: 0.6 }),
  );
  back.position.set(0, GLOBE.cy, -1.04);
  back.receiveShadow = true;
  scene.add(back);

  const front = new THREE.Mesh(
    new THREE.CircleGeometry(GLOBE.r, 64),
    new THREE.MeshPhongMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.05,
      shininess: 150,
      specular: 0xffffff,
      depthWrite: false,
    }),
  );
  front.position.set(0, GLOBE.cy, 1.06);
  scene.add(front);

  const arc = (r: number, a0: number, a1: number, z: number) =>
    new THREE.CatmullRomCurve3(
      Array.from({ length: 24 }, (_, i) => {
        const a = a0 + ((a1 - a0) * i) / 23;
        return new THREE.Vector3(r * Math.cos(a), GLOBE.cy + r * Math.sin(a), z);
      }),
    );
  const glint = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false });
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(arc(GLOBE.r - 0.9, 1.95, 2.75, 1.1), 48, 0.16, 8, false), glint));
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(arc(GLOBE.r - 0.9, 2.9, 3.05, 1.1), 12, 0.16, 8, false), glint));

  const rimMat = new THREE.MeshPhongMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.6, shininess: 120 });
  for (const z of [-1.05, 1.05]) {
    const curve = new THREE.CatmullRomCurve3(
      OUTLINE.map(([x, y]) => new THREE.Vector3(x, y, z)),
      true,
    );
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 240, 0.08, 8, true), rimMat));
  }

  // 上方的金屬蓋、下方的底座
  const metal = new THREE.MeshPhongMaterial({ color: 0xc9962f, shininess: 70, specular: 0x6a5530 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 0.9, 40), metal);
  cap.position.set(0, GLOBE.cy + GLOBE.r + 0.25, 0);
  cap.castShadow = true;
  scene.add(cap);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.0, 0.7, 48), metal);
  collar.position.set(0, GLOBE.cy - GLOBE.r - 0.1, 0);
  scene.add(collar);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 5.6, 1.6, 48), metal);
  stand.position.set(0, GLOBE.cy - GLOBE.r - 1.2, 0);
  stand.receiveShadow = true;
  scene.add(stand);

  // 結果列的軌道 + 特別號碼前面的「+」
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(19.8, 0.26, 2.4),
    new THREE.MeshPhongMaterial({ color: 0x2b3c66, shininess: 40 }),
  );
  rail.position.set(0, ROW_Y - R - 0.13, 0);
  rail.receiveShadow = true;
  scene.add(rail);

  const plusTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    g.fillStyle = "#9ba7c4";
    g.fillRect(28, 12, 8, 40);
    g.fillRect(12, 28, 40, 8);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const plus = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.9),
    new THREE.MeshBasicMaterial({ map: plusTex, transparent: true }),
  );
  plus.position.set((SLOT_X[5] + SLOT_X[6]) / 2, ROW_Y, 0);
  scene.add(plus);

  // 球的貼圖：波色底，前後各一個白色圓片寫號碼
  const ballTexture = (n: number) => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const g = c.getContext("2d")!;
    const [body, ink] = HEX[ballColor(n)];
    g.fillStyle = body;
    g.fillRect(0, 0, 512, 256);
    for (const u of [0.25, 0.75]) {
      const cx = u * 512;
      const cy = 128;
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(cx, cy, 60, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = ink;
      g.font = `700 ${n < 10 ? 74 : 64}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(String(n), cx, cy + 4);
      if (n === 6 || n === 9) g.fillRect(cx - 14, cy + 34, 28, 6); // 6、9 加底線分辨方向
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };

  const ballGeo = new THREE.SphereGeometry(R, 40, 28);
  const ID = new THREE.Quaternion();
  const Z = new THREE.Vector3(0, 0, 1);
  const balls: Ball[] = Array.from({ length: 49 }, (_, i) => {
    const n = i + 1;
    const mesh = new THREE.Mesh(
      ballGeo,
      new THREE.MeshPhongMaterial({ map: ballTexture(n), shininess: 90, specular: 0x555555 }),
    );
    mesh.castShadow = true;
    scene.add(mesh);
    const spinAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    return { n, mesh, body: null, mode: "physics", qT: new THREE.Quaternion(), mag: 0, start: null, spinAxis };
  });

  // ---------- 物理 ----------
  const engine = Engine.create();
  engine.gravity.y = 1;
  engine.positionIterations = 10;
  engine.velocityIterations = 8;
  const world = engine.world;

  // 玻璃球的牆：沿著外框一圈的矩形，法向量朝外
  const wall = (a: [number, number], b: [number, number]) => {
    const ax = a[0] * S;
    const ay = -a[1] * S;
    const bx = b[0] * S;
    const by = -b[1] * S;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let nx = -dy / len;
    let ny = dx / len;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const cy = -GLOBE.cy * S;
    if (nx * mx + ny * (my - cy) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const TH = 60;
    return Bodies.rectangle(mx + (nx * TH) / 2, my + (ny * TH) / 2, len + TH * 0.3, TH, {
      isStatic: true,
      angle: Math.atan2(dy, dx),
      friction: 0.05,
      restitution: 0.2,
    });
  };
  OUTLINE.forEach((p, i) => Composite.add(world, wall(p, OUTLINE[(i + 1) % OUTLINE.length])));

  const addBody = (ball: Ball, x: number, y: number, vx = 0, vy = 0) => {
    const body = Bodies.circle(x * S, -y * S, R * S, {
      restitution: 0.35,
      friction: 0.02,
      frictionStatic: 0.2,
      frictionAir: 0.012,
      density: 0.002,
    });
    Body.setAngle(body, Math.random() * Math.PI * 2);
    Body.setVelocity(body, { x: vx, y: vy });
    ball.body = body;
    Composite.add(world, body);
  };
  const removeBody = (ball: Ball) => {
    if (!ball.body) return;
    if (hold?.ball === ball) releaseHold();
    Composite.remove(world, ball.body);
    ball.body = null;
  };

  // 一開始把 49 顆球一排一排擺在底部，順序打亂
  const pilePositions = (count: number) => {
    const out: [number, number][] = [];
    const d = 2 * R + 0.12;
    let y = GLOBE.cy - GLOBE.r + R + 0.6;
    while (out.length < count) {
      const hw = halfWidthAt(y) - R - 0.15;
      const n = Math.max(1, Math.floor((2 * hw) / d) + 1);
      const span = (n - 1) * d;
      for (let i = 0; i < n && out.length < count; i++) out.push([-span / 2 + i * d + (Math.random() - 0.5) * 0.2, y]);
      y += d;
    }
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  pilePositions(49).forEach(([x, y], i) => addBody(balls[i], x, y));

  // 吹氣攪珠：只有靠近底部的球會被吹起來，重力再把它拉回去
  // 重力每步加約 0.28 px/step，上升高度 h ≈ v² / 0.56 px：v 8–13 → 約 30–85% 的玻璃球高度
  const BLOW_ZONE = GLOBE.cy - GLOBE.r + GLOBE.r * 2 * 0.45;
  const stirStep = () => {
    for (const { body } of balls) {
      if (!body) continue;
      const y = -body.position.y / S;
      if (y > BLOW_ZONE || Math.random() > 0.045) continue;
      const v = 8 + Math.pow(Math.random(), 1.2) * 5;
      Body.setVelocity(body, { x: body.velocity.x * 0.5 + (Math.random() - 0.5) * 4, y: -v });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.4);
    }
  };
  const clampSpeeds = () => {
    for (const { body } of balls) {
      if (!body) continue;
      const s = Math.hypot(body.velocity.x, body.velocity.y);
      if (s > 18) Body.setVelocity(body, { x: (body.velocity.x / s) * 18, y: (body.velocity.y / s) * 18 });
    }
  };

  // ---------- 開獎狀態 ----------
  let phase = getPhase();
  /** 結果列上那期的 7 個號碼（攪珠中、還沒開過獎時是 null） */
  const shownNumbers = () => (phase.kind === "mixing" ? null : phase.numbers);
  const isInteractive = () => phase.kind === "idle";
  const isStirring = () => !reducedMotion && phase.kind !== "idle";

  // ---------- 互動 ----------
  const raycaster = new THREE.Raycaster();
  const zPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const ndc = new THREE.Vector2();
  const toScene = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const p = new THREE.Vector3();
    raycaster.ray.intersectPlane(zPlane, p);
    return p;
  };
  const hitBall = (p: THREE.Vector3) => {
    let best: Ball | null = null;
    let bestD = R * 1.5; // 小球的觸控範圍放寬一點
    for (const b of balls) {
      if (!b.body) continue;
      const d = Math.hypot(b.body.position.x / S - p.x, -b.body.position.y / S - p.y);
      if (d < bestD) {
        best = b;
        bestD = d;
      }
    }
    return best;
  };
  const clampToJar = (p: THREE.Vector3) => {
    const dx = p.x;
    const dy = p.y - GLOBE.cy;
    const d = Math.hypot(dx, dy);
    const max = GLOBE.r - R;
    return d <= max ? { x: p.x, y: p.y } : { x: (dx / d) * max, y: GLOBE.cy + (dy / d) * max };
  };

  type Hold = { ball: Ball; id: number; t0: number; x0: number; y0: number; moved: boolean; constraint: Matter.Constraint };
  let hold: Hold | null = null;
  function releaseHold() {
    if (!hold) return;
    Composite.remove(world, hold.constraint);
    hold = null;
    canvas.style.cursor = "";
  }

  const bounce = (ball: Ball) => {
    const body = ball.body!;
    Body.setVelocity(body, { x: (Math.random() - 0.5) * 3, y: -13 });
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.4);
    for (const o of balls) {
      if (!o.body || o === ball) continue;
      const dx = o.body.position.x - body.position.x;
      const dy = o.body.position.y - body.position.y;
      const d = Math.hypot(dx, dy);
      if (d < R * S * 2.8) {
        Body.setVelocity(o.body, { x: o.body.velocity.x + (dx / d) * 3.5, y: o.body.velocity.y + (dy / d) * 3.5 - 2 });
      }
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!isInteractive()) return;
    const p = toScene(e);
    const ball = hitBall(p);
    if (!ball?.body) return;
    e.preventDefault(); // 只在按到球時攔截，其他地方照常捲動頁面
    canvas.setPointerCapture(e.pointerId);
    const c = clampToJar(p);
    const constraint = Constraint.create({
      pointA: { x: c.x * S, y: -c.y * S },
      bodyB: ball.body,
      pointB: { x: 0, y: 0 },
      stiffness: 0.12,
      damping: 0.08,
      length: 0,
    });
    Composite.add(world, constraint);
    hold = { ball, id: e.pointerId, t0: performance.now(), x0: e.clientX, y0: e.clientY, moved: false, constraint };
    canvas.style.cursor = "grabbing";
  };
  const onPointerMove = (e: PointerEvent) => {
    if (hold && e.pointerId === hold.id) {
      const c = clampToJar(toScene(e));
      hold.constraint.pointA = { x: c.x * S, y: -c.y * S };
      if (Math.hypot(e.clientX - hold.x0, e.clientY - hold.y0) > 6) hold.moved = true;
    } else if (e.pointerType === "mouse") {
      canvas.style.cursor = isInteractive() && hitBall(toScene(e)) ? "grab" : "";
    }
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!hold || e.pointerId !== hold.id) return;
    const { ball, moved, t0 } = hold;
    releaseHold();
    if (!moved && performance.now() - t0 < 220 && ball.body) bounce(ball); // 點一下 = 彈跳
  };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  // ---------- 姿勢 ----------
  const qA = new THREE.Quaternion();
  const qB = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);
  const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

  const startPose = (ball: Ball): Pose => {
    const b = ball.body!;
    return {
      x: b.position.x / S,
      y: -b.position.y / S,
      q: new THREE.Quaternion().setFromAxisAngle(Z, -b.angle).multiply(ball.qT),
    };
  };

  // 開球動畫：彈出放大 → 拋物線飛到結果列右端 → 沿軌道滾到位置（不打滑：角度 = 距離 / 半徑），停下時號碼朝前
  const drawPose = (ball: Ball, t: number, slot: number) => {
    const st = ball.start!;
    const m = ball.mesh;
    const slotX = SLOT_X[slot];
    qA.setFromAxisAngle(ball.spinAxis, t * 0.016);
    if (t < T.pop) {
      const e = easeOut(t / T.pop);
      m.position.set(st.x, st.y + 0.8 * e, 3 * e);
      m.scale.setScalar(1 + 0.35 * e);
      m.quaternion.copy(qA).multiply(st.q);
    } else if (t < T.pop + T.fly) {
      const u = (t - T.pop) / T.fly;
      const e = easeInOut(u);
      const x0 = st.x;
      const y0 = st.y + 0.8;
      const z0 = 3;
      m.position.set(x0 + (ENTRY_X - x0) * e, y0 + (ROW_Y - y0) * e + Math.sin(Math.PI * u) * 2.2, z0 * (1 - e));
      m.scale.setScalar(1.35 - 0.35 * e);
      qB.setFromAxisAngle(Z, (slotX - ENTRY_X) / R);
      m.quaternion.copy(qA).multiply(st.q).slerp(qB, u * u * u);
    } else {
      const u = Math.min(1, (t - T.pop - T.fly) / T.roll);
      const e = easeOut(u);
      const x = ENTRY_X + (slotX - ENTRY_X) * e;
      const hop = 0.3 * Math.abs(Math.sin(u * Math.PI * 3)) * Math.pow(1 - u, 3);
      m.position.set(x, ROW_Y + hop, 0);
      m.scale.setScalar(1);
      m.quaternion.setFromAxisAngle(Z, (slotX - x) / R);
    }
  };

  // 依目前階段決定每顆球該在哪裡：球堆（物理）、飛行中、結果列
  const syncBalls = () => {
    const shown = shownNumbers();
    const revealed = phase.kind === "idle" ? 7 : phase.kind === "drawing" ? phase.revealed : 0;
    const active = phase.kind === "drawing" ? phase.active : null;

    for (const ball of balls) {
      const i = shown ? shown.indexOf(ball.n) : -1;
      const target: Mode = i >= 0 && i < revealed ? "slot" : active && active.index === i ? "draw" : "physics";
      if (target === ball.mode) continue;

      if (target === "physics") {
        // 回到球堆：從玻璃球上方掉回去（換期截止時，結果列的球會這樣回去）
        ball.mode = "physics";
        ball.mag = 0;
        ball.qT.identity();
        ball.mesh.scale.setScalar(1);
        addBody(ball, (Math.random() - 0.5) * 8, GLOBE.cy + 5 + Math.random() * 1.2, (Math.random() - 0.5) * 4, 2);
      } else if (target === "draw" && ball.mode === "physics") {
        ball.start = startPose(ball);
        removeBody(ball);
        ball.mode = "draw";
      } else {
        removeBody(ball);
        ball.mode = "slot";
      }
    }
  };

  // ---------- 主迴圈 ----------
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let ready = false;

  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(t - last, 50);
    last = t;

    phase = getPhase();
    syncBalls();

    // 物理：固定步長，一幀最多補 4 步
    const stirring = isStirring();
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 4) {
      if (stirring) stirStep();
      Engine.update(engine, STEP);
      clampSpeeds();
      acc -= STEP;
      steps++;
    }
    if (steps === 4) acc = 0;

    for (const ball of balls) {
      const m = ball.mesh;
      if (ball.mode === "physics" && ball.body) {
        const b = ball.body;
        const held = hold?.ball === ball && t - hold.t0 > 180;
        ball.mag += ((held ? 1 : 0) - ball.mag) * (1 - Math.exp(-dt / 90));
        if (stirring) {
          // 攪珠時依速度翻滾
          const vx = (b.velocity.x / S) * 60;
          const vy = (-b.velocity.y / S) * 60;
          const sp = Math.hypot(vx, vy);
          if (sp > 0.01) {
            axis.set(-vy, vx, 0).normalize();
            qA.setFromAxisAngle(axis, (sp * dt) / 1000 / R);
            ball.qT.premultiply(qA);
          }
        } else {
          ball.qT.slerp(ID, 1 - Math.exp(-dt / 350)); // 靜止時慢慢轉回號碼朝前
        }
        m.quaternion.setFromAxisAngle(Z, -b.angle).multiply(ball.qT);
        if (ball.mag > 0.001) m.quaternion.slerp(ID, ball.mag);
        m.position.set(b.position.x / S, -b.position.y / S, ball.mag * 2.6);
        m.scale.setScalar(1 + 0.9 * ball.mag);
      } else if (ball.mode === "draw" && phase.kind === "drawing") {
        const i = phase.numbers.indexOf(ball.n);
        drawPose(ball, phase.active?.t ?? BALL_ANIM_MS, i);
      } else if (ball.mode === "slot") {
        const numbers = shownNumbers();
        if (numbers) m.position.set(SLOT_X[numbers.indexOf(ball.n)], ROW_Y, 0);
        m.quaternion.identity();
        m.scale.setScalar(1);
      }
    }

    renderer.render(scene, camera);
    if (!ready) {
      ready = true;
      onReady?.();
    }
  };

  // 看不到時暫停（捲出畫面、切到別的分頁）；回來時重設時間，避免一次補很多步
  let onScreen = true;
  const updateRunning = () => {
    const run = onScreen && !document.hidden;
    if (run && !raf) {
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    } else if (!run && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      releaseHold();
    }
  };
  const intersection = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    updateRunning();
  });
  intersection.observe(container);
  document.addEventListener("visibilitychange", updateRunning);

  fitCamera();
  updateRunning();

  return {
    dispose() {
      cancelAnimationFrame(raf);
      raf = 0;
      intersection.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", updateRunning);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      Composite.clear(world, false);
      Engine.clear(engine);
      scene.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        obj.geometry.dispose();
        const material = obj.material as THREE.MeshPhongMaterial | THREE.MeshBasicMaterial;
        material.map?.dispose();
        material.dispose();
      });
      renderer.dispose();
      // 立刻釋放 WebGL context（瀏覽器同時能開的 context 有上限，Activity 隱藏 / 顯示會反覆建立）
      renderer.forceContextLoss();
    },
  };
}

export type Stage = ReturnType<typeof createStage>;
