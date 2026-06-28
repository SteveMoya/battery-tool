/**
 * F15d — STEP AP214 Exporter
 *
 * Generates valid STEP AP214 files for box and cylinder primitives.
 * Used to export spacer geometry from the pack to .step format
 * for Fusion 360 / SolidWorks import.
 *
 * No external dependencies — pure TypeScript STEP entity generation.
 */

import * as THREE from 'three';
import { packState } from './pack-builder';
import { inputs, $ } from './dom';

// ─── STEP Entity Builder ───────────────────────────────────────────────

class StepBuilder {
  private lines: string[] = [];
  private id = 0;

  add(entity: string): number {
    const nid = ++this.id;
    this.lines.push(`${nid}=${entity};`);
    return nid;
  }

  toString(): string {
    return [
      'ISO-10303-21;',
      'HEADER;',
      'FILE_DESCRIPTION((\'STEP AP214\'),1);',
      'FILE_NAME(\'bca_spacers.step\',',
      `  \'${new Date().toISOString()}\',`,
      '  (\'BCA Tool\'),',
      '  (\'Battery Tool\'),',
      '  \'\',',
      '  \'\',',
      '  \'\');',
      'FILE_SCHEMA((\'AUTOMOTIVE_DESIGN\'));',
      'ENDSEC;',
      'DATA;',
      ...this.lines,
      'ENDSEC;',
      'END-ISO-10303-21;',
    ].join('\n');
  }
}

// ─── Shared STEP Primitives ────────────────────────────────────────────

function addDir(b: StepBuilder, x: number, y: number, z: number): number {
  return b.add(`DIRECTION(${x},${y},${z})`);
}

function addPt(b: StepBuilder, x: number, y: number, z: number): number {
  return b.add(`CARTESIAN_POINT(${x},${y},${z})`);
}

function addAxis(b: StepBuilder, originId: number, zId: number, xId: number): number {
  return b.add(`AXIS2_PLACEMENT_3D(${originId},${zId},${xId})`);
}

function addLineEdge(
  b: StepBuilder,
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  surfId: number
): number {
  const v1 = addPt(b, x1, y1, z1);
  const v2 = addPt(b, x2, y2, z2);
  const dirId = addDir(b, x2 - x1, y2 - y1, z2 - z1);
  const lnId = b.add(`LINE(${v1},${dirId})`);
  return b.add(`EDGE_CURVE(${v1},${v2},${lnId},${surfId},.T.)`);
}

function addEdgeLoop(b: StepBuilder, edgeIds: number[]): number {
  const oriented = edgeIds.map((id) => `ORIENTED_EDGE(,,${id},.T.)`).join(',');
  return b.add(`EDGE_LOOP((${oriented}))`);
}

function addFaceBound(b: StepBuilder, loopId: number, outer: boolean): number {
  return b.add(`FACE_BOUND(${loopId},${outer ? '.T.' : '.F.'})`);
}

// ─── Box Solid ─────────────────────────────────────────────────────────

function addBox(
  b: StepBuilder,
  x: number, y: number, z: number,
  w: number, h: number, d: number,
  shapes: number[]
): void {
  // 8 corners
  const corners = [
    [x, y, z],         // 0: 000
    [x + w, y, z],     // 1: 100
    [x + w, y, z + d], // 2: 110
    [x, y, z + d],     // 3: 010
    [x, y + h, z],     // 4: 001
    [x + w, y + h, z], // 5: 101
    [x + w, y + h, z + d], // 6: 111
    [x, y + h, z + d], // 7: 011
  ];

  // Axis
  const origin = addPt(b, x, y, z);
  const zDir = addDir(b, 0, 0, 1);
  const xDir = addDir(b, 1, 0, 0);
  const axId = addAxis(b, origin, zDir, xDir);

  // Planes for each face
  const planes = {
    front:  b.add(`PLANE(${addPt(b, x, y, z)},${addDir(b, 0, 0, -1)},${xDir})`),
    back:   b.add(`PLANE(${addPt(b, x, y, z + d)},${addDir(b, 0, 0, 1)},${xDir})`),
    left:   b.add(`PLANE(${addPt(b, x, y, z)},${addDir(b, -1, 0, 0)},${zDir})`),
    right:  b.add(`PLANE(${addPt(b, x + w, y, z)},${addDir(b, 1, 0, 0)},${zDir})`),
    bottom: b.add(`PLANE(${addPt(b, x, y, z)},${addDir(b, 0, -1, 0)},${xDir})`),
    top:    b.add(`PLANE(${addPt(b, x, y + h, z)},${addDir(b, 0, 1, 0)},${xDir})`),
  };

  // Helper: create a face with 4 edges
  function makeFace(planeId: number, idx: number[], surfId: number): number {
    const edges: number[] = [];
    for (let i = 0; i < idx.length; i++) {
      const a = corners[idx[i]];
      const b2 = corners[idx[(i + 1) % idx.length]];
      edges.push(addLineEdge(b, a[0], a[1], a[2], b2[0], b2[1], b2[2], surfId));
    }
    const loop = addEdgeLoop(b, edges);
    const bound = addFaceBound(b, loop, true);
    return b.add(`ADVANCED_FACE('',(${bound}),${planeId},.T.)`);
  }

  const faces = [
    makeFace(planes.front,  [0, 1, 5, 4], planes.front),   // -Z
    makeFace(planes.back,   [3, 2, 6, 7], planes.back),    // +Z
    makeFace(planes.left,   [0, 3, 7, 4], planes.left),    // -X
    makeFace(planes.right,  [1, 2, 6, 5], planes.right),   // +X
    makeFace(planes.bottom, [0, 1, 2, 3], planes.bottom),  // -Y
    makeFace(planes.top,    [4, 5, 6, 7], planes.top),     // +Y
  ];

  const shell = b.add(`CLOSED_SHELL('',(${faces.join(',')}))`);
  const solid = b.add(`MANIFOLD_SOLID_SHAPE('',${shell})`);
  shapes.push(solid);
}

// ─── Cylinder Solid ────────────────────────────────────────────────────

function addCylinder(
  b: StepBuilder,
  cx: number, cy: number, cz: number,
  radius: number, height: number,
  segments: number,
  shapes: number[]
): void {
  const N = segments;

  // Bottom and top circle centers
  const botOrigin = addPt(b, cx, cy, cz);
  const topOrigin = addPt(b, cx, cy + height, cz);
  const yDir = addDir(b, 0, 1, 0);
  const xDir = addDir(b, 1, 0, 0);

  // Bottom circle (axis +Y, but we need the circle to go in the opposite
  // direction for the bottom face outward normal)
  const botAx = addAxis(b, botOrigin, yDir, xDir);
  const botCircId = b.add(`CIRCLE(${botAx},${radius})`);

  // Top circle (axis +Y, natural counterclockwise from above)
  const topAx = addAxis(b, topOrigin, yDir, xDir);
  const topCircId = b.add(`CIRCLE(${topAx},${radius})`);

  // Cylindrical side surface (torus with tube radius = 0)
  const cylOrigin = addPt(b, cx, cy, cz);
  const cylAx = addAxis(b, cylOrigin, yDir, xDir);
  const cylSurfId = b.add(`TOROIDAL_SURFACE('',${cylAx},${radius},0.)`);

  // Vertical line direction
  const vertDirId = addDir(b, 0, 1, 0);

  // Generate N vertices around the circumference
  const topVerts: number[] = [];
  const botVerts: number[] = [];
  for (let i = 0; i < N; i++) {
    const angle = (2 * Math.PI * i) / N;
    const px = cx + radius * Math.cos(angle);
    const pz = cz + radius * Math.sin(angle);
    topVerts.push(addPt(b, px, cy + height, pz));
    botVerts.push(addPt(b, px, cy, pz));
  }

  const faces: number[] = [];

  // N side faces (rectangles approximated as quad edge loops)
  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N;

    // Vertical edges along the cylinder surface
    const eLeft  = b.add(`EDGE_CURVE(${botVerts[i]},${topVerts[i]},${b.add(`LINE(${botVerts[i]},${vertDirId})`)},${cylSurfId},.T.)`);
    const eRight = b.add(`EDGE_CURVE(${botVerts[next]},${topVerts[next]},${b.add(`LINE(${botVerts[next]},${vertDirId})`)},${cylSurfId},.T.)`);

    // Bottom arc edge
    const eBot = b.add(`EDGE_CURVE(${botVerts[i]},${botVerts[next]},${botCircId},${cylSurfId},.T.)`);
    // Top arc edge
    const eTop = b.add(`EDGE_CURVE(${topVerts[i]},${topVerts[next]},${topCircId},${cylSurfId},.T.)`);

    const loop = addEdgeLoop(b, [eLeft, eTop, eRight, eBot]);
    const bound = addFaceBound(b, loop, true);
    faces.push(b.add(`ADVANCED_FACE('',(${bound}),${cylSurfId},.T.)`));
  }

  // Top cap face (+Y outward)
  const topCapEdges: number[] = [];
  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N;
    topCapEdges.push(b.add(`EDGE_CURVE(${topVerts[i]},${topVerts[next]},${topCircId},${topAx},.T.)`));
  }
  const topLoop = addEdgeLoop(b, topCapEdges);
  const topBound = addFaceBound(b, topLoop, true);
  faces.push(b.add(`ADVANCED_FACE('',(${topBound}),${topAx},.T.)`));

  // Bottom cap face (-Y outward, reversed orientation)
  const botCapEdges: number[] = [];
  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N;
    botCapEdges.push(b.add(`EDGE_CURVE(${botVerts[i]},${botVerts[next]},${botCircId},${botAx},.F.)`));
  }
  const botLoop = addEdgeLoop(b, botCapEdges);
  const botBound = addFaceBound(b, botLoop, true);
  faces.push(b.add(`ADVANCED_FACE('',(${botBound}),${botAx},.F.)`));

  const shell = b.add(`CLOSED_SHELL('',(${faces.join(',')}))`);
  const solid = b.add(`MANIFOLD_SOLID_SHAPE('',${shell})`);
  shapes.push(solid);
}

// ─── Export Function ───────────────────────────────────────────────────

export interface StepExportOptions {
  includeSpacers: boolean;
}

export function exportStep(opts: StepExportOptions): void {
  const group = packState.packGroup;
  if (!group || group.children.length === 0) {
    alert('No pack geometry to export.');
    return;
  }

  document.body.style.cursor = 'wait';

  try {
    const b = new StepBuilder();
    const shapes: number[] = [];
    const tempMatrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const segs = 32;

    // Determine spacer geometry type from UI
    const cellType = (inputs['cell-type'] as HTMLInputElement | null)?.value ?? 'cylindrical';
    const isPrismatic = cellType === 'prismatic';

    // Get spacer dimensions (same calculation as pack-builder.ts)
    const d = parseFloat(inputs['c-diam']?.value ?? '18');
    const pw = parseFloat(inputs['c-prism-w']?.value ?? '148');
    const pd = parseFloat(inputs['c-prism-d']?.value ?? '27');
    const spacing = parseFloat(inputs['c-spacing']?.value ?? '1');
    const effectiveD = d + spacing;
    const cellW = isPrismatic ? pw : d;
    const cellD = isPrismatic ? pd : d;
    const effectiveW = cellW + spacing;
    const effectiveDepth = cellD + spacing;
    const spacerHeight = 2.0;

    // Iterate spacer instances from the pack
    group.children.forEach((child) => {
      const inst = child as THREE.InstancedMesh;
      if (!inst.isInstancedMesh || inst.name !== 'spacers') return;
      if (!opts.includeSpacers) return;

      const count = inst.count;
      for (let i = 0; i < count; i++) {
        inst.getMatrixAt(i, tempMatrix);
        tempMatrix.decompose(pos, quat, scale);

        const sx = pos.x;
        const sy = pos.y;
        const sz = pos.z;

        if (isPrismatic) {
          addBox(b,
            sx - effectiveW / 2, sy - spacerHeight / 2, sz - effectiveDepth / 2,
            effectiveW, spacerHeight, effectiveDepth,
            shapes
          );
        } else {
          addCylinder(b,
            sx, sy - spacerHeight / 2, sz,
            effectiveD / 2, spacerHeight, segs,
            shapes
          );
        }
      }
    });

    if (shapes.length === 0) {
      alert('No spacers to export. Enable spacing > 0.05mm.');
      return;
    }

    // Wrap all shapes into a single product
    const appCtx = b.add(`APPLICATION_CONTEXT('automotive_design')`);
    const prodCtx = b.add(`PRODUCT_DEFINITION_CONTEXT('part',${appCtx},'design')`);
    const prodDef = b.add(`PRODUCT_DEFINITION('design','',${prodCtx})`);

    // Create shape representation for each solid
    const reps: number[] = [];
    for (const shapeId of shapes) {
      const rep = b.add(`REPRESENTATION('',(${b.add(`ITEM_DEFINED_TRANSFORMATION('',${shapeId},${prodDef})`)}))`);
      reps.push(b.add(`SHAPE_DEFINITION_REPRESENTATION('',${shapeId},${rep})`));
    }

    const stepContent = b.toString();
    const blob = new Blob([stepContent], { type: 'application/step' });
    const link = document.createElement('a');
    const packName = ((inputs['pack-name'] as HTMLInputElement | null)?.value || 'battery_pack').replace(/[^a-z0-9]/gi, '_');
    const s = ($('s-count') as HTMLInputElement | null)?.value ?? '0';
    const p = ($('p-count') as HTMLInputElement | null)?.value ?? '0';
    link.href = URL.createObjectURL(blob);
    link.download = `${packName}_${s}S${p}P_spacers_${Date.now()}.step`;
    link.click();
  } catch (e) {
    console.error('STEP export error:', e);
    alert('STEP export failed. See console for details.');
  } finally {
    document.body.style.cursor = 'default';
  }
}
