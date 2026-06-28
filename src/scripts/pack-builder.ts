import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CELL_DB } from './cell-database';
import { DEFAULT_SIZE_PRESETS, DEFAULT_CHEM_PRESETS } from './presets';
import { inputs, $ } from './dom';
import { getOpenCircuitVoltage, rescaleLoadSlider, updateSimulation, renderCurrentStats } from './simulation';
import { checkPacking, renderPackingIndicator } from './safety-indicators';
import { getAllBms } from './bms-database';

let userSizePresets: any[] = JSON.parse(localStorage.getItem('batt_vis_presets_size_v40') || '[]');
let userChemPresets: any[] = JSON.parse(localStorage.getItem('batt_vis_presets_chem_v40') || '[]');

/* ─── F7 — Theoretical packing densities ─── */
const THEO_SQUARE = Math.PI / 4;               // ≈ 0.7854
const THEO_HEX = Math.PI * Math.sqrt(3) / 6;   // ≈ 0.9069

let currentStats: any = {};
let currentNickelLen = 0;
let currentIsLadder = false;
let userHasTouchedBusMode = false;
let lastUserBusMode = 'both';
let userHasTouchedBusColor = false;
let perfToastTimer: number | null = null;
let needsOcclusionUpdate = true;

/* ─── F18 — 3D Visualization state ─── */
let isWireframe = false;
let hoveredMesh: THREE.Mesh | null = null;
let highlightedOriginalColor: THREE.Color | null = null;
const HIGHLIGHT_COLOR = new THREE.Color(0x60a5fa);

/* ─────────────────────────────────────────────
   F15a — 2D cell positions for SVG export
   ───────────────────────────────────────────── */

export interface CellPosition2D {
  x: number;
  z: number;
  s: number;
  p: number;
  layer: number;
  cellW: number;
  cellD: number;
  isPrismatic: boolean;
}

export interface BusbarConnection2D {
  x1: number; z1: number;
  x2: number; z2: number;
  type: 'parallel' | 'series';
  layer: number;
}

let cellPositions2D: CellPosition2D[] = [];
let busbarConnections2D: BusbarConnection2D[] = [];
let packBounds2D = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };

/* ─── F17 — Series positions for BMS wiring ─── */
let seriesPositions: { x: number; y: number; z: number }[] = [];

/* ─── F13 — Pack bounds for BMS interference detection ─── */
let packBounds3D = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, minY: 0, maxY: 0 };

export function getCellPositions2D(): CellPosition2D[] { return cellPositions2D; }
export function getBusbarConnections2D(): BusbarConnection2D[] { return busbarConnections2D; }
export function getPackBounds2D() { return packBounds2D; }

const busSelect = (): HTMLSelectElement | null => $('bus-mode') as HTMLSelectElement | null;

export const packState = {
  scene: null as unknown as THREE.Scene,
  camera: null as unknown as THREE.PerspectiveCamera,
  renderer: null as unknown as THREE.WebGLRenderer,
  labelRenderer: null as unknown as CSS2DRenderer,
  controls: null as unknown as OrbitControls,
  packGroup: null as unknown as THREE.Group,
  dimGroup: null as unknown as THREE.Group,
  occluders: [] as THREE.Object3D[],
  labels: [] as CSS2DObject[],
  raycaster: new THREE.Raycaster(),
  v3: new THREE.Vector3(),
  vDir: new THREE.Vector3(),
  wireRedMat: new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.5 }),
  wireBlackMat: new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.5 }),
  lineMat: new THREE.LineBasicMaterial({ color: 0x333333 }),
  cellMat: new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.15 }),
  capMat: new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.6 }),
  busMat: new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.85 }),
  spacerMat: new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.0 }),
  interConnMat:   new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.8 }),
  bmsBoxGroup:    null as unknown as THREE.Group,
  bmsBoxMat:      new THREE.MeshStandardMaterial({
    color: 0x4a90d9,
    transparent: true,
    opacity: 0.3,
    roughness: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
  bmsBoxEdgeMat:  new THREE.LineBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.6 }),
  bmsBoxHitMat:   new THREE.MeshStandardMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.35,
    roughness: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
  bmsBoxHitEdgeMat: new THREE.LineBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.7 }),
  bmsWiresGroup: null as unknown as THREE.Group,
  bmsWiresMat: new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.8 }),
  bmsWireNegMat: new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.9 }),
  bmsWirePosMat: new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.9 }),
  shrinkWrapMat: new THREE.MeshStandardMaterial({
    color: 0xdddddd,
    transparent: true,
    opacity: 0.15,
    roughness: 0.6,
    metalness: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
};

export function getStats() { return currentStats; }
export function getCellDb() { return CELL_DB; }
export function getSizePresets() { return [...DEFAULT_SIZE_PRESETS, ...userSizePresets]; }
export function getChemPresets() { return [...DEFAULT_CHEM_PRESETS, ...userChemPresets]; }
export function getUserSizePresets() { return userSizePresets; }
export function getUserChemPresets() { return userChemPresets; }
export function setUserSizePresets(p: any[]) { userSizePresets = p; localStorage.setItem('batt_vis_presets_size_v40', JSON.stringify(p)); }
export function setUserChemPresets(p: any[]) { userChemPresets = p; localStorage.setItem('batt_vis_presets_chem_v40', JSON.stringify(p)); }
export function getDefaultChemPresets() { return DEFAULT_CHEM_PRESETS; }
export function getDefaultSizePresets() { return DEFAULT_SIZE_PRESETS; }
export { getOpenCircuitVoltage };
export function getUserTouchedBusMode() { return userHasTouchedBusMode; }
export function setUserTouchedBusMode(v: boolean) { userHasTouchedBusMode = v; }
export function getLastUserBusMode() { return lastUserBusMode; }
export function setLastUserBusMode(v: string) { lastUserBusMode = v; }
export function getUserTouchedBusColor() { return userHasTouchedBusColor; }
export function setUserTouchedBusColor(v: boolean) { userHasTouchedBusColor = v; }
export function getNeedsOcclusionUpdate() { return needsOcclusionUpdate; }
export function setNeedsOcclusionUpdate(v: boolean) { needsOcclusionUpdate = v; }
export function getCurrentNickelLen() { return currentNickelLen; }
export function getPerfToastTimer() { return perfToastTimer; }
export function setPerfToastTimer(t: number | null) { perfToastTimer = t; }
export function setCurrentStats(s: any) { currentStats = s; }

/* ─── F10d — BOM Linear Footage ─── */
export interface BomData {
  nickelInPack: number;
  ladderOverhead: number;
  wasteFactorPct: number;
  wasteFactor: number;
  nickelMetersTotal: number;
  cellCount: number;
  configLabel: string;
  packName: string;
}

const WASTE_FACTOR_PCT = 0.15;
const LADDER_OVERHEAD_PER_P = 0.05;

export function getBomData(): BomData {
  const s = currentStats;
  const nickelInPack = s.nickel ?? 0;
  const isLadder = currentIsLadder;
  const P = s.p ?? 1;
  const ladderOverhead = isLadder && P > 1 ? nickelInPack * LADDER_OVERHEAD_PER_P * (P - 1) : 0;
  const wasteFactor = (nickelInPack + ladderOverhead) * WASTE_FACTOR_PCT;
  const nickelMetersTotal = nickelInPack + ladderOverhead + wasteFactor;
  return {
    nickelInPack,
    ladderOverhead,
    wasteFactorPct: WASTE_FACTOR_PCT,
    wasteFactor,
    nickelMetersTotal,
    cellCount: s.cells ?? 0,
    configLabel: `${s.s ?? 0}S ${s.p ?? 1}P${s.l > 1 ? ` ${s.l}L` : ''}`,
    packName: s.name ?? 'Pack',
  };
}

export function initThree(container: HTMLElement) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f6f9);
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 10000);
  camera.position.set(200, 200, 250);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.position = 'absolute';
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  container.appendChild(labelRenderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.addEventListener('change', () => { needsOcclusionUpdate = true; });
  controls.enableDamping = true;

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(100, 300, 150);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.bias = -0.0001;
  scene.add(dirLight);
  scene.add(new THREE.GridHelper(2000, 200, 0xd1d5db, 0xe5e7eb));

  const packGroup = new THREE.Group();
  scene.add(packGroup);
  const dimGroup = new THREE.Group();
  scene.add(dimGroup);
  const bmsBoxGroup = new THREE.Group();
  scene.add(bmsBoxGroup);

  const bmsWiresGroup = new THREE.Group();
  scene.add(bmsWiresGroup);

  packState.scene = scene;
  packState.camera = camera;
  packState.renderer = renderer;
  packState.labelRenderer = labelRenderer;
  packState.controls = controls;
  packState.packGroup = packGroup;
  packState.dimGroup = dimGroup;
  packState.bmsBoxGroup = bmsBoxGroup;
  packState.bmsWiresGroup = bmsWiresGroup;

  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
  });
}

export function addWire(startPos: THREE.Vector3, y: number, isPos: boolean, xDir: number, mode: string) {
  let xOffset = 50 * xDir; let vertOffset = 0;
  if (isPos) { vertOffset = mode === 'straight-out' ? 0 : (y > 10 ? 25 : -25); }
  else { xOffset = -50; vertOffset = mode === 'straight-out' ? 0 : -25; }
  const midPoint = new THREE.Vector3(startPos.x + xOffset * 0.2, startPos.y + vertOffset, startPos.z);
  const endPoint = new THREE.Vector3(startPos.x + xOffset, startPos.y + vertOffset, startPos.z);
  if (mode === 'straight-out') { midPoint.y = startPos.y; endPoint.y = startPos.y; }
  const curve = new THREE.CatmullRomCurve3([startPos, midPoint, endPoint]);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 12, 2.5, 8, false),
    isPos ? packState.wireRedMat : packState.wireBlackMat
  );
  packState.packGroup.add(tube);
}

export function addLabel(text: string, x: number, y: number, z: number, color?: string, type?: string) {
  const div = document.createElement('div');
  div.className = 'label-tag';
  if (type === 'inter') div.className += ' inter';
  if (color && type !== 'inter') { div.style.color = color; div.style.borderColor = color; }
  div.innerHTML = text;
  const obj = new CSS2DObject(div);
  obj.position.set(x, y, z);
  packState.packGroup.add(obj);
  packState.labels.push(obj);
}

export function addDimensions(w: number, hRender: number, d: number, _cx: number, _cz: number, hPhys: number) {
  const createDim = (start: THREE.Vector3, end: THREE.Vector3, label: string) => {
    const lineGeo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(lineGeo, packState.lineMat);
    packState.dimGroup.add(line);
    const coneGeo = new THREE.ConeGeometry(1.5, 4, 8);
    coneGeo.translate(0, -2, 0); coneGeo.rotateX(-Math.PI / 2);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const c1 = new THREE.Mesh(coneGeo, coneMat); c1.position.copy(start); c1.lookAt(end); packState.dimGroup.add(c1);
    const c2 = new THREE.Mesh(coneGeo, coneMat); c2.position.copy(end); c2.lookAt(start); packState.dimGroup.add(c2);
    const div = document.createElement('div'); div.className = 'dim-tag'; div.innerText = label;
    const obj = new CSS2DObject(div);
    obj.position.copy(start).lerp(end, 0.5);
    packState.dimGroup.add(obj);
    packState.labels.push(obj);
    return [start, end] as const;
  };
  const createWitness = (from: THREE.Vector3, to: THREE.Vector3) => {
    const mat = new THREE.LineBasicMaterial({ color: 0x999999, transparent: true, opacity: 0.5 });
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    packState.dimGroup.add(new THREE.Line(geo, mat));
  };
  const offset = 35;
  const zFront = (d / 2) + offset;
  const ptsW = createDim(new THREE.Vector3(-w / 2, 0, zFront), new THREE.Vector3(w / 2, 0, zFront), w.toFixed(1) + 'mm');
  createWitness(new THREE.Vector3(-w / 2, 0, d / 2), ptsW[0]);
  createWitness(new THREE.Vector3(w / 2, 0, d / 2), ptsW[1]);
  const xRight = (w / 2) + offset;
  const ptsD = createDim(new THREE.Vector3(xRight, 0, -d / 2), new THREE.Vector3(xRight, 0, d / 2), d.toFixed(1) + 'mm');
  createWitness(new THREE.Vector3(w / 2, 0, -d / 2), ptsD[0]);
  createWitness(new THREE.Vector3(w / 2, 0, d / 2), ptsD[1]);
  const xLeft = (-w / 2) - offset;
  const zCorner = d / 2;
  const ptsH = createDim(new THREE.Vector3(xLeft, 0, zCorner), new THREE.Vector3(xLeft, hRender, zCorner), hPhys.toFixed(1) + 'mm');
  createWitness(new THREE.Vector3(-w / 2, 0, d / 2), ptsH[0]);
  createWitness(new THREE.Vector3(-w / 2, hRender, d / 2), ptsH[1]);
}

export interface FillRatioData {
  fillRatio: number;
  theoMax: number;
  theoLabel: string;
  theoAlt: number;
  theoAltLabel: string;
  rotationSuggestion: string | null;
  cellAreaTotal: number;
  packArea: number;
  isHex: boolean;
}

export function calculateStats(w: number, dep: number, h: number, S_Total: number, P: number, L: number, fillData?: FillRatioData) {
  const v = parseFloat(inputs['c-volts']?.value ?? '3.6');
  const vMin = parseFloat(inputs['c-min-v']?.value ?? '2.5');
  const vMax = parseFloat(inputs['c-max-v']?.value ?? '4.2');
  const ah = parseFloat(inputs['c-mah']?.value ?? '2500');
  const amp = parseFloat(inputs['c-amp']?.value ?? '20');
  const weight = parseFloat(inputs['c-weight']?.value ?? '45');
  const costStr = inputs['c-cost']?.value ?? '€0';
  const costVal = parseFloat(costStr.replace(/[^0-9.]/g, '')) || 0;
  let costSym = costStr.replace(/[0-9.]/g, '').trim(); if (!costSym) costSym = '€';

  const totalCells = S_Total * P;
  const packV = S_Total * v;
  const packVMin = S_Total * vMin;
  const packVMax = S_Total * vMax;
  const packAh = (P * ah) / 1000;
  const packWh = packV * packAh;
  const packKg = (totalCells * weight) / 1000;
  const packCost = totalCells * costVal;
  const packVol = (w * dep * h) / 1000000;
  const maxKw = (packV * (P * amp)) / 1000;
  const maxAmps = P * amp;
  const nickelMeters = currentNickelLen / 1000;

  const outNickel = $('out-nickel'); if (outNickel) outNickel.textContent = `${nickelMeters.toFixed(2)} m`;
  const totalCellsText = `<span class="cell-count-wrap">(${totalCells} cells)</span>`;
  let configStr = `${S_Total}S&nbsp;${P}P`;
  if (L > 1) configStr += `&nbsp;${L}L`;
  configStr += ` ${totalCellsText}`;
  const outConfig = $('out-config'); if (outConfig) outConfig.innerHTML = configStr;
  const outNom = $('out-nom-label'); if (outNom) outNom.innerHTML = `${packV.toFixed(1)}V&nbsp;${packAh.toFixed(1)}Ah`;
  const outVR = $('out-v-range'); if (outVR) outVR.textContent = `${packVMin.toFixed(1)} - ${packVMax.toFixed(1)} V`;
  const outWh = $('out-wh');
  if (outWh) outWh.textContent = packWh >= 1000 ? `${(packWh / 1000).toFixed(2)} kWh` : `${Math.round(packWh)} Wh`;
  const dimL = $('dim-l'); if (dimL) dimL.textContent = `${w.toFixed(1)} mm`;
  const dimW = $('dim-w'); if (dimW) dimW.textContent = `${dep.toFixed(1)} mm`;
  const dimH = $('dim-h'); if (dimH) dimH.textContent = `${h.toFixed(0)} mm`;
  const outVol = $('out-vol');
  if (outVol) outVol.textContent = packVol >= 1.0 ? `${packVol.toFixed(2)} L` : `${Math.round(packVol * 1000)} mL`;
  const outWeight = $('out-weight'); if (outWeight) outWeight.textContent = `${packKg.toFixed(2)} kg`;
  let powerStr = maxKw >= 1.0 ? `${maxKw.toFixed(2)}kW` : `${Math.round(maxKw * 1000)}W`;
  const outOut = $('out-output');
  if (outOut) outOut.innerHTML = `${maxAmps.toFixed(0)}A&nbsp;<span style="font-weight:400">|</span>&nbsp;${powerStr}`;
  let costDisplay = packCost >= 1000
    ? packCost.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : packCost.toFixed(2);
  const outCost = $('out-cost'); if (outCost) outCost.textContent = `${costSym}${costDisplay}`;

  // F7 — Fill Ratio display
  if (fillData) {
    const outFill = $('out-fill-ratio');
    if (outFill) {
      const pct = (fillData.fillRatio * 100).toFixed(1);
      const theoPct = (fillData.theoMax * 100).toFixed(1);
      outFill.textContent = `${pct}% / ${theoPct}%`;
      // Color: green if within 5% of theoretical, yellow if 5-15% gap, red if >15%
      const gap = fillData.theoMax > 0 ? (fillData.theoMax - fillData.fillRatio) / fillData.theoMax : 0;
      outFill.className = outFill.className.replace(/\bc-(green|yellow|red|orange)\b/g, '');
      if (gap < 0.05) outFill.classList.add('c-green');
      else if (gap < 0.15) outFill.classList.add('c-yellow');
      else outFill.classList.add('c-orange');
    }
    const outTheo = $('out-theo-density');
    if (outTheo) {
      outTheo.textContent = `${fillData.theoLabel}: ${(fillData.theoMax * 100).toFixed(1)}%`;
    }
    const rotEl = $('out-rotation-hint');
    if (rotEl) {
      if (fillData.rotationSuggestion) {
        rotEl.textContent = fillData.rotationSuggestion;
        rotEl.classList.remove('hidden');
      } else {
        rotEl.textContent = '';
        rotEl.classList.add('hidden');
      }
    }
  }

  renderCurrentStats();

  setCurrentStats({
    name: inputs['pack-name']?.value ?? '',
    s: S_Total, p: P, l: L, cells: totalCells,
    v: packV, ah: packAh, wh: packWh,
    w, d: dep, h, vol: packVol,
    kg: packKg, cost: packCost, kw: maxKw,
    amp: maxAmps, vmin: packVMin, vmax: packVMax,
    nickel: nickelMeters,
    fillRatio: fillData?.fillRatio ?? 0,
    theoMax: fillData?.theoMax ?? THEO_SQUARE,
  });
}

export function updatePack() {
  const d = parseFloat(inputs['c-diam']?.value ?? '18');
  const cellType = (inputs['cell-type'] as HTMLInputElement | null)?.value ?? 'cylindrical';
  const isPrismatic = cellType === 'prismatic';
  const pw = parseFloat(inputs['c-prism-w']?.value ?? '148');  // prismatic width (mm)
  const pd = parseFloat(inputs['c-prism-d']?.value ?? '27');   // prismatic depth (mm)
  const stripWidth = parseFloat(inputs['sim-strip-w']?.value ?? '') || (d * 0.4);
  const stripThick = parseFloat(inputs['sim-strip-t']?.value ?? '') || 0.3;

  (packState.scene.background as THREE.Color | null)?.set((inputs['col-bg'] as HTMLInputElement)?.value ?? '#f4f6f9');
  currentNickelLen = 0;
  cellPositions2D = [];
  busbarConnections2D = [];
  packState.occluders.length = 0;
  packState.labels.forEach((l) => {
    if (l.parent) l.parent.remove(l);
    if (l.element && l.element.parentNode) l.element.parentNode.removeChild(l.element);
  });
  packState.labels.length = 0;

  while (packState.packGroup.children.length > 0) {
    const c: any = packState.packGroup.children[0];
    if (c.geometry) c.geometry.dispose();
    if (c.material) {
      const isGlobal = (c.material === packState.cellMat || c.material === packState.capMat ||
        c.material === packState.busMat || c.material === packState.spacerMat ||
        c.material === packState.interConnMat);
      if (!isGlobal) {
        if (Array.isArray(c.material)) c.material.forEach((m: any) => m.dispose());
        else c.material.dispose();
      }
    }
    packState.packGroup.remove(c);
  }
  while (packState.dimGroup.children.length > 0) packState.dimGroup.remove(packState.dimGroup.children[0]);
  document.querySelectorAll('.label-tag, .dim-tag').forEach((el) => el.remove());

  const l = isPrismatic
    ? parseFloat(inputs['c-len-p']?.value ?? '91')
    : parseFloat(inputs['c-len']?.value ?? '65');
  const S_Total = parseInt(inputs['s-count']?.value ?? '10');
  const P = parseInt(inputs['p-count']?.value ?? '1');
  let Layers = parseInt(inputs['pack-layers']?.value ?? '1') || 1;
  const spacing = parseFloat(inputs['c-spacing']?.value ?? '1');
  const effectiveD = d + spacing;
  const cellW = isPrismatic ? pw : d;
  const cellD = isPrismatic ? pd : d;
  const effectiveW = cellW + spacing;
  const effectiveDepth = cellD + spacing;
  const isHex = (inputs['hex-mode'] as HTMLInputElement | null)?.checked ?? false;
  const isLadder = (inputs['calc-ladder'] as HTMLInputElement | null)?.checked ?? false;
  currentIsLadder = isLadder;
  const nomV = parseFloat(inputs['c-volts']?.value ?? '3.6');
  const busMode = (inputs['bus-mode'] as unknown as HTMLSelectElement | null)?.value ?? 'both';
  const showGeo = busMode !== 'none';
  const physLayerSpace = parseFloat(inputs['layer-spacing']?.value ?? '0') || 0;
  const visualLayerSpace = (inputs['exploded-view'] as HTMLInputElement | null)?.checked ? 40 : 0;
  const barleyPaper = (inputs['barley-paper'] as HTMLInputElement | null)?.checked ?? false;
  const barleyThickness = barleyPaper ? (parseFloat(inputs['barley-thickness']?.value ?? '0.2') || 0) : 0;
  if (Layers < 1) Layers = 1;
  if (Layers > S_Total) Layers = S_Total;
  const totalInstances = S_Total * P;

  let segs = 32;
  if (totalInstances > 500) segs = 16;
  if (totalInstances > 1000) segs = 10;

  const boxGeo = new THREE.BoxGeometry(stripWidth, stripThick, 1.0);
  const cylGeo = new THREE.CylinderGeometry(stripWidth / 2, stripWidth / 2, stripThick, segs);

  const highPerf = totalInstances > 500;
  const toast = $('perf-toast');
  if (highPerf) {
    if (!userHasTouchedBusMode) {
      const sel = busSelect();
      if (sel && sel.value !== 'geo' && sel.value !== 'none') {
        sel.value = 'geo';
        if (inputs['bus-mode']) (inputs['bus-mode'] as unknown as HTMLSelectElement).value = 'geo';
        if (toast) (toast as HTMLElement).style.display = 'flex';
        if (perfToastTimer) clearTimeout(perfToastTimer);
        perfToastTimer = window.setTimeout(() => { if (toast) (toast as HTMLElement).style.display = 'none'; }, 4000);
      }
    } else {
      const sel = busSelect();
      if (sel && (sel.value === 'bn' || sel.value === 'both')) {
        if (toast) (toast as HTMLElement).style.display = 'none';
      } else {
        if (toast && (toast as HTMLElement).style.display === 'none') {
          (toast as HTMLElement).style.display = 'flex';
          if (perfToastTimer) clearTimeout(perfToastTimer);
          perfToastTimer = window.setTimeout(() => { if (toast) (toast as HTMLElement).style.display = 'none'; }, 4000);
        }
      }
    }
  } else {
    if (toast) (toast as HTMLElement).style.display = 'none';
    if (!userHasTouchedBusMode) {
      const sel = busSelect();
      if (sel && sel.value === 'geo' && lastUserBusMode !== 'geo') {
        sel.value = lastUserBusMode;
        if (inputs['bus-mode']) (inputs['bus-mode'] as unknown as HTMLSelectElement).value = lastUserBusMode;
      }
    }
  }

  const explCheck = $('exploded-view') as HTMLInputElement | null;
  const lblExpl = $('lbl-exploded');
  const rowInter = $('row-inter');
  const inpInterCol = $('col-inter') as HTMLInputElement | null;
  const inpInterMet = $('met-inter') as HTMLInputElement | null;
  if (Layers > 1) {
    if (explCheck) explCheck.disabled = false;
    lblExpl?.classList.remove('disabled');
    rowInter?.classList.remove('disabled');
    if (inpInterCol) inpInterCol.disabled = false;
    if (inpInterMet) inpInterMet.disabled = false;
  } else {
    if (explCheck) { explCheck.checked = false; explCheck.disabled = true; }
    lblExpl?.classList.add('disabled');
    rowInter?.classList.add('disabled');
    if (inpInterCol) inpInterCol.disabled = true;
    if (inpInterMet) inpInterMet.disabled = true;
  }

  /* F8b: Barley paper — show/hide thickness input based on layers */
  const barleyCheck = $('barley-paper') as HTMLInputElement | null;
  const barleyRow = $('barley-thickness-row');
  const barleyInp = $('barley-thickness') as HTMLInputElement | null;
  if (Layers > 1) {
    if (barleyCheck) barleyCheck.disabled = false;
  } else {
    if (barleyCheck) { barleyCheck.checked = false; barleyCheck.disabled = true; }
    if (barleyRow) barleyRow.classList.add('hidden');
    if (barleyInp) barleyInp.disabled = true;
  }
  if (barleyCheck?.checked) {
    if (barleyRow) barleyRow.classList.remove('hidden');
    if (barleyInp) barleyInp.disabled = false;
  } else {
    if (barleyRow) barleyRow.classList.add('hidden');
    if (barleyInp) barleyInp.disabled = true;
  }

  packState.interConnMat.color.set(inpInterCol?.value ?? '#b87333');
  packState.interConnMat.metalness = parseFloat(inpInterMet?.value ?? '0.8');

  packState.cellMat.color.set((inputs['col-cell'] as HTMLInputElement)?.value ?? '#f0a3ff');
  packState.cellMat.metalness = parseFloat((inputs['met-cell'] as HTMLInputElement)?.value ?? '0.15');
  packState.capMat.color.set((inputs['col-cap'] as HTMLInputElement)?.value ?? '#ffffff');
  packState.capMat.metalness = parseFloat((inputs['met-cap'] as HTMLInputElement)?.value ?? '0.2');
  packState.spacerMat.color.set((inputs['col-spacer'] as HTMLInputElement)?.value ?? '#111111');
  packState.spacerMat.metalness = parseFloat((inputs['met-spacer'] as HTMLInputElement)?.value ?? '0');

  const matRho = parseFloat((inputs['sim-strip-mat'] as unknown as HTMLSelectElement)?.value ?? '7');
  let busColor = (inputs['col-bus'] as HTMLInputElement)?.value ?? '#ff8f00';
  if (!userHasTouchedBusColor) {
    if (matRho <= 1.8) busColor = '#b87333';
    else if (matRho <= 2.5) busColor = '#FFD700';
    else if (matRho >= 13.0) busColor = '#475569';
    else busColor = '#d1d5db';
    if (inputs['col-bus']) (inputs['col-bus'] as HTMLInputElement).value = busColor;
  }
  packState.busMat.color.set(busColor);
  packState.busMat.metalness = parseFloat((inputs['met-bus'] as HTMLInputElement)?.value ?? '0.3');

  const cellGeo = isPrismatic
    ? new THREE.BoxGeometry(cellW, l, cellD)
    : new THREE.CylinderGeometry(d / 2, d / 2, l, segs);
  const capGeo = isPrismatic
    ? new THREE.BoxGeometry(cellW * 0.7, 0.5, cellD * 0.7)
    : new THREE.CylinderGeometry(d / 2 * 0.7, d / 2 * 0.7, 0.5, Math.max(8, segs / 2));
  const edgesGeo = !highPerf ? new THREE.EdgesGeometry(cellGeo, 20) : null;
  const spacerGeo = isPrismatic
    ? new THREE.BoxGeometry(effectiveW, 2.0, effectiveDepth)
    : new THREE.CylinderGeometry(effectiveD / 2, effectiveD / 2, 2.0, segs);

  const meshCells = new THREE.InstancedMesh(cellGeo, packState.cellMat, totalInstances);
  (meshCells as any).name = 'cells';
  const meshCaps = new THREE.InstancedMesh(capGeo, packState.capMat, totalInstances);
  (meshCaps as any).name = 'caps';
  const hasSpacers = spacing > 0.05;
  const meshSpacers = new THREE.InstancedMesh(spacerGeo, packState.spacerMat, hasSpacers ? totalInstances * 2 : 0);
  (meshSpacers as any).name = 'spacers';
  const applyShadows = (mesh: THREE.Mesh) => { mesh.castShadow = !highPerf; mesh.receiveShadow = !highPerf; };
  applyShadows(meshCells); applyShadows(meshCaps); applyShadows(meshSpacers);

  const maxConns = totalInstances * 4;
  const meshStrips = new THREE.InstancedMesh(boxGeo, packState.busMat, maxConns);
  (meshStrips as any).name = 'busbars';
  const meshBusCaps = new THREE.InstancedMesh(cylGeo, packState.busMat, maxConns * 2);
  (meshBusCaps as any).name = 'busbars';
  applyShadows(meshStrips); applyShadows(meshBusCaps);

  let stripIdx = 0;
  let busCapIdx = 0;
  const dummy = new THREE.Object3D();
  const dummyCap = new THREE.Object3D();
  const dummySpacer = new THREE.Object3D();
  const dummyStrip = new THREE.Object3D();
  const dummyBusCap = new THREE.Object3D();

  let mergedEdgePos: Float32Array | undefined;
  let edgePos: any;
  let edgeVOffset = 0;
  if (!highPerf && edgesGeo) {
    edgePos = edgesGeo.attributes.position;
    const totalEdgePoints = edgePos.count * totalInstances;
    mergedEdgePos = new Float32Array(totalEdgePoints * 3);
  }

  const baseS = Math.floor(S_Total / Layers);
  const remainder = S_Total % Layers;
  let globalSIndex = 0;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let currentXSlot = 0; let xDirection = 1;
  let lastLayerEndCells: any[] = [];
  let prevLayerOutputIsTop = true;
  let instanceIdx = 0; let spacerIdx = 0;
  seriesPositions = []; // Reset for F17 BMS wiring

  for (let ly = 0; ly < Layers; ly++) {
    const layerYBase = ly * (l + physLayerSpace + barleyThickness + visualLayerSpace);
    const currentLayerS = (ly < remainder) ? (baseS + 1) : baseS;
    if (ly > 0) { currentXSlot -= xDirection; xDirection *= -1; }
    const layerColCenters: any[][] = [];
    let inputIsBottom = true;
    if (ly === 0) {
      if (Layers > 1 && currentLayerS % 2 === 0) inputIsBottom = false; else inputIsBottom = true;
    } else { inputIsBottom = prevLayerOutputIsTop; }
    let outputIsTop = false;
    if (currentLayerS % 2 === 0) outputIsTop = !inputIsBottom; else outputIsTop = inputIsBottom;
    prevLayerOutputIsTop = outputIsTop;

    for (let s = 0; s < currentLayerS; s++) {
      const colData: any[] = [];
      for (let p = 0; p < P; p++) {
        let x = currentXSlot * (isPrismatic ? effectiveW : effectiveD);
        let z = p * (isPrismatic ? effectiveDepth : effectiveD);
        if (isHex) {
          z = p * ((isPrismatic ? effectiveDepth : effectiveD) * 0.866);
          if (isLadder) x += (p * 0.5 * (isPrismatic ? effectiveW : effectiveD));
          else if (p % 2 !== 0) x += (isPrismatic ? effectiveW : effectiveD) * 0.5;
        }
        minX = Math.min(minX, x - cellW / 2); maxX = Math.max(maxX, x + cellW / 2);
        minZ = Math.min(minZ, z - cellD / 2); maxZ = Math.max(maxZ, z + cellD / 2);
        const cellY = layerYBase + l / 2;
        colData.push({ x, y: cellY, z });
        dummy.position.set(x, cellY, z);
        let isUpright = (s % 2 === 0);
        if (!inputIsBottom) isUpright = !isUpright;
        dummy.rotation.x = isUpright ? 0 : Math.PI;
        dummy.updateMatrix();
        meshCells.setMatrixAt(instanceIdx, dummy.matrix);

        dummyCap.copy(dummy);
        dummyCap.translateY(l / 2 + 0.26);
        dummyCap.updateMatrix();
        meshCaps.setMatrixAt(instanceIdx, dummyCap.matrix);

        if (hasSpacers) {
          dummySpacer.copy(dummy);
          dummySpacer.translateY(-(l / 2) + 1.0 + 0.05);
          dummySpacer.updateMatrix();
          meshSpacers.setMatrixAt(spacerIdx++, dummySpacer.matrix);
          dummySpacer.copy(dummy);
          dummySpacer.translateY((l / 2) - 1.0 - 0.05);
          dummySpacer.updateMatrix();
          meshSpacers.setMatrixAt(spacerIdx++, dummySpacer.matrix);
        }
        if (!highPerf && edgePos && mergedEdgePos) {
          const mat = dummy.matrix;
          for (let i = 0; i < edgePos.count; i++) {
            packState.v3.set(edgePos.getX(i), edgePos.getY(i), edgePos.getZ(i));
            packState.v3.applyMatrix4(mat);
            mergedEdgePos[edgeVOffset++] = packState.v3.x;
            mergedEdgePos[edgeVOffset++] = packState.v3.y;
            mergedEdgePos[edgeVOffset++] = packState.v3.z;
          }
        }
        instanceIdx++;
      }
      layerColCenters.push(colData);
      currentXSlot += xDirection;
    }

    // F15a: Store 2D positions for SVG export
    for (let s = 0; s < currentLayerS; s++) {
      for (let p = 0; p < P; p++) {
        const pt = layerColCenters[s][p];
        cellPositions2D.push({
          x: pt.x, z: pt.z,
          s: globalSIndex + s, p, layer: ly,
          cellW, cellD, isPrismatic,
        });
      }
      // F17: Store series center position for BMS wiring
      const colCells = layerColCenters[s];
      let cx = 0, cy = 0, cz = 0;
      for (const c of colCells) { cx += c.x; cy += c.y; cz += c.z; }
      const n = colCells.length || 1;
      seriesPositions.push({ x: cx / n, y: cy / n, z: cz / n });
    }

    if (showGeo) {
      const addStripInstanced = (p1: any, p2: any, yWorld: number, isActualNickel: boolean) => {
        const vec1 = new THREE.Vector3(p1.x, yWorld, p1.z);
        const vec2 = new THREE.Vector3(p2.x, yWorld, p2.z);
        const dist = vec1.distanceTo(vec2);
        const mid = vec1.clone().add(vec2).multiplyScalar(0.5);
        if (isActualNickel) currentNickelLen += dist;
        dummyStrip.position.copy(mid);
        dummyStrip.lookAt(vec2);
        dummyStrip.scale.set(1, 1, dist);
        dummyStrip.updateMatrix();
        meshStrips.setMatrixAt(stripIdx++, dummyStrip.matrix);
        dummyBusCap.position.copy(vec1);
        dummyBusCap.rotation.set(0, 0, 0);
        dummyBusCap.scale.set(1, 1, 1);
        dummyBusCap.updateMatrix();
        meshBusCaps.setMatrixAt(busCapIdx++, dummyBusCap.matrix);
        dummyBusCap.position.copy(vec2);
        dummyBusCap.updateMatrix();
        meshBusCaps.setMatrixAt(busCapIdx++, dummyBusCap.matrix);
        return mid;
      };
      const offset = 0.5 + (stripThick / 2);
      const yTop = layerYBase + l + offset;
      const yBot = layerYBase - offset;
      for (let s = 0; s < currentLayerS; s++) {
        for (let p = 0; p < P - 1; p++) {
          addStripInstanced(layerColCenters[s][p], layerColCenters[s][p + 1], yTop, true);
          addStripInstanced(layerColCenters[s][p], layerColCenters[s][p + 1], yBot, true);
          // F15a: Store parallel busbar connection
          busbarConnections2D.push({
            x1: layerColCenters[s][p].x, z1: layerColCenters[s][p].z,
            x2: layerColCenters[s][p + 1].x, z2: layerColCenters[s][p + 1].z,
            type: 'parallel', layer: ly,
          });
        }
      }
      for (let s = 0; s < currentLayerS - 1; s++) {
        const realS = globalSIndex + s;
        const isEvenS = (s % 2 === 0);
        let isTopConn = isEvenS;
        if (!inputIsBottom) isTopConn = !isTopConn;
        const yPos = isTopConn ? yTop : yBot;
        let labelPos: THREE.Vector3 | null = null;
        for (let p = 0; p < P; p++) {
          const center = addStripInstanced(layerColCenters[s][p], layerColCenters[s + 1][p], yPos, true);
          if (p === Math.floor(P / 2)) labelPos = center;
          // F15a: Store series busbar connection (one per P group)
          if (p === 0) {
            busbarConnections2D.push({
              x1: layerColCenters[s][p].x, z1: layerColCenters[s][p].z,
              x2: layerColCenters[s + 1][p].x, z2: layerColCenters[s + 1][p].z,
              type: 'series', layer: ly,
            });
          }
        }
        if ((busMode === 'bn' || busMode === 'both') && labelPos) {
          const vNum = realS + 1;
          const volt = (vNum * nomV).toFixed(1) + 'V';
          const txt = busMode === 'bn' ? `B${vNum}` : `B${vNum} ${volt}`;
          const labelY = yPos + (isTopConn ? 3 : -3);
          addLabel(txt, labelPos.x, labelY, labelPos.z);
        }
      }
      if (ly > 0 && lastLayerEndCells.length > 0) {
        const prevBaseY = (ly - 1) * (l + physLayerSpace + barleyThickness + visualLayerSpace);
        const prevOutTop = !inputIsBottom;
        const yStart = prevOutTop ? (prevBaseY + l + offset) : (prevBaseY - offset);
        const yEnd = inputIsBottom ? (layerYBase - offset) : (layerYBase + l + offset);
        let labelPos: THREE.Vector3 | null = null;
        for (let p = 0; p < P; p++) {
          const startNode = new THREE.Vector3(lastLayerEndCells[p].x, yStart, lastLayerEndCells[p].z);
          const endNode = new THREE.Vector3(layerColCenters[0][p].x, yEnd, layerColCenters[0][p].z);
          const curve = new THREE.CatmullRomCurve3([
            startNode,
            new THREE.Vector3(startNode.x, (startNode.y + endNode.y) / 2, startNode.z),
            endNode,
          ]);
          const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 4, 0.8, 8, false), packState.interConnMat);
          packState.packGroup.add(tube);
          if (p === Math.floor(P / 2)) labelPos = curve.getPointAt(0.5);
        }
        if ((busMode === 'bn' || busMode === 'both') && labelPos) {
          const vNum = globalSIndex;
          const volt = (vNum * nomV).toFixed(1) + 'V';
          const targetCell = layerColCenters[0][P - 1];
          addLabel(`I${vNum} ${volt}`, targetCell.x, yEnd, targetCell.z + d / 2 + 2, '#eab308', 'inter');
        }
      }
      lastLayerEndCells = layerColCenters[currentLayerS - 1];

      const getTerminalPos = (sLocalIndex: number, yLevel: number) => {
        const pCenters = layerColCenters[sLocalIndex];
        if (P % 2 !== 0) {
          const idx = Math.floor(P / 2);
          return new THREE.Vector3(pCenters[idx].x, yLevel, pCenters[idx].z);
        } else {
          const idx1 = (P / 2) - 1; const idx2 = P / 2;
          const p1 = pCenters[idx1]; const p2 = pCenters[idx2];
          return new THREE.Vector3((p1.x + p2.x) / 2, yLevel, (p1.z + p2.z) / 2);
        }
      };

      if (ly === 0) {
        const yStart = inputIsBottom ? yBot : yTop;
        const nStart = getTerminalPos(0, yStart);
        let wMode = 'standard';
        if (!inputIsBottom && Layers > 1) wMode = 'straight-out';
        addWire(nStart, yStart, false, 1, wMode);
        if (busMode !== 'geo' && busMode !== 'none') {
          addLabel('0V', nStart.x, yStart + (inputIsBottom ? -5 : 5), nStart.z, '#333');
        }
      }
      if (ly === Layers - 1) {
        const lastLocalS = currentLayerS - 1;
        const posY = outputIsTop ? yTop : yBot;
        const pStart = getTerminalPos(lastLocalS, posY);
        const exitDir = xDirection;
        let wMode = 'standard';
        if (!outputIsTop && Layers > 1) wMode = 'straight-out';
        addWire(pStart, posY, true, exitDir, wMode);
        if (busMode !== 'geo' && busMode !== 'none') {
          const totV = (S_Total * nomV).toFixed(1) + 'V';
          const lblY = posY + (outputIsTop ? 5 : -5);
          addLabel(`+${totV}`, pStart.x, lblY, pStart.z, '#d32f2f');
        }
      }
    }
    globalSIndex += currentLayerS;
  }

  packState.packGroup.add(meshCells);
  meshCells.instanceMatrix.needsUpdate = true;
  if (!highPerf) packState.occluders.push(meshCells);
  packState.packGroup.add(meshCaps);
  meshCaps.instanceMatrix.needsUpdate = true;
  if (hasSpacers) {
    packState.packGroup.add(meshSpacers);
    meshSpacers.instanceMatrix.needsUpdate = true;
  }
  if (showGeo && stripIdx > 0) {
    meshStrips.count = stripIdx; meshBusCaps.count = busCapIdx;
    packState.packGroup.add(meshStrips); packState.packGroup.add(meshBusCaps);
  }
  if (!highPerf && mergedEdgePos) {
    const mergedEdgeGeo = new THREE.BufferGeometry();
    const actualEdgePos = mergedEdgePos.subarray(0, edgeVOffset);
    mergedEdgeGeo.setAttribute('position', new THREE.BufferAttribute(actualEdgePos, 3));
    const finalEdges = new THREE.LineSegments(mergedEdgeGeo, new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.1, transparent: true }));
    packState.packGroup.add(finalEdges);
  }

  if (isLadder && P > 1) currentNickelLen /= P;
  const badge = $('badge-ladder'); if (badge) (badge as HTMLElement).style.display = isLadder ? 'inline-block' : 'none';

  minX -= spacing / 2; maxX += spacing / 2; minZ -= spacing / 2; maxZ += spacing / 2;
  const bW = (maxX - minX); const bD = (maxZ - minZ);
  const physHeight = (l * Layers) + ((physLayerSpace + barleyThickness) * (Layers - 1));
  const renderHeight = (l * Layers) + ((physLayerSpace + barleyThickness + visualLayerSpace) * (Layers - 1));
  const cX = (minX + maxX) / 2; const cZ = (minZ + maxZ) / 2;
  packState.packGroup.position.set(-cX, 0, -cZ);
  // F15a: Store pack bounds for SVG export
  packBounds2D = { minX, maxX, minZ, maxZ };
  // F13: Store 3D pack bounds in world space (after centering at origin)
  packBounds3D = {
    minX: minX - cX, maxX: maxX - cX,
    minZ: minZ - cZ, maxZ: maxZ - cZ,
    minY: 0, maxY: physHeight,
  };
  addDimensions(bW, renderHeight, bD, cX, cZ, physHeight);

  /* ─── F7 — Fill Ratio & Packing Heuristics ─── */
  const packArea = bW * bD;
  let cellAreaTotal = 0;
  let cellAreaSingle = 0;
  if (isPrismatic) {
    cellAreaSingle = pw * pd;
  } else {
    cellAreaSingle = Math.PI * (d / 2) ** 2;
  }
  // 2D fill ratio: only count cells in ONE layer (layers stack vertically, same footprint)
  cellAreaTotal = cellAreaSingle * (S_Total / Layers) * P;
  const fillRatio = packArea > 0 ? cellAreaTotal / packArea : 0;

  // Theoretical max densities for current mode
  const theoMax = isHex ? THEO_HEX : THEO_SQUARE;
  const theoAlt = isHex ? THEO_SQUARE : THEO_HEX;
  const theoLabel = isHex ? 'Hex' : 'Square';
  const theoAltLabel = isHex ? 'Square' : 'Hex';

  // Auto-rotation check: would rotating 90° improve packing?
  let rotationSuggestion: string | null = null;
  if (!isPrismatic && S_Total > 1 && P > 1) {
    // Simulate rotated layout: swap effectiveW and effectiveDepth roles
    const rotW = P * effectiveD + (isHex ? effectiveD * 0.5 : 0);
    const rotD = S_Total * (isHex ? effectiveD * 0.866 : effectiveD);
    const rotArea = rotW * rotD;
    const rotFill = rotArea > 0 ? cellAreaTotal / rotArea : 0;
    if (rotFill > fillRatio * 1.02) {
      rotationSuggestion = `${(rotFill * 100).toFixed(1)}% vs ${(fillRatio * 100).toFixed(1)}% — rotate 90° for better density`;
    }
  }

  // Overflow detection
  const overflowCells = 0; // Always fits since pack is computed from cells

  calculateStats(bW, bD, physHeight, S_Total, P, Layers, {
    fillRatio,
    theoMax,
    theoLabel,
    theoAlt,
    theoAltLabel,
    rotationSuggestion,
    cellAreaTotal,
    packArea,
    isHex,
  });

  // F7: Packing efficiency indicator
  const packingResult = checkPacking(fillRatio, theoMax);
  renderPackingIndicator(packingResult);

  const maxAmps = P * parseFloat(inputs['c-amp']?.value ?? '20');
  const slider = $('sim-load-slider') as HTMLInputElement | null;
  if (slider) slider.max = String(maxAmps * 1.5);
  rescaleLoadSlider();
  updateSimulation();

  // F13 — Render BMS bounding box
  renderBmsBox(bW, physHeight, bD);

  // F17 — Render BMS balance wire connections in 3D
  renderBmsWires(bW, physHeight, bD, S_Total);

  needsOcclusionUpdate = true;
}

/* ─── F13 — BMS Bounding Box Rendering & Interference Detection ─── */

export type BmsBoxFace = 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';

export interface BmsBoxResult {
  hasInterference: boolean;
  boxWorldMin: { x: number; y: number; z: number };
  boxWorldMax: { x: number; y: number; z: number };
}

function getSelectedBmsDimensions(): { w: number; d: number; h: number } | null {
  const sel = inputs['bms-selector'] as HTMLSelectElement | null;
  if (!sel) return null;
  const name = sel.value;
  if (name === 'auto' || name === 'none' || name === 'custom-add') return null;
  const allBms = getAllBms();
  const bms = allBms.find((b) => b.name === name);
  if (!bms) return null;
  return { w: bms.w, d: bms.d, h: bms.h };
}

function renderBmsBox(packW: number, packH: number, packD: number): BmsBoxResult {
  const result: BmsBoxResult = {
    hasInterference: false,
    boxWorldMin: { x: 0, y: 0, z: 0 },
    boxWorldMax: { x: 0, y: 0, z: 0 },
  };

  // Clean previous BMS box
  while (packState.bmsBoxGroup.children.length > 0) {
    const c: any = packState.bmsBoxGroup.children[0];
    if (c.geometry) c.geometry.dispose();
    packState.bmsBoxGroup.remove(c);
  }
  packState.bmsBoxGroup.rotation.set(0, 0, 0);

  const visible = (inputs['bms-box-visible'] as HTMLInputElement | null)?.checked ?? false;
  if (!visible) {
    updateBmsBoxInterferenceUI(result);
    return result;
  }

  // Get BMS dimensions from the selected BMS in section 5
  const bmsDims = getSelectedBmsDimensions();
  if (!bmsDims) {
    updateBmsBoxInterferenceUI(result);
    return result;
  }

  const face: BmsBoxFace = (inputs['bms-box-position'] as HTMLInputElement | null)?.value as BmsBoxFace || 'right';
  const rotation = parseInt(inputs['bms-box-rotation']?.value ?? '0') || 0;
  const offset = parseFloat(inputs['bms-box-offset']?.value ?? '5') || 0;

  // Effective dimensions after rotation (swaps w and d)
  const isRotated = rotation % 2 !== 0;
  const effW = isRotated ? bmsDims.d : bmsDims.w;
  const effD = isRotated ? bmsDims.w : bmsDims.d;
  const effH = bmsDims.h;

  // Pack half-extents (world space, pack centered at origin)
  const hx = packW / 2;
  const hy = packH / 2;
  const hz = packD / 2;

  let boxCenterX = 0, boxCenterY = 0, boxCenterZ = 0;
  let geoW = effW, geoH = effH, geoD = effD;

  switch (face) {
    case 'right': // +X face — base (effW×effD) faces cells, effH extends outward (+X)
      boxCenterX = hx + offset + effH / 2;
      boxCenterY = effD / 2;
      boxCenterZ = 0;
      geoW = effH; geoH = effD; geoD = effW;
      break;
    case 'left': // -X face — base (effW×effD) faces cells, effH extends outward (-X)
      boxCenterX = -(hx + offset + effH / 2);
      boxCenterY = effD / 2;
      boxCenterZ = 0;
      geoW = effH; geoH = effD; geoD = effW;
      break;
    case 'top': // +Y face — base (effW×effD) faces cells downward, effH extends upward
      boxCenterX = 0;
      boxCenterY = packH + offset + effH / 2;
      boxCenterZ = 0;
      break;
    case 'bottom': // -Y face — base (effW×effD) faces cells upward, effH extends downward
      boxCenterX = 0;
      boxCenterY = -(offset + effH / 2);
      boxCenterZ = 0;
      break;
    case 'front': // +Z face — base (effW×effD) faces cells, effH extends outward (+Z)
      boxCenterX = 0;
      boxCenterY = effD / 2;
      boxCenterZ = hz + offset + effH / 2;
      geoW = effW; geoH = effD; geoD = effH;
      break;
    case 'back': // -Z face — base (effW×effD) faces cells, effH extends outward (-Z)
      boxCenterX = 0;
      boxCenterY = effD / 2;
      boxCenterZ = -(hz + offset + effH / 2);
      geoW = effW; geoH = effD; geoD = effH;
      break;
  }

  // Create translucent box — geo dimensions match the world-space orientation
  const boxGeo = new THREE.BoxGeometry(geoW, geoH, geoD);
  const boxMesh = new THREE.Mesh(boxGeo, packState.bmsBoxMat.clone());
  boxMesh.position.set(boxCenterX, boxCenterY, boxCenterZ);
  packState.bmsBoxGroup.add(boxMesh);

  // Add wireframe edges
  const edgesGeo = new THREE.EdgesGeometry(boxGeo);
  const edgesLine = new THREE.LineSegments(edgesGeo, packState.bmsBoxEdgeMat.clone());
  edgesLine.position.copy(boxMesh.position);
  packState.bmsBoxGroup.add(edgesLine);

  // Calculate world-space AABB of the BMS box (using geo dimensions which match world orientation)
  const bMin = { x: boxCenterX - geoW / 2, y: boxCenterY - geoH / 2, z: boxCenterZ - geoD / 2 };
  const bMax = { x: boxCenterX + geoW / 2, y: boxCenterY + geoH / 2, z: boxCenterZ + geoD / 2 };
  result.boxWorldMin = bMin;
  result.boxWorldMax = bMax;

  // Interference detection: AABB overlap test
  const pb = packBounds3D;
  const intersects =
    bMin.x < pb.maxX && bMax.x > pb.minX &&
    bMin.y < pb.maxY && bMax.y > pb.minY &&
    bMin.z < pb.maxZ && bMax.z > pb.minZ;

  result.hasInterference = intersects;

  if (intersects) {
    boxMesh.material.dispose();
    boxMesh.material = packState.bmsBoxHitMat.clone();
    edgesLine.material.dispose();
    edgesLine.material = packState.bmsBoxHitEdgeMat.clone();
  }

  updateBmsBoxInterferenceUI(result);
  lastBmsBoxResult = result;
  return result;
}

function updateBmsBoxInterferenceUI(result: BmsBoxResult) {
  const el = $('bms-box-interference');
  const emoji = $('bms-box-interference-emoji');
  const text = $('bms-box-interference-text');

  if (!el) return;

  const visible = (inputs['bms-box-visible'] as HTMLInputElement | null)?.checked ?? false;
  if (!visible) {
    el.classList.add('hidden');
    return;
  }

  el.classList.remove('hidden');

  if (result.hasInterference) {
    el.className = 'rounded-md p-2 mt-1 border bg-red-50 border-red-300 text-red-700';
    if (emoji) emoji.textContent = '🔴';
    if (text) text.textContent = 'Interference detected — BMS box overlaps pack';
  } else {
    el.className = 'rounded-md p-2 mt-1 border bg-green-50 border-green-300 text-green-700';
    if (emoji) emoji.textContent = '🟢';
    if (text) text.textContent = 'No interference';
  }
}

export function getPackBounds3D() { return packBounds3D; }

/* ─── F17 — BMS Balance Wire Rendering (3D) ─── */

function renderBmsWires(packW: number, packH: number, packD: number, packS: number): void {
  // Clean previous wires
  while (packState.bmsWiresGroup.children.length > 0) {
    const c: any = packState.bmsWiresGroup.children[0];
    if (c.geometry) c.geometry.dispose();
    if (c.material && c.material !== packState.bmsWiresMat
      && c.material !== packState.bmsWireNegMat
      && c.material !== packState.bmsWirePosMat) {
      c.material.dispose();
    }
    packState.bmsWiresGroup.remove(c);
  }

  if (seriesPositions.length === 0) return;

  // Check BMS visibility and dimensions
  const bmsVisible = (inputs['bms-box-visible'] as HTMLInputElement | null)?.checked ?? false;
  if (!bmsVisible) return;

  const bmsDims = getSelectedBmsDimensions();
  if (!bmsDims) return;

  const bmsBox = lastBmsBoxResult;
  // Skip if BMS box has no valid dimensions (all zeros = not rendered)
  const hasValidBox =
    bmsBox.boxWorldMin.x !== 0 || bmsBox.boxWorldMax.x !== 0 ||
    bmsBox.boxWorldMin.y !== 0 || bmsBox.boxWorldMax.y !== 0;
  if (!hasValidBox) return;

  const bmsCX = (bmsBox.boxWorldMin.x + bmsBox.boxWorldMax.x) / 2;
  const bmsCY = (bmsBox.boxWorldMin.y + bmsBox.boxWorldMax.y) / 2;
  const bmsCZ = (bmsBox.boxWorldMin.z + bmsBox.boxWorldMax.z) / 2;

  const face: BmsBoxFace = (inputs['bms-box-position'] as HTMLInputElement | null)?.value as BmsBoxFace || 'right';

  const packTopY = packH;
  const clearance = 3;
  const routeY = packTopY + clearance;

  // BMS box extents for spreading wire endpoints along the face
  const bmsW = bmsBox.boxWorldMax.x - bmsBox.boxWorldMin.x;
  const bmsD = bmsBox.boxWorldMax.z - bmsBox.boxWorldMin.z;

  // Compute S+1 tap positions at busbar junctions between series groups.
  // Index 0 = B− (pack left edge), index S = B+ (pack right edge),
  // indices 1..S-1 = midpoints between adjacent series centers.
  const tapPositions: { x: number; z: number }[] = [];
  const S = seriesPositions.length;

  // B−: pack left edge, Z from first series
  tapPositions.push({ x: packBounds3D.minX, z: seriesPositions[0].z });

  // Intermediate busbar junctions (S-1 points)
  for (let i = 0; i < S - 1; i++) {
    const midX = (seriesPositions[i].x + seriesPositions[i + 1].x) / 2;
    const midZ = (seriesPositions[i].z + seriesPositions[i + 1].z) / 2;
    tapPositions.push({ x: midX, z: midZ });
  }

  // B+: pack right edge, Z from last series
  tapPositions.push({ x: packBounds3D.maxX, z: seriesPositions[S - 1].z });

  for (let i = 0; i < tapPositions.length; i++) {
    const tap = tapPositions[i];
    const isNeg = i === 0;
    const isPos = i === tapPositions.length - 1;

    // Color: B− = red, B+ = green, intermediate = blue gradient
    let color: number;
    if (isNeg) color = 0xef4444;
    else if (isPos) color = 0x22c55e;
    else {
      const t = tapPositions.length > 2 ? (i - 1) / (tapPositions.length - 2) : 0.5;
      const r = 96;
      const g = Math.round(165 + t * 40);
      const b = Math.round(250 - t * 50);
      color = (r << 16) | (g << 8) | b;
    }

    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });

    const tapX = tap.x;
    const tapZ = tap.z;

    // Spread wire endpoints along the BMS face (not all converge to center)
    const spread = tapPositions.length > 1 ? (i / (tapPositions.length - 1) - 0.5) : 0;
    let endX = bmsCX, endY = bmsCY, endZ = bmsCZ;

    switch (face) {
      case 'right':
      case 'left':
        endZ = bmsCZ + spread * bmsD * 0.8;
        break;
      case 'front':
      case 'back':
        endX = bmsCX + spread * bmsW * 0.8;
        break;
      case 'top':
      case 'bottom':
        endX = bmsCX + spread * bmsW * 0.5;
        break;
    }

    // Route from pack top surface to BMS, adapting to face position
    let points: THREE.Vector3[];

    switch (face) {
      case 'right':
      case 'left':
        // Tap → lift → route along X to BMS → spread along Z → drop to BMS
        points = [
          new THREE.Vector3(tapX, packTopY, tapZ),
          new THREE.Vector3(tapX, routeY, tapZ),
          new THREE.Vector3(bmsCX, routeY, tapZ),
          new THREE.Vector3(endX, routeY, endZ),
          new THREE.Vector3(endX, endY, endZ),
        ];
        break;
      case 'front':
      case 'back':
        // Tap → lift → route along Z to BMS → spread along X → drop to BMS
        points = [
          new THREE.Vector3(tapX, packTopY, tapZ),
          new THREE.Vector3(tapX, routeY, tapZ),
          new THREE.Vector3(tapX, routeY, bmsCZ),
          new THREE.Vector3(endX, routeY, endZ),
          new THREE.Vector3(endX, endY, endZ),
        ];
        break;
      case 'top':
      case 'bottom':
        // Tap → lift → route directly to BMS
        points = [
          new THREE.Vector3(tapX, packTopY, tapZ),
          new THREE.Vector3(tapX, routeY, tapZ),
          new THREE.Vector3(endX, routeY, endZ),
          new THREE.Vector3(endX, endY, endZ),
        ];
        break;
      default:
        points = [
          new THREE.Vector3(tapX, packTopY, tapZ),
          new THREE.Vector3(tapX, routeY, tapZ),
          new THREE.Vector3(bmsCX, routeY, tapZ),
          new THREE.Vector3(endX, routeY, endZ),
          new THREE.Vector3(endX, endY, endZ),
        ];
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, mat);
    packState.bmsWiresGroup.add(line);

    // Small sphere at the tap point (on pack top surface)
    const tapGeo = new THREE.SphereGeometry(1.2, 8, 8);
    const tapMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
    const tapSphere = new THREE.Mesh(tapGeo, tapMat);
    tapSphere.position.set(tapX, packTopY, tapZ);
    packState.bmsWiresGroup.add(tapSphere);

    // Labels for B− and B+
    if (isNeg) {
      addLabel('B−', tapX, routeY + 5, tapZ, '#ef4444');
    } else if (isPos) {
      addLabel(`B+ (S${packS})`, tapX, routeY + 5, tapZ, '#22c55e');
    }
  }

  // BMS label
  if (seriesPositions.length > 0) {
    addLabel('BMS', bmsCX, bmsCY + 5, bmsCZ, '#16a34a');
  }
}

let lastBmsBoxResult: BmsBoxResult = {
  hasInterference: false,
  boxWorldMin: { x: 0, y: 0, z: 0 }, boxWorldMax: { x: 0, y: 0, z: 0 },
};

/* ─── F18 — Camera Presets ─── */

export type CameraPreset = 'front' | 'side' | 'top' | 'iso' | 'free';

export function setCameraPreset(preset: CameraPreset) {
  const cam = packState.camera;
  const ctrl = packState.controls;
  const pb = packBounds3D;
  const cx = (pb.minX + pb.maxX) / 2;
  const cy = (pb.minY + pb.maxY) / 2;
  const cz = (pb.minZ + pb.maxZ) / 2;
  const center = new THREE.Vector3(cx, cy, cz);
  const maxDim = Math.max(pb.maxX - pb.minX, pb.maxY - pb.minY, pb.maxZ - pb.minZ);
  const dist = maxDim * 1.8;

  let target = new THREE.Vector3();
  switch (preset) {
    case 'front': target.set(cx, cy, cz + dist); break;
    case 'side':  target.set(cx + dist, cy, cz); break;
    case 'top':   target.set(cx, cy + dist, cz + 0.01); break;
    case 'iso':   target.set(cx + dist * 0.577, cy + dist * 0.577, cz + dist * 0.577); break;
    case 'free':  target.set(200, 200, 250); break;
  }
  cam.position.copy(target);
  ctrl.target.copy(center);
  ctrl.update();
  needsOcclusionUpdate = true;
}

export function zoomToFit() {
  const cam = packState.camera;
  const ctrl = packState.controls;
  const pb = packBounds3D;
  const cx = (pb.minX + pb.maxX) / 2;
  const cy = (pb.minY + pb.maxY) / 2;
  const cz = (pb.minZ + pb.maxZ) / 2;
  const center = new THREE.Vector3(cx, cy, cz);
  const maxDim = Math.max(pb.maxX - pb.minX, pb.maxY - pb.minY, pb.maxZ - pb.minZ);
  const fov = cam.fov * (Math.PI / 180);
  const dist = (maxDim / 2) / Math.tan(fov / 2) * 1.5;
  const dir = cam.position.clone().sub(ctrl.target).normalize();
  cam.position.copy(center).addScaledVector(dir, dist);
  ctrl.target.copy(center);
  ctrl.update();
  needsOcclusionUpdate = true;
}

/* ─── F18 — Wireframe Toggle ─── */

export function toggleWireframe(on: boolean) {
  isWireframe = on;
  packState.packGroup.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => { (m as THREE.MeshStandardMaterial).wireframe = on; });
      } else if (mesh.material) {
        (mesh.material as THREE.MeshStandardMaterial).wireframe = on;
      }
    }
  });
}

/* ─── F18 — Hover Highlights ─── */

export function setupHoverDetection(container: HTMLElement) {
  const tooltip = document.getElementById('f18-tooltip');
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  container.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, packState.camera);
    const meshes: THREE.Mesh[] = [];
    packState.packGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.InstancedMesh).isInstancedMesh) {
        meshes.push(child as THREE.Mesh);
      }
    });
    const intersects = raycaster.intersectObjects(meshes, false);

    // Restore previously hovered
    if (hoveredMesh && highlightedOriginalColor) {
      if (Array.isArray(hoveredMesh.material)) {
        (hoveredMesh.material[0] as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
      } else {
        (hoveredMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
      }
      hoveredMesh = null;
      highlightedOriginalColor = null;
    }

    if (intersects.length > 0) {
      const hit = intersects[0];
      const mesh = hit.object as THREE.Mesh;
      hoveredMesh = mesh;
      highlightedOriginalColor = new THREE.Color();

      if (Array.isArray(mesh.material)) {
        highlightedOriginalColor.copy((mesh.material[0] as THREE.MeshStandardMaterial).emissive);
        (mesh.material[0] as THREE.MeshStandardMaterial).emissive.set(HIGHLIGHT_COLOR);
      } else {
        highlightedOriginalColor.copy((mesh.material as THREE.MeshStandardMaterial).emissive);
        (mesh.material as THREE.MeshStandardMaterial).emissive.set(HIGHLIGHT_COLOR);
      }

      if (tooltip) {
        const name = (mesh as any).name || 'Unknown';
        let info = '';
        const s = currentStats;
        if (name === 'cells' || name === 'caps') {
          const cellType = (inputs['cell-type'] as HTMLInputElement | null)?.value ?? 'cylindrical';
          const d = parseFloat(inputs['c-diam']?.value ?? '18');
          const l = parseFloat(inputs['c-len']?.value ?? '65');
          const v = parseFloat(inputs['c-volts']?.value ?? '3.6');
          info = `<b>${name === 'cells' ? 'Cell Body' : 'Cell Cap'}</b><br>` +
            `Type: ${cellType}<br>Dimensions: ${d.toFixed(1)} × ${l.toFixed(1)} mm<br>` +
            `Voltage: ${v.toFixed(2)}V<br>Cells: ${s.cells ?? 0}`;
        } else if (name === 'busbars') {
          const mat = (inputs['sim-strip-mat'] as HTMLSelectElement | null)?.value ?? '7';
          const matName = parseFloat(mat) <= 1.8 ? 'Copper' : parseFloat(mat) <= 2.5 ? 'Nickel-Plated' : parseFloat(mat) >= 13 ? 'Steel' : 'Nickel';
          info = `<b>Busbars</b><br>Material: ${matName}<br>Config: ${s.s ?? 0}S × ${s.p ?? 1}P`;
        } else if (name === 'spacers') {
          info = `<b>Spacers</b><br>Insulating垫片<br>Pack: ${s.s ?? 0}S × ${s.p ?? 1}P`;
        } else {
          info = `<b>${name}</b>`;
        }
        tooltip.innerHTML = info;
        tooltip.style.display = 'block';
        tooltip.style.left = `${e.clientX - rect.left + 12}px`;
        tooltip.style.top = `${e.clientY - rect.top - 10}px`;
      }
    } else {
      if (tooltip) tooltip.style.display = 'none';
    }
  });

  container.addEventListener('mouseleave', () => {
    if (hoveredMesh && highlightedOriginalColor) {
      if (Array.isArray(hoveredMesh.material)) {
        (hoveredMesh.material[0] as THREE.MeshStandardMaterial).emissive.copy(highlightedOriginalColor);
      } else {
        (hoveredMesh.material as THREE.MeshStandardMaterial).emissive.copy(highlightedOriginalColor);
      }
      hoveredMesh = null;
      highlightedOriginalColor = null;
    }
    if (tooltip) tooltip.style.display = 'none';
  });
}

/* ─── F18 — Screenshot ─── */

export function takeScreenshot() {
  const renderer = packState.renderer;
  const scene = packState.scene;
  const camera = packState.camera;

  const prevBg = scene.background;
  scene.background = null;
  renderer.render(scene, camera);

  const link = document.createElement('a');
  link.download = `bca-pack-${Date.now()}.png`;
  link.href = renderer.domElement.toDataURL('image/png');
  link.click();

  scene.background = prevBg;
  needsOcclusionUpdate = true;
}

export function animate(_time: number) {
  requestAnimationFrame(animate);
  packState.controls.update();
  packState.renderer.render(packState.scene, packState.camera);

  if (needsOcclusionUpdate && currentStats.cells <= 500) {
    needsOcclusionUpdate = false;
    for (const label of packState.labels) {
      label.getWorldPosition(packState.v3);
      packState.vDir.copy(packState.v3).sub(packState.camera.position);
      const dist = packState.vDir.length();
      packState.vDir.normalize();
      packState.raycaster.set(packState.camera.position, packState.vDir);
      packState.raycaster.ray.origin.add(packState.vDir.clone().multiplyScalar(0.5));
      const intersects = packState.raycaster.intersectObjects(packState.occluders as any, false);
      if (intersects.length > 0) {
        if (intersects[0].distance < dist - 2.0) label.element.classList.add('occluded');
        else label.element.classList.remove('occluded');
      } else {
        label.element.classList.remove('occluded');
      }
    }
  } else if (currentStats.cells > 500) {
    if (packState.labels.length > 0 && packState.labels[0].element.classList.contains('occluded')) {
      packState.labels.forEach((l) => l.element.classList.remove('occluded'));
    }
  }
  packState.labelRenderer.render(packState.scene, packState.camera);
}
