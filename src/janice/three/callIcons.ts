import * as THREE from "three";
import { ICON_PATHS } from "./iconPaths";
import { seg, smooth } from "./timeline";

/** What the icon layer needs to know about each call orb. */
export interface IconOrb {
  pos: THREE.Vector3;
  r: number;
  base: THREE.Color;
  ring: boolean;
  ringPhase: number;
  start: number;
  dur: number;
}

type Glyph = keyof typeof ICON_PATHS;

const RING_CYCLE = 3.2;
const LIGHT_ORB = 0.62; // base luminance above which the orb is "light" and takes a violet glyph

const backOut = (t: number) => {
  const c1 = 1.7;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

function ringTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 96, 128, 128, 126);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.55, "rgba(255,255,255,0.95)");
  g.addColorStop(1, "rgba(234,232,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(128, 128, 126, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function glyphTexture(glyph: Glyph, color: string, shadow: string) {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const pad = 0.16;
  ctx.translate(size * pad, size * pad);
  ctx.scale(1 - pad * 2, 1 - pad * 2);
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = color;
  ctx.fill(new Path2D(ICON_PATHS[glyph]));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Telephone glyphs printed on the call orbs. Each one rings with its orb, then is "picked up"
 * (the handset tilts and lifts), pops into a check mark as Janice answers, and sinks into the orb.
 */
export class CallIcons {
  private group = new THREE.Group();
  private items: {
    phone: THREE.Mesh;
    check: THREE.Mesh;
    flash: THREE.Mesh;
    pm: THREE.MeshBasicMaterial;
    cm: THREE.MeshBasicMaterial;
    fm: THREE.MeshBasicMaterial;
  }[] = [];
  private textures: THREE.Texture[] = [];
  private geo = new THREE.PlaneGeometry(1, 1);
  private q = new THREE.Quaternion();
  private toCam = new THREE.Vector3();
  private spin = new THREE.Quaternion();
  private axis = new THREE.Vector3(0, 0, 1);
  private look = new THREE.Matrix4();
  private up = new THREE.Vector3();
  private faceOrb = new THREE.Quaternion();

  constructor(
    parent: THREE.Object3D,
    private orbs: IconOrb[],
  ) {
    const white = { phone: glyphTexture("phone", "#ffffff", "rgba(53,34,106,0.35)"), call: glyphTexture("phoneCall", "#ffffff", "rgba(53,34,106,0.35)") };
    const violet = { phone: glyphTexture("phone", "#6b4fd8", "rgba(255,255,255,0.6)"), call: glyphTexture("phoneCall", "#6b4fd8", "rgba(255,255,255,0.6)") };
    const check = glyphTexture("check", "#ffffff", "rgba(53,34,106,0.35)");
    const ring = ringTexture();
    this.textures.push(white.phone, white.call, violet.phone, violet.call, check, ring);
    for (const o of orbs) {
      const hsl = { h: 0, s: 0, l: 0 };
      o.base.getHSL(hsl);
      const set = hsl.l > LIGHT_ORB ? violet : white;
      const pm = new THREE.MeshBasicMaterial({ map: o.ring ? set.call : set.phone, transparent: true, depthWrite: false, toneMapped: false });
      const cm = new THREE.MeshBasicMaterial({ map: check, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 });
      const phone = new THREE.Mesh(this.geo, pm);
      const chk = new THREE.Mesh(this.geo, cm);
      // "Connected" flash: one soft white ring that blooms off the orb as the call is answered.
      const fm = new THREE.MeshBasicMaterial({ map: ring, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 });
      const flash = new THREE.Mesh(this.geo, fm);
      phone.renderOrder = chk.renderOrder = 2;
      flash.renderOrder = 3;
      phone.frustumCulled = chk.frustumCulled = flash.frustumCulled = false;
      this.group.add(phone, chk, flash);
      this.items.push({ phone, check: chk, flash, pm, cm, fm });
    }
    parent.add(this.group);
  }

  set visible(v: boolean) {
    this.group.visible = v;
  }

  /** `faceQ` turns a plane in the parent's space to face the camera. */
  update(p: number, time: number, faceQ: THREE.Quaternion, camPosLocal: THREE.Vector3) {
    for (let i = 0; i < this.orbs.length; i++) {
      const o = this.orbs[i];
      const it = this.items[i];
      const raw = seg(p, o.start, o.start + o.dur);
      // Answer beat: pick up (0 to 0.16), check pops (0.12 to 0.24), check sinks into the orb (0.24 to 0.42).
      const pick = smooth(seg(raw, 0, 0.16));
      const swap = smooth(seg(raw, 0.1, 0.2));
      const pop = seg(raw, 0.12, 0.26);
      const sink = smooth(seg(raw, 0.26, 0.42));

      // Sit on the front of the orb, facing the camera.
      this.toCam.copy(camPosLocal).sub(o.pos).normalize();
      const lift = o.r * 0.18 * pick;
      it.phone.position.copy(o.pos).addScaledVector(this.toCam, o.r * 1.03);
      it.phone.position.y += lift;
      it.check.position.copy(o.pos).addScaledVector(this.toCam, o.r * (1.03 - 0.5 * sink));

      // Ringing handsets wiggle in the phone cadence until they are picked up.
      let wiggle = 0;
      if (o.ring && pick < 1) {
        const c = (time + o.ringPhase) % RING_CYCLE;
        const on = (c < 0.4 ? 1 : 0) + (c > 0.6 && c < 1.0 ? 1 : 0);
        wiggle = on * Math.sin(time * 48) * 0.22 * (1 - pick);
      }
      // Face the camera position, not just its direction: off-centre orbs would otherwise tilt the
      // sticker into the sphere and clip one side of the glyph.
      this.up.set(0, 1, 0).applyQuaternion(faceQ);
      this.look.lookAt(camPosLocal, o.pos, this.up);
      this.faceOrb.setFromRotationMatrix(this.look);
      this.q.copy(this.faceOrb);
      this.spin.setFromAxisAngle(this.axis, wiggle - 0.75 * pick);
      it.phone.quaternion.copy(this.q).multiply(this.spin);
      it.check.quaternion.copy(this.faceOrb);

      const ps = o.r * 1.0 * (1 + 0.12 * pick);
      it.phone.scale.set(ps, ps, 1);
      it.pm.opacity = 1 - swap;
      it.phone.visible = it.pm.opacity > 0.002;

      const cs = o.r * 1.1 * (pop > 0 ? backOut(pop) : 0) * (1 - 0.7 * sink);
      it.check.scale.set(Math.max(cs, 1e-4), Math.max(cs, 1e-4), 1);
      it.cm.opacity = swap * (1 - sink);
      it.check.visible = it.cm.opacity > 0.002;

      const f = seg(raw, 0.1, 0.36);
      it.flash.position.copy(o.pos).addScaledVector(this.toCam, o.r * 0.2);
      it.flash.quaternion.copy(this.faceOrb);
      const fsz = o.r * 2 * (1.05 + 0.95 * (1 - Math.pow(1 - f, 3)));
      it.flash.scale.set(fsz, fsz, 1);
      it.fm.opacity = f > 0 && f < 1 ? 0.85 * Math.pow(1 - f, 1.4) : 0;
      it.flash.visible = it.fm.opacity > 0.002;
    }
  }

  dispose() {
    this.geo.dispose();
    this.textures.forEach((t) => t.dispose());
    this.items.forEach((it) => {
      it.pm.dispose();
      it.cm.dispose();
      it.fm.dispose();
    });
  }
}
