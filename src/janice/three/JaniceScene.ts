import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildCoinGeometry } from "./coinGeometry";
import { buildJShapes } from "./jGeometry";
import { CallIcons } from "./callIcons";
import { T, easeInOut, easeOut, lerp, seg, smooth } from "./timeline";

const BRAND = new THREE.Color("#9e4cff");
const PALETTE = [
  { c: "#9e4cff", w: 0.4 },
  { c: "#886bee", w: 0.24 },
  { c: "#b9a6ff", w: 0.2 },
  { c: "#f4f1ff", w: 0.16 },
];

const SPHERE_R = 0.86; // radius of the merged core before it presses into the coin
const COIN_T = 0.24; // coin thickness (disc radius is 1), with a tight rim and straight side wall
const J_DEPTH = 0.05;
const J_BEVEL = 0.022;
const RING_CYCLE = 3.2; // phone cadence: brrring (0-0.4s) brrring (0.6-1.0s), then quiet

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Slight overshoot for the "j" pressing out. */
const backOut = (t: number) => {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

interface Orb {
  home: THREE.Vector3;
  r: number;
  base: THREE.Color;
  start: number;
  dur: number;
  swirl: number;
  lift: number;
  bobAmp: number;
  bobFreq: number;
  bobPhase: number;
  ring: boolean;
  ringPhase: number;
  pos: THREE.Vector3;
}

interface Layout {
  mobile: boolean;
  dist: number;
  cloud: THREE.Vector3;
  cloudR: THREE.Vector3;
  conv: THREE.Vector3;
  final: THREE.Vector3;
}

export interface LogoRect {
  x: number;
  y: number;
  r: number;
}

export class JaniceScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  private finalCam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  private world = new THREE.Group();
  private orbs: Orb[] = [];
  private totalVol = 1;
  private orbMesh!: THREE.InstancedMesh;
  private rings: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; orb: number; k: number }[] = [];
  private blob!: MarchingCubes;
  private blobHalf = 1.55;
  private coin = new THREE.Group();
  private coinMesh!: THREE.Mesh;
  private jGroup = new THREE.Group();
  private brandMat: THREE.MeshPhysicalMaterial;
  private jMat: THREE.MeshPhysicalMaterial;
  private orbMat: THREE.MeshPhysicalMaterial;
  private keyLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private pmrem: THREE.PMREMGenerator;
  private layout!: Layout;
  private size = { w: 1, h: 1 };
  private pointer = new THREE.Vector2();
  private pointerTarget = new THREE.Vector2();
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private tmpC = new THREE.Color();
  private mobileOrbs: boolean;
  private icons: CallIcons | null = null;
  private camLocal = new THREE.Vector3();
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, opts: { mobile: boolean; envUrl?: string; phones?: boolean }) {
    this.mobileOrbs = opts.mobile;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // No tone mapping: the settled coin must land on the exact brand violet (#9E4CFF).
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
    if (opts.envUrl) {
      new THREE.TextureLoader().load(opts.envUrl, (tex) => {
        if (this.disposed) return;
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        const env = this.pmrem.fromEquirectangular(tex).texture;
        this.scene.environment = env;
        tex.dispose();
      });
    }

    this.scene.add(this.world);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xd9d2ff, 0.55);
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.keyLight.position.set(3, 4.5, 6);
    this.rimLight = new THREE.DirectionalLight(0xc8b6ff, 1.1);
    this.rimLight.position.set(-5, 2.5, -3);
    this.scene.add(this.hemi, this.keyLight, this.rimLight);

    const glossy = {
      roughness: 0.17,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.07,
      sheen: 0.25,
      sheenColor: new THREE.Color("#e6dcff"),
      sheenRoughness: 0.5,
    };
    this.orbMat = new THREE.MeshPhysicalMaterial({ ...glossy, color: 0xffffff, iridescence: 0.18, iridescenceIOR: 1.3 });
    this.brandMat = new THREE.MeshPhysicalMaterial({ ...glossy, color: BRAND.clone(), iridescence: 0.18, iridescenceIOR: 1.3 });
    this.jMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.15 });

    this.buildOrbs();
    // Every call orb carries a telephone glyph until Janice answers it.
    if (opts.phones !== false) this.icons = new CallIcons(this.world, this.orbs);
    this.buildBlob();
    this.buildCoin();
    this.warmup();
  }

  /** Compile every program variant up front so the first merge frame does not hitch. */
  private warmup() {
    const vis = [this.blob.visible, this.coin.visible, this.jGroup.visible];
    this.blob.visible = this.coin.visible = this.jGroup.visible = true;
    this.blob.reset();
    this.blob.addBall(0.5, 0.5, 0.5, 0.05, 20);
    this.blob.update();
    this.renderer.compile(this.scene, this.camera);
    [this.blob.visible, this.coin.visible, this.jGroup.visible] = vis;
  }

  // ------------------------------------------------------------------ build

  private buildOrbs() {
    const rand = mulberry32(20261006);
    const n = this.mobileOrbs ? 20 : 32;
    const pickColor = () => {
      let u = rand();
      for (const p of PALETTE) {
        if ((u -= p.w) <= 0) return new THREE.Color(p.c);
      }
      return new THREE.Color(PALETTE[0].c);
    };
    // A few hero orbs, then a falling distribution of smaller calls.
    const radii: number[] = [];
    for (let i = 0; i < n; i++) {
      radii.push(i < 3 ? 0.4 + rand() * 0.1 : 0.09 + Math.pow(rand(), 1.6) * 0.27);
    }
    radii.sort((a, b) => b - a);
    const placed: Orb[] = [];
    for (let i = 0; i < n; i++) {
      const r = radii[i];
      let home = new THREE.Vector3();
      for (let tries = 0; tries < 400; tries++) {
        // unit-ellipsoid sample, biased toward the shell so the cloud reads as a cloud, not a ball
        const u = rand() * 2 - 1;
        const th = rand() * Math.PI * 2;
        const rr = Math.pow(rand(), 0.55);
        const s = Math.sqrt(1 - u * u);
        home.set(s * Math.cos(th) * rr, u * rr, s * Math.sin(th) * rr);
        if (placed.every((o) => o.home.distanceTo(home) > (o.r + r) / 2.2 + 0.05)) break;
      }
      placed.push({
        home,
        r,
        base: pickColor(),
        start: 0,
        dur: 0,
        swirl: (1.05 + rand() * 0.55) * Math.PI,
        lift: (rand() - 0.35) * 0.9,
        bobAmp: 0.05 + rand() * 0.08,
        bobFreq: 0.35 + rand() * 0.4,
        bobPhase: rand() * Math.PI * 2,
        ring: false,
        ringPhase: rand() * RING_CYCLE,
        pos: new THREE.Vector3(),
      });
    }
    // Ringing calls: the larger, frontmost orbs.
    placed
      .map((o, i) => ({ o, i, score: o.r + o.home.z * 0.15 + rand() * 0.05 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, this.mobileOrbs ? 5 : 8)
      .forEach(({ o }) => (o.ring = true));
    // Timing: outer orbs leave first so the swirl reads as one vortex arriving together.
    // A steady stream of answered calls: near ones first, far ones last, so orbs keep streaming
    // in across all three captions instead of vanishing inside the growing core.
    const order = placed.map((o, i) => ({ i, d: o.home.length() + rand() * 0.3 })).sort((a, b) => a.d - b.d);
    order.forEach(({ i }, rank) => {
      const o = placed[i];
      const u = rank / Math.max(1, order.length - 1);
      o.dur = 0.15 + rand() * 0.05;
      o.start = lerp(T.converge[0], T.converge[1] - o.dur, Math.pow(u, 0.9));
    });
    this.totalVol = placed.reduce((v, o) => v + o.r ** 3, 0);
    this.orbs = placed;

    const geo = new THREE.SphereGeometry(1, 48, 32);
    this.orbMesh = new THREE.InstancedMesh(geo, this.orbMat, n);
    this.orbMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.orbMesh.frustumCulled = false;
    placed.forEach((o, i) => this.orbMesh.setColorAt(i, o.base));
    this.world.add(this.orbMesh);

    const ringGeo = new THREE.RingGeometry(0.972, 1, 128);
    placed.forEach((o, i) => {
      if (!o.ring) return;
      for (let k = 0; k < 2; k++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0x9e4cff, transparent: true, opacity: 0, depthWrite: false });
        const mesh = new THREE.Mesh(ringGeo, mat);
        mesh.frustumCulled = false;
        this.rings.push({ mesh, mat, orb: i, k });
        this.world.add(mesh);
      }
    });
  }

  private buildBlob() {
    const res = this.mobileOrbs ? 46 : 58;
    this.blob = new MarchingCubes(res, this.brandMat, false, false, 40000);
    this.blob.isolation = 80;
    this.blob.frustumCulled = false;
    this.blob.scale.setScalar(this.blobHalf);
    this.blob.visible = false;
    this.world.add(this.blob);
  }

  private buildCoin() {
    this.coinMesh = new THREE.Mesh(buildCoinGeometry(SPHERE_R, COIN_T), this.brandMat);
    this.coinMesh.morphTargetInfluences = [0];
    this.coin.add(this.coinMesh);

    const jGeo = new THREE.ExtrudeGeometry(buildJShapes(), {
      depth: J_DEPTH,
      bevelEnabled: true,
      bevelThickness: J_BEVEL,
      bevelSize: 0.014,
      bevelOffset: -0.014,
      bevelSegments: 6,
      curveSegments: 72,
    });
    const j = new THREE.Mesh(jGeo, this.jMat);
    this.jGroup.add(j);
    this.jGroup.visible = false;
    this.coin.add(this.jGroup);
    this.coin.visible = false;
    this.world.add(this.coin);
  }

  // ------------------------------------------------------------------ layout

  resize(w: number, h: number, dpr: number) {
    this.size = { w, h };
    const mobile = w / h < 0.9;
    this.renderer.setPixelRatio(Math.min(dpr, mobile ? 1.75 : 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const tanH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    // Final disc diameter: 34% of viewport height, capped by width on narrow screens.
    const frac = Math.min(0.34, 0.56 * this.camera.aspect);
    const dist = 2 / (frac * 2 * tanH);
    const visH = 2 * tanH * dist * 1.1;
    const visW = visH * this.camera.aspect;
    if (!mobile) {
      this.layout = {
        mobile,
        dist,
        cloud: new THREE.Vector3(visW * 0.27, -visH * 0.05, 0),
        cloudR: new THREE.Vector3(Math.min(2.55, visW * 0.215), Math.min(2.45, visH * 0.39), 1.6),
        conv: new THREE.Vector3(visW * 0.2, 0, 0),
        final: new THREE.Vector3(0, visH * 0.04, 0),
      };
    } else {
      this.layout = {
        mobile,
        dist,
        cloud: new THREE.Vector3(0, -visH * 0.28, 0),
        cloudR: new THREE.Vector3(visW * 0.42, visH * 0.13, 1.1),
        conv: new THREE.Vector3(0, -visH * 0.1, 0),
        final: new THREE.Vector3(0, visH * 0.03, 0),
      };
    }
  }

  setPointer(x: number, y: number) {
    this.pointerTarget.set(x, y);
  }

  // ------------------------------------------------------------------ frame

  /** Where the 2D mark should sit to cover the 3D coin exactly (CSS px, canvas-relative). */
  logoRect(): LogoRect {
    const L = this.layout.final;
    const cam = this.finalCam;
    cam.fov = this.camera.fov;
    cam.aspect = this.camera.aspect;
    cam.updateProjectionMatrix();
    cam.position.set(0, 0, this.layout.dist);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    this.tmpV.copy(L).project(cam);
    this.tmpV2.set(L.x + 1, L.y, L.z).project(cam);
    const x = (this.tmpV.x * 0.5 + 0.5) * this.size.w;
    const y = (-this.tmpV.y * 0.5 + 0.5) * this.size.h;
    const x2 = (this.tmpV2.x * 0.5 + 0.5) * this.size.w;
    return { x, y, r: Math.abs(x2 - x) };
  }

  render(p: number, time: number) {
    const L = this.layout;
    this.pointer.lerp(this.pointerTarget, 0.06);
    const settle = smooth(seg(p, T.settle[0], T.settle[1]));
    const live = 1 - settle;

    // Camera: slow push-in, pointer parallax that dies away as the mark settles.
    const dz = L.dist * lerp(1.1, 1.0, easeInOut(seg(p, 0.08, 0.8)));
    this.camera.position.set(this.pointer.x * 0.35 * live, this.pointer.y * 0.22 * live, dz);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    this.world.rotation.set(-this.pointer.y * 0.06 * live, this.pointer.x * 0.09 * live, 0);

    // Anchor: cloud centre -> convergence point -> screen centre.
    const anchor = this.tmpV.copy(L.cloud).lerp(L.conv, easeInOut(seg(p, T.gather[0], T.gather[1])));
    anchor.lerp(L.final, easeInOut(seg(p, T.center[0], T.center[1])));

    const preSwap = p < T.swap;
    this.orbMesh.visible = preSwap;
    this.blob.visible = false;
    this.coin.visible = !preSwap;

    if (this.icons) this.icons.visible = preSwap;
    if (preSwap) this.renderOrbs(p, time, anchor);
    else {
      for (const r of this.rings) r.mesh.visible = false;
      this.renderCoin(p, anchor, settle);
    }

    // Lighting relaxes toward an even, flat read of the brand violet as the mark settles.
    // At full settle the coin is unlit: emissive brand violet, white j, exactly the 2D mark.
    const lit = 1 - settle;
    // scene.environment ignores material.envMapIntensity; scale the environment itself.
    this.scene.environmentIntensity = lit;
    // Lit coin reads ~1.3x brand; emissive fills only the gap so the blend never overshoots.
    this.brandMat.emissive.copy(BRAND).multiplyScalar(Math.max(0, 1 - 1.3 * lit));
    this.brandMat.clearcoat = lit;
    this.brandMat.sheen = 0.25 * lit;
    this.brandMat.specularIntensity = lit;
    this.brandMat.iridescence = 0.18 * lit;
    const je = Math.max(0, 1 - 1.3 * lit);
    this.jMat.emissive.setRGB(je, je, je);
    this.jMat.clearcoat = 0.6 * lit;
    this.jMat.specularIntensity = lit;
    this.keyLight.intensity = 1.35 * lit;
    this.rimLight.intensity = 1.0 * lit;
    this.hemi.intensity = 0.5 * lit;

    this.renderer.render(this.scene, this.camera);
  }

  private renderOrbs(p: number, time: number, anchor: THREE.Vector3) {
    const L = this.layout;
    const hm = this.blobHalf;
    const blobBalls: { x: number; y: number; z: number; r: number }[] = [];
    const ringFadeGlobal = 1 - seg(p, 0.2, 0.42);

    for (let i = 0; i < this.orbs.length; i++) {
      const o = this.orbs[i];
      const raw = seg(p, o.start, o.start + o.dur);
      const t = easeInOut(raw);
      // Idle float (fades as the orb is pulled in).
      const idle = 1 - smooth(seg(raw, 0, 0.5));
      const bob = Math.sin(time * o.bobFreq * Math.PI * 2 + o.bobPhase) * o.bobAmp * idle;
      const sway = Math.cos(time * o.bobFreq * 1.3 + o.bobPhase) * o.bobAmp * 0.6 * idle;
      // Ringing vibration in phone cadence.
      let buzz = 0;
      if (o.ring && idle > 0.01) {
        const c = (time + o.ringPhase) % RING_CYCLE;
        const on = (c < 0.4 ? 1 : 0) + (c > 0.6 && c < 1.0 ? 1 : 0);
        buzz = on * Math.sin(time * 92) * 0.012 * idle;
      }
      // Home position in the cloud's ellipsoid.
      const hx = o.home.x * L.cloudR.x + sway + buzz;
      const hy = o.home.y * L.cloudR.y + bob;
      const hz = o.home.z * L.cloudR.z;
      // Swirl around the view axis while the radius collapses.
      const ang = o.swirl * t;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const k = Math.pow(1 - t, 1.35);
      const rx = (hx * ca - hy * sa) * k;
      const ry = (hx * sa + hy * ca) * k;
      const rz = hz * k + Math.sin(Math.PI * t) * o.lift;
      o.pos.set(anchor.x + rx, anchor.y + ry, anchor.z + rz);

      // Absorbed into the core after arrival.
      const arrive = o.start + o.dur;
      const rEff = o.r * (1 - smooth(seg(p, arrive - 0.03, arrive + 0.01)));
      const dist = Math.sqrt(rx * rx + ry * ry + rz * rz);
      const inBlob = o.r >= 0.11 && raw > 0.3 && dist + rEff * 1.8 < hm * 0.94;

      // Colour: every call becomes Janice violet as it is answered.
      this.tmpC.copy(o.base).lerp(BRAND, smooth(seg(raw, 0.04, 0.28)));
      this.orbMesh.setColorAt(i, this.tmpC);

      const s = inBlob || rEff < 0.002 ? 0 : rEff;
      this.tmpM.compose(o.pos, this.tmpQ.identity(), this.tmpV2.set(s, s, s));
      this.orbMesh.setMatrixAt(i, this.tmpM);
      if (inBlob && rEff > 0.002) blobBalls.push({ x: rx, y: ry, z: rz, r: rEff });
    }
    this.orbMesh.instanceMatrix.needsUpdate = true;
    if (this.orbMesh.instanceColor) this.orbMesh.instanceColor.needsUpdate = true;

    // Rings: two expanding ripples per ringing orb, one per "brrring".
    const camQ = this.camera.quaternion;
    const worldQInv = this.tmpQ.copy(this.world.quaternion).invert().multiply(camQ);
    for (const ring of this.rings) {
      const o = this.orbs[ring.orb];
      const raw = seg(p, o.start, o.start + o.dur);
      const fade = (1 - seg(raw, 0, 0.3)) * ringFadeGlobal;
      const c = (time + o.ringPhase) % RING_CYCLE;
      const tau = c - ring.k * 0.6;
      const life = 1.5;
      if (fade <= 0.001 || tau < 0 || tau > life) {
        ring.mesh.visible = false;
        continue;
      }
      const u = tau / life;
      ring.mesh.visible = true;
      ring.mesh.position.copy(o.pos);
      ring.mesh.quaternion.copy(worldQInv);
      ring.mesh.scale.setScalar(o.r * (1.12 + 1.9 * easeOut(u)));
      ring.mat.opacity = 0.5 * Math.pow(1 - u, 1.5) * fade;
    }

    // Telephone glyphs ride on the orbs until each call is answered.
    if (this.icons) {
      this.camLocal.copy(this.camera.position);
      this.world.worldToLocal(this.camLocal);
      this.icons.update(p, time, worldQInv, this.camLocal);
    }

    // Metaball core.
    // The core "speaks" while calls keep arriving; the wobble is gone by the hand-over.
    const talk = seg(p, 0.36, 0.42) * (1 - seg(p, 0.545, 0.575));
    // Core volume = volume of the calls absorbed so far; it reaches SPHERE_R at the hand-over.
    let absorbed = 0;
    for (const o of this.orbs) absorbed += o.r ** 3 * smooth(seg(p, o.start + o.dur - 0.03, o.start + o.dur + 0.01));
    const grow = Math.cbrt(absorbed / this.totalVol);
    const rc = SPHERE_R * grow * (1 + talk * 0.022 * Math.sin(time * 7.3) * Math.sin(time * 2.1 + 0.6));
    if (rc > 0.01) blobBalls.push({ x: 0, y: 0, z: 0, r: rc });
    if (blobBalls.length) {
      const mc = this.blob;
      mc.position.copy(anchor);
      mc.reset();
      const iso = mc.isolation;
      const sub = iso / (1.8 * 1.8 - 1); // influence reaches 1.8x the surface radius
      for (const b of blobBalls) {
        const dn = b.r / (2 * hm);
        const strength = dn * dn * (iso + sub);
        mc.addBall(b.x / (2 * hm) + 0.5, b.y / (2 * hm) + 0.5, b.z / (2 * hm) + 0.5, strength, sub);
      }
      mc.update();
      mc.visible = true;
    }
  }

  private renderCoin(p: number, anchor: THREE.Vector3, settle: number) {
    const m = easeInOut(seg(p, T.flatten[0], T.flatten[1]));
    this.coinMesh.morphTargetInfluences![0] = m;
    this.coin.position.copy(anchor);
    // The coin turns to face the visitor as it flattens.
    const turn = easeInOut(seg(p, T.flatten[0] + 0.01, T.center[1] + 0.01));
    this.coin.rotation.set(lerp(0.5, 0, turn), lerp(-1.05, 0, turn), lerp(0.16, 0, turn));

    const press = seg(p, T.press[0], T.press[1]);
    this.jGroup.visible = m > 0.97;
    const protrude = lerp(-0.04, 0.042, backOut(press));
    // Back of the j sits inside the coin; only `protrude` shows above the face.
    this.jGroup.position.z = COIN_T / 2 - (J_DEPTH + J_BEVEL) + protrude;
    // Perspective compensation so the raised j projects at the same size as the flat mark's j.
    const comp = (this.layout.dist - (COIN_T / 2 + J_BEVEL)) / this.layout.dist;
    const sc = lerp(1, comp, settle);
    this.jGroup.scale.set(sc, sc, 1);
  }

  dispose() {
    this.disposed = true;
    this.icons?.dispose();
    this.orbMesh.geometry.dispose();
    this.orbMat.dispose();
    this.brandMat.dispose();
    this.jMat.dispose();
    this.rings.forEach((r) => r.mat.dispose());
    this.rings[0]?.mesh.geometry.dispose();
    this.coinMesh.geometry.dispose();
    this.jGroup.children.forEach((c) => (c as THREE.Mesh).geometry.dispose());
    this.blob.geometry.dispose();
    this.pmrem.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
  }
}
