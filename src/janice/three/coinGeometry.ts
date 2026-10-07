import * as THREE from "three";

type P = { r: number; z: number; nr: number; nz: number };

/**
 * A surface of revolution that morphs from a sphere (radius `sphereR`) into the logo coin:
 * a disc of radius 1 and thickness `thickness` with a flat face, a tight rounded rim
 * (radius `edge`) and a straight side wall, so it reads as a coin while it turns.
 * Axis is +Z (the coin face looks at the camera). Morph target 0 is the coin.
 */
export function buildCoinGeometry(sphereR: number, thickness: number, edge = 0.075, profileSteps = 200, radialSteps = 112) {
  const h = thickness / 2;
  const e = Math.min(edge, h * 0.9);
  // Profile segments from the front pole to the back pole, with sample weights (curves get more).
  const segs = [
    { len: 1 - e, w: 1, at: (u: number): P => ({ r: u * (1 - e), z: h, nr: 0, nz: 1 }) },
    {
      len: (Math.PI * e) / 2,
      w: 3.5,
      at: (u: number): P => {
        const a = (Math.PI / 2) * (1 - u);
        return { r: 1 - e + e * Math.cos(a), z: h - e + e * Math.sin(a), nr: Math.cos(a), nz: Math.sin(a) };
      },
    },
    { len: thickness - 2 * e, w: 2, at: (u: number): P => ({ r: 1, z: h - e - u * (thickness - 2 * e), nr: 1, nz: 0 }) },
    {
      len: (Math.PI * e) / 2,
      w: 3.5,
      at: (u: number): P => {
        const a = (-Math.PI / 2) * u;
        return { r: 1 - e + e * Math.cos(a), z: -(h - e) + e * Math.sin(a), nr: Math.cos(a), nz: Math.sin(a) };
      },
    },
    { len: 1 - e, w: 1, at: (u: number): P => ({ r: (1 - e) * (1 - u), z: -h, nr: 0, nz: -1 }) },
  ];
  const weighted = segs.map((s) => s.len * s.w);
  const total = weighted.reduce((a, b) => a + b, 0);
  const coinAt = (t: number): P => {
    let x = t * total;
    for (let i = 0; i < segs.length; i++) {
      if (x <= weighted[i] || i === segs.length - 1) return segs[i].at(Math.min(1, x / weighted[i]));
      x -= weighted[i];
    }
    return segs[segs.length - 1].at(1);
  };
  const sphereAt = (t: number): P => {
    const a = t * Math.PI; // pole to pole
    return { r: sphereR * Math.sin(a), z: sphereR * Math.cos(a), nr: Math.sin(a), nz: Math.cos(a) };
  };

  const rings = profileSteps + 1;
  const cols = radialSteps + 1;
  const pos = new Float32Array(rings * cols * 3);
  const nor = new Float32Array(rings * cols * 3);
  const mpos = new Float32Array(rings * cols * 3);
  const mnor = new Float32Array(rings * cols * 3);
  for (let i = 0; i < rings; i++) {
    const t = i / profileSteps;
    const sp = sphereAt(t);
    const cp = coinAt(t);
    for (let j = 0; j < cols; j++) {
      const th = (j / radialSteps) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const k = (i * cols + j) * 3;
      pos[k] = sp.r * c;
      pos[k + 1] = sp.r * s;
      pos[k + 2] = sp.z;
      nor[k] = sp.nr * c;
      nor[k + 1] = sp.nr * s;
      nor[k + 2] = sp.nz;
      mpos[k] = cp.r * c;
      mpos[k + 1] = cp.r * s;
      mpos[k + 2] = cp.z;
      mnor[k] = cp.nr * c;
      mnor[k + 1] = cp.nr * s;
      mnor[k + 2] = cp.nz;
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < radialSteps; j++) {
      const a = i * cols + j;
      const b = a + cols;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(idx);
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.morphAttributes.position = [new THREE.BufferAttribute(mpos, 3)];
  g.morphAttributes.normal = [new THREE.BufferAttribute(mnor, 3)];
  g.morphTargetsRelative = false;
  g.computeBoundingSphere();
  return g;
}
