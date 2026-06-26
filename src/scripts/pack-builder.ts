import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CELL_DB } from './cell-database';
import { DEFAULT_SIZE_PRESETS, DEFAULT_CHEM_PRESETS } from './presets';
import { inputs, $ } from './dom';
import { getOpenCircuitVoltage, rescaleLoadSlider, updateSimulation, renderCurrentStats } from './simulation';

let userSizePresets: any[] = JSON.parse(localStorage.getItem('batt_vis_presets_size_v40') || '[]');
let userChemPresets: any[] = JSON.parse(localStorage.getItem('batt_vis_presets_chem_v40') || '[]');

let currentStats: any = {};
let currentNickelLen = 0;
let userHasTouchedBusMode = false;
let lastUserBusMode = 'both';
let userHasTouchedBusColor = false;
let perfToastTimer: number | null = null;
let needsOcclusionUpdate = true;

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
  cellMat: new THREE.MeshStandardMaterial({ roughness: 0.4 }),
  capMat: new THREE.MeshStandardMaterial({ roughness: 0.4 }),
  busMat: new THREE.MeshStandardMaterial({ roughness: 0.4 }),
  spacerMat: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
  interConnMat: new THREE.MeshStandardMaterial({ roughness: 0.4 }),
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

  packState.scene = scene;
  packState.camera = camera;
  packState.renderer = renderer;
  packState.labelRenderer = labelRenderer;
  packState.controls = controls;
  packState.packGroup = packGroup;
  packState.dimGroup = dimGroup;

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

export function calculateStats(w: number, dep: number, h: number, S_Total: number, P: number, L: number) {
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

  renderCurrentStats();

  setCurrentStats({
    name: inputs['pack-name']?.value ?? '',
    s: S_Total, p: P, l: L, cells: totalCells,
    v: packV, ah: packAh, wh: packWh,
    w, d: dep, h, vol: packVol,
    kg: packKg, cost: packCost, kw: maxKw,
    amp: maxAmps, vmin: packVMin, vmax: packVMax,
    nickel: nickelMeters,
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
  const nomV = parseFloat(inputs['c-volts']?.value ?? '3.6');
  const busMode = (inputs['bus-mode'] as unknown as HTMLSelectElement | null)?.value ?? 'both';
  const showGeo = busMode !== 'none';
  const physLayerSpace = parseFloat(inputs['layer-spacing']?.value ?? '0') || 0;
  const visualLayerSpace = (inputs['exploded-view'] as HTMLInputElement | null)?.checked ? 40 : 0;
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
    if (matRho <= 2.0) busColor = '#b87333';
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

  for (let ly = 0; ly < Layers; ly++) {
    const layerYBase = ly * (l + physLayerSpace + visualLayerSpace);
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
        const prevBaseY = (ly - 1) * (l + physLayerSpace + visualLayerSpace);
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
  const physHeight = (l * Layers) + (physLayerSpace * (Layers - 1));
  const renderHeight = (l * Layers) + ((physLayerSpace + visualLayerSpace) * (Layers - 1));
  const cX = (minX + maxX) / 2; const cZ = (minZ + maxZ) / 2;

  // Store pack bounds for F13 BMS interference detection
  lastPackBounds = { minX, maxX, minZ, maxZ, height: physHeight };
  packState.packGroup.position.set(-cX, 0, -cZ);
  addDimensions(bW, renderHeight, bD, cX, cZ, physHeight);
  calculateStats(bW, bD, physHeight, S_Total, P, Layers);

  const maxAmps = P * parseFloat(inputs['c-amp']?.value ?? '20');
  const slider = $('sim-load-slider') as HTMLInputElement | null;
  if (slider) slider.max = String(maxAmps * 1.5);
  rescaleLoadSlider();
  updateSimulation();
  needsOcclusionUpdate = true;
}

/* ─────────────────────────────────────────────
   F13 — BMS Bounding Box 3D
   ───────────────────────────────────────────── */

let bmsBoxMesh: THREE.Mesh | null = null;
let bmsWireframe: THREE.LineSegments | null = null;
let bmsLabelObj: CSS2DObject | null = null;

export interface BmsBoxData {
  w: number; d: number; h: number;
  offsetX: number; offsetY: number; offsetZ: number;
  name: string;
}

let lastPackBounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, height: 0 };

export function getPackBounds() { return lastPackBounds; }

export function renderBmsBox(data: BmsBoxData | null) {
  if (bmsBoxMesh) { packState.packGroup.remove(bmsBoxMesh); bmsBoxMesh.geometry.dispose(); bmsBoxMesh = null; }
  if (bmsWireframe) { packState.packGroup.remove(bmsWireframe); bmsWireframe.geometry.dispose(); bmsWireframe = null; }
  if (bmsLabelObj) {
    if (bmsLabelObj.parent) bmsLabelObj.parent.remove(bmsLabelObj);
    if (bmsLabelObj.element?.parentNode) bmsLabelObj.element.parentNode.removeChild(bmsLabelObj.element);
    bmsLabelObj = null;
  }

  const interferenceEl = document.getElementById('bms-interference');
  if (!data) { interferenceEl?.classList.add('hidden'); return; }

  const pb = lastPackBounds;
  const bmsX = pb.maxX + data.w / 2 + 10 + data.offsetX;
  const bmsY = data.h / 2 + data.offsetY;
  const bmsZ = (pb.minZ + pb.maxZ) / 2 + data.offsetZ;

  const geo = new THREE.BoxGeometry(data.w, data.h, data.d);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6, transparent: true, opacity: 0.25, roughness: 0.5,
    side: THREE.DoubleSide, depthWrite: false,
  });
  bmsBoxMesh = new THREE.Mesh(geo, mat);
  bmsBoxMesh.position.set(bmsX, bmsY, bmsZ);
  packState.packGroup.add(bmsBoxMesh);

  const edges = new THREE.EdgesGeometry(geo);
  bmsWireframe = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x3b82f6, opacity: 0.6, transparent: true }));
  bmsWireframe.position.copy(bmsBoxMesh.position);
  packState.packGroup.add(bmsWireframe);

  const div = document.createElement('div');
  div.className = 'label-tag';
  div.style.color = '#3b82f6';
  div.style.borderColor = '#3b82f6';
  div.innerHTML = `BMS ${data.w}×${data.d}×${data.h}mm`;
  bmsLabelObj = new CSS2DObject(div);
  bmsLabelObj.position.set(bmsX, bmsY + data.h / 2 + 5, bmsZ);
  packState.packGroup.add(bmsLabelObj);
  packState.labels.push(bmsLabelObj);

  // Interference detection
  const bmsMinX = bmsX - data.w / 2;
  const bmsMaxX = bmsX + data.w / 2;
  const bmsMinZ = bmsZ - data.d / 2;
  const bmsMaxZ = bmsZ + data.d / 2;
  const bmsMinY = bmsY - data.h / 2;
  const bmsMaxY = bmsY + data.h / 2;

  const overlapsX = bmsMaxX > pb.minX && bmsMinX < pb.maxX;
  const overlapsZ = bmsMaxZ > pb.minZ && bmsMinZ < pb.maxZ;
  const overlapsY = bmsMaxY > 0 && bmsMinY < pb.height;
  const interferes = overlapsX && overlapsZ && overlapsY;

  if (interferes) {
    mat.color.set(0xef4444);
    mat.opacity = 0.35;
    if (bmsWireframe) (bmsWireframe.material as THREE.LineBasicMaterial).color.set(0xef4444);
    interferenceEl?.classList.remove('hidden');
    const txt = document.getElementById('bms-interference-text');
    if (txt) txt.textContent = 'BMS box intersects pack — adjust offset';
  } else {
    interferenceEl?.classList.add('hidden');
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('bca:bms-update', ((e: CustomEvent) => {
    renderBmsBox(e.detail);
  }) as EventListener);
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
