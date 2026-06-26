import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { inputs, $ } from './dom';

export function exportSTL(
  packGroup: THREE.Group,
  includeCells: boolean,
  includeSpacers: boolean,
  includeBusbars: boolean
): void {
  const exportGroup = new THREE.Group();
  const tempMatrix = new THREE.Matrix4();
  const finalMatrix = new THREE.Matrix4();
  const correctionMatrix = new THREE.Matrix4().makeRotationX(Math.PI / 2);

  if (packGroup.children.length > 0) document.body.style.cursor = 'wait';

  function addBakedInstance(mesh: THREE.InstancedMesh) {
    const count = mesh.count;
    const originalGeom = mesh.geometry;
    const world = mesh.matrixWorld;
    for (let i = 0; i < count; i++) {
      mesh.getMatrixAt(i, tempMatrix);
      finalMatrix.multiplyMatrices(world, tempMatrix);
      finalMatrix.premultiply(correctionMatrix);
      const bakedGeom = originalGeom.clone();
      bakedGeom.applyMatrix4(finalMatrix);
      exportGroup.add(new THREE.Mesh(bakedGeom, new THREE.MeshBasicMaterial()));
    }
  }

  packGroup.parent?.updateMatrixWorld(true);
  packGroup.children.forEach((child) => {
    const inst = child as THREE.InstancedMesh;
    if (!inst.isInstancedMesh) return;
    const keep =
      ((inst.name === 'cells' || inst.name === 'caps') && includeCells) ||
      (inst.name === 'spacers' && includeSpacers) ||
      (inst.name === 'busbars' && includeBusbars);
    if (keep) addBakedInstance(inst);
  });

  document.body.style.cursor = 'default';
  if (exportGroup.children.length === 0) { alert('Nothing selected to export!'); return; }

  try {
    const exporter = new STLExporter();
    const result = exporter.parse(exportGroup, { binary: true }) as unknown as ArrayBuffer;
    const blob = new Blob([result], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    const packName = ((inputs['pack-name'] as HTMLInputElement | null)?.value || 'battery_pack').replace(/[^a-z0-9]/gi, '_');
    const s = ($('s-count') as HTMLInputElement | null)?.value ?? '0';
    const p = ($('p-count') as HTMLInputElement | null)?.value ?? '0';
    link.href = URL.createObjectURL(blob);
    link.download = `${packName}_${s}S${p}P_${Date.now()}.stl`;
    link.click();
  } catch (e) {
    console.error(e);
    alert('Export failed. See console for details.');
  } finally {
    exportGroup.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        const mat = m.material as THREE.Material | THREE.Material[];
        Array.isArray(mat) ? mat.forEach((x) => x.dispose()) : mat.dispose();
      }
    });
    exportGroup.clear();
  }
}
