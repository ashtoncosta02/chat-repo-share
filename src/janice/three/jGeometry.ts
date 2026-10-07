import * as THREE from "three";
import { J } from "@/janice/lib/brand";

/**
 * The logo "j" as three.js shapes, in disc units (disc radius = 1, y up, origin at the disc centre).
 * The stem + hook is a stroked path in the source art; here it is expanded to its exact outline
 * (offset arcs plus round caps) so it can be extruded.
 */
const toDisc = (x: number, y: number) => new THREE.Vector2((x - 128) / 128, (128 - y) / 128);

export function buildJShapes(arcSteps = 48): THREE.Shape[] {
  const { stemX, stemTop, arcY, arcR, endX, endY, phi, stroke, dotX, dotY, dotR } = J;
  const h = stroke / 2;
  const cx = stemX - arcR;
  const pts: THREE.Vector2[] = [];
  const arc = (ox: number, oy: number, r: number, a0: number, a1: number, steps: number) => {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      pts.push(toDisc(ox + r * Math.cos(a), oy + r * Math.sin(a)));
    }
  };
  // Screen space (y down): right edge of stem, outer hook, end cap, inner hook, left edge, top cap.
  pts.push(toDisc(stemX + h, stemTop));
  arc(cx, arcY, arcR + h, 0, phi, arcSteps);
  arc(endX, endY, h, phi, phi + Math.PI, arcSteps / 2);
  arc(cx, arcY, arcR - h, phi, 0, arcSteps);
  pts.push(toDisc(stemX - h, stemTop));
  arc(stemX, stemTop, h, Math.PI, Math.PI * 2, arcSteps / 2);
  pts.pop(); // closes onto the first point

  const stem = new THREE.Shape(pts);
  const dot = new THREE.Shape();
  const d = toDisc(dotX, dotY);
  dot.absarc(d.x, d.y, dotR / 128, 0, Math.PI * 2, false);
  return [stem, dot];
}
