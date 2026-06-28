# Fix Plan — Battery Pack Architect

Plan de corrección generado desde auditoría completa del código.
Cada paso es atómico, independiente, y puede delegarse a un sub-agente.

---

## Fase 1 — Bugs Críticos (Safety-Critical)

### ✅ FIX-01: Barley paper missing in inter-layer Y calculation
- **File**: `src/scripts/pack-builder.ts`
- **Line**: 784
- **Bug**: `prevBaseY` omite `barleyThickness`
- **Current**: `const prevBaseY = (ly - 1) * (l + physLayerSpace + visualLayerSpace);`
- **Fix**: `const prevBaseY = (ly - 1) * (l + physLayerSpace + barleyThickness + visualLayerSpace);`
- **Verify**: Enable barley paper + 2+ layers → inter-layer wires align correctly

### ✅ FIX-02: BMS wiring hardcodes 3.6V instead of using cellNom
- **File**: `src/scripts/power-connector-engine.ts`
- **Line**: 342
- **Bug**: `packS * 3.6` always uses 3.6V
- **Current**: `const mainCable = recommendCableGauge(mainCurrent, 30, packS * 3.6, 3);`
- **Fix**: Pass `cellNom` as parameter to `generateBmsWiring()`, use it: `packS * cellNom`
- **Steps**:
  1. Add `cellNom: number` parameter to `generateBmsWiring()` signature
  2. Update call site in `ui.ts:1984` to pass `cellNom`
  3. Replace `packS * 3.6` with `packS * cellNom`
- **Verify**: Select LFP (3.2V) → BMS cable gauge changes vs NMC (3.6V)

### ✅ FIX-03: parseInt/parseFloat with empty string produces NaN
- **Files**: `src/scripts/simulation.ts`, `src/scripts/pack-builder.ts`
- **Lines**: simulation.ts:125-131, pack-builder.ts:456-459
- **Bug**: `parseInt('')` → NaN, `??` only handles null/undefined
- **Fix**: Add fallback coercion after parse:
  ```typescript
  const S = parseInt(inputs['s-count']?.value ?? '1') || 1;
  const P = parseInt(inputs['p-count']?.value ?? '1') || 1;
  ```
- **Apply to ALL parseInt/parseFloat calls in both files that use `??` default**
- **Verify**: Clear an input field → no NaN in stats panel

### ✅ FIX-04: Diagnostic panel reads levels via CSS color strings
- **File**: `src/scripts/diagnostic.ts`
- **Lines**: 121-128
- **Bug**: `readLevel()` parses `borderColor` hex strings — fragile
- **Fix**: Read `el.dataset.level` instead (already set by `setSafetyEl` in safety-indicators.ts:272)
  ```typescript
  function readLevel(el: HTMLElement | null): SafetyLevel {
    if (!el) return 'neutral';
    return (el.dataset.level as SafetyLevel) || 'neutral';
  }
  ```
- **Verify**: Change CSS colors → diagnostic panel still works

### ✅ FIX-05: Charge rate hardcoded to 5C regardless of chemistry
- **File**: `src/scripts/simulation.ts`
- **Line**: 77
- **Bug**: `const chargeMaxA = packAh * 5.0;`
- **Fix**: Map chemistry to max charge rate:
  ```typescript
  const cellNom = parseFloat(inputs['c-volts']?.value ?? '3.6');
  let maxChargeC = 1.0; // default NMC
  if (cellNom >= 3.15 && cellNom <= 3.45) maxChargeC = 2.0;      // LFP
  else if (cellNom >= 2.0 && cellNom <= 2.8) maxChargeC = 3.0;   // LTO
  else if (cellNom >= 2.9 && cellNom <= 3.1) maxChargeC = 0.5;   // Na-Ion
  const chargeMaxA = packAh * maxChargeC;
  ```
- **Verify**: Select LFP → charge slider max changes to 2C

---

## Fase 2 — Bugs Menores

### ✅ FIX-06: LVC Pack sync doesn't trigger updatePack
- **File**: `src/scripts/ui.ts`
- **Lines**: 1019-1028
- **Bug**: LVC Pack input handler calls `updateSimulation()` but not `updatePack()`
- **Fix**: Add `updatePack()` call after LVC sync in both handlers
- **Verify**: Change LVC Pack → BMS validation panel updates

### ✅ FIX-07: cNom/cAh change handlers don't trigger updatePack
- **File**: `src/scripts/electrical-engine.ts`
- **Lines**: 60-67
- **Bug**: `cNom` and `cAh` change events only recalculate S/V or P/Ah
- **Fix**: Import and call `updatePack()` after recalculating
- **Steps**:
  1. Import `updatePack` from `./pack-builder`
  2. After `vToS`/`sToV` or `ahToP`/`pToAh`, call `updatePack()`
- **Verify**: Change cell voltage → 3D view and all stats update

### FIX-08: Dead code — slider.max overwritten immediately
- **File**: `src/scripts/pack-builder.ts`
- **Lines**: 943-944
- **Bug**: `slider.max = String(maxAmps * 1.5)` immediately overwritten by `rescaleLoadSlider()`
- **Fix**: Remove line 943 (`slider.max = String(maxAmps * 1.5)`)
- **Verify**: Slider still works correctly after removal

### FIX-09: Unused variable overflowCells
- **File**: `src/scripts/pack-builder.ts`
- **Line**: 923
- **Bug**: `const overflowCells = 0;` declared but never used
- **Fix**: Delete the line
- **Verify**: No compile errors

---

## Fase 3 — Rendimiento

### ✅ FIX-10: Memory leak — undisposed geometries in updatePack cleanup
- **File**: `src/scripts/pack-builder.ts`
- **Lines**: 436-449
- **Bug**: Cleanup loop doesn't dispose all geometry types (TubeGeometry, inline BufferGeometry)
- **Fix**: Add recursive dispose for all children:
  ```typescript
  packState.packGroup.traverse((child) => {
    if ((child as any).geometry) (child as any).geometry.dispose();
    if ((child as any).material) {
      const mat = (child as any).material;
      if (Array.isArray(mat)) mat.forEach((m: any) => m.dispose());
      else mat.dispose();
    }
  });
  ```
  Then clear children.
- **Verify**: Open dev tools memory tab → no growing detached meshes after 20 updatePack() calls

### ✅ FIX-11: Double simulation update on some inputs
- **File**: `src/scripts/ui.ts`
- **Lines**: 889-898
- **Bug**: Some inputs trigger both `debouncedUpdate()` (→ updatePack → updateSimulation) AND direct `updateSimulation()`
- **Fix**: In the `input` event handler, remove the direct `updateSimulation(e)` call for `sim-load-slider` and `sim-cell-ir` — let `updatePack()` handle it. OR: skip `updatePack()` for simulation-only inputs.
- **Verify**: Move simulation slider → only one recalculation per frame

### ✅ FIX-12: Raycast occlusion runs every frame for all labels
- **File**: `src/scripts/pack-builder.ts`
- **Lines**: 1487-1508
- **Bug**: `animate()` runs raycasting for every label on every frame when `needsOcclusionUpdate` is true
- **Fix**: Throttle occlusion updates to max once per 100ms:
  ```typescript
  let lastOcclusionTime = 0;
  // In animate():
  const now = performance.now();
  if (needsOcclusionUpdate && currentStats.cells <= 500 && now - lastOcclusionTime > 100) {
    lastOcclusionTime = now;
    needsOcclusionUpdate = false;
    // ... existing raycast logic
  }
  ```
- **Verify**: Orbit camera smoothly with many labels

---

## Fase 4 — Valores Hardcoded → Dinámicos

### ✅ FIX-13: Charge rate per chemistry (related to FIX-05)
- **File**: `src/scripts/simulation.ts`
- **Already covered in FIX-05**

### ✅ FIX-14: Ambient temperature as input
- **Files**: `src/scripts/diagnostic.ts`, `src/scripts/safety-indicators.ts`
- **Current**: `T_AMB = 25` hardcoded in both files
- **Fix**:
  1. Add input element `sim-tamb` to sidebar (or reuse existing if present)
  2. Read from input in `checkJouleHeat()` and `checkStripThermal()`
  3. Default to 25 if not set
- **Verify**: Change ambient temp → thermal indicators update

### ✅ FIX-15: BOM waste factor configurable
- **File**: `src/scripts/pack-builder.ts`
- **Lines**: 162-163
- **Current**: `WASTE_FACTOR_PCT = 0.15` hardcoded
- **Fix**:
  1. Add input element `bom-waste-pct` to BOM section or Pack Config
  2. Read value in `getBomData()`, default to 15
  3. Update CSV/JSON export to include the custom value
- **Verify**: Change waste factor → BOM total recalculates

### FIX-16: Thermal resistance from cell database
- **File**: `src/scripts/diagnostic.ts`
- **Line**: 24
- **Current**: `DEFAULT_R_TH = 7` hardcoded
- **Fix**:
  1. Add optional `rTh` field to `Cell` interface in `cell-database.ts`
  2. Populate for known cells (e.g., 21700 ~5-8 K/W, 18650 ~8-12 K/W)
  3. In `checkJouleHeat()`, read from current cell data if available
- **Verify**: Select different cells → thermal estimation changes

---

## Fase 5 — Type Safety

### FIX-17: Type user presets properly
- **File**: `src/scripts/pack-builder.ts`
- **Lines**: 11-12
- **Current**: `let userSizePresets: any[]`
- **Fix**: `let userSizePresets: SizePreset[]` (import SizePreset from presets.ts)
- **Apply to**: `userChemPresets` as well
- **Verify**: TypeScript compiles without errors

### FIX-18: Type currentStats properly
- **File**: `src/scripts/pack-builder.ts`
- **Line**: 18
- **Current**: `let currentStats: any = {}`
- **Fix**: Create and use a `PackStats` interface:
  ```typescript
  interface PackStats {
    name: string; s: number; p: number; l: number; cells: number;
    v: number; ah: number; wh: number; w: number; d: number; h: number;
    vol: number; kg: number; cost: number; kw: number; amp: number;
    vmin: number; vmax: number; nickel: number;
    fillRatio: number; theoMax: number;
  }
  let currentStats: Partial<PackStats> = {};
  ```
- **Verify**: TypeScript compiles, all `currentStats.*` accesses are safe

### FIX-19: Remove unnecessary `as any` casts on Three.js names
- **File**: `src/scripts/pack-builder.ts`
- **Lines**: 593-606
- **Current**: `(meshCells as any).name = 'cells'`
- **Fix**: Three.js `Object3D` has `.name` natively. Just use: `meshCells.name = 'cells'`
- **Verify**: TypeScript compiles

---

## Fase 6 — Edge Cases

### FIX-20: Guard all parseFloat/parseInt against NaN
- **Files**: ALL scripts
- **Pattern**: Replace `parseFloat(x ?? 'default')` with `parseFloat(x ?? 'default') || defaultValue`
- **Files to audit**:
  - `simulation.ts` — lines 69-73, 125-132, 135, 151-155
  - `pack-builder.ts` — lines 417-422, 456-459, 468-471
  - `safety-indicators.ts` — lines 49-50, 86-87, 136-146
  - `power-connector-engine.ts` — line 342
  - `ui.ts` — lines 427-433, 630-635, 1911-1915
- **Verify**: Clear every input field one by one → no NaN anywhere in UI

### FIX-21: Anti-loop timer too short
- **File**: `src/scripts/electrical-engine.ts`
- **Line**: 16
- **Current**: `150` ms
- **Fix**: Increase to `300` ms
- **Verify**: Type fast in bidirectional fields → no flickering

---

## Execution Order

```
Fase 1 (Críticos):     FIX-01 → FIX-02 → FIX-03 → FIX-04 → FIX-05
Fase 2 (Menores):      FIX-06 → FIX-07 → FIX-08 → FIX-09
Fase 3 (Rendimiento):  FIX-10 → FIX-11 → FIX-12
Fase 4 (Hardcoded):    FIX-13(skip) → FIX-14 → FIX-15 → FIX-16
Fase 5 (Types):        FIX-17 → FIX-18 → FIX-19
Fase 6 (Edge Cases):   FIX-20 → FIX-21
```

**Total: 21 fixes, 6 fases**

Cada FIX puede ejecutarse como tarea independiente de un agente multi-agente.
FIX-13 está marcado como skip porque ya se cubre en FIX-05.
