<p align="center">
  <img src="https://iili.io/C1OawHx.png" alt="BCA Tool — Battery Configuration & Analysis" width="100%">
</p>

# BCA Tool — Battery Configuration & Analysis

Herramienta web para diseño, simulación y export de packs de baterías lithium. Stack: **Astro 7.7 + React 19 + Three.js 0.184 + Tailwind 4**, desplegado en Cloudflare Workers.

## Comandos

```sh
pnpm install       # Instalar dependencias
pnpm dev           # Dev server en localhost:4321
pnpm build         # Build de producción → ./dist/
pnpm preview       # Preview local del build
```

## Estructura del proyecto

```text
src/
├── scripts/                # Lógica core (sin framework)
│   ├── pack-builder.ts     # Motor 3D — escena Three.js, geometría, InstancedMesh
│   ├── cell-database.ts    # DB de 100+ celdas (Samsung, LG, Molicel, etc.)
│   ├── presets.ts          # 14 size presets + 7 chemistry presets
│   ├── simulation.ts       # Voltage sag, joule heat, SoC, runtime, OCV
│   ├── electrical-engine.ts# Motor bidireccional S↔V, P↔Ah
│   ├── safety-indicators.ts# Semáforos: ampacity, voltage sag, Micah Toll
│   ├── svg-export.ts       # Generación SVG 2D + export PDF (jsPDF)
│   ├── stl-export.ts       # Export STL binario desde la escena Three.js
│   ├── ui.ts               # Wiring de UI, handlers, applyChemPreset()
│   └── app.ts              # Entry point, bootstrap
├── components/
│   ├── sidebar/            # Panel lateral: CellSpecs, Chemistry, PackConfig, etc.
│   └── modals/             # Modales: Disclaimer, Export, BOM, Compare, etc.
└── pages/
    └── index.astro         # Página principal
```

---

## Arquitectura gráfica (F14)

### Decisión de diseño

**Three.js** para render 3D interactivo + **SVG nativo** (string concatenation) para proyección 2D. No se necesita una segunda librería 3D — ambas visiones consumen una **única fuente geométrica** calculada en un solo pase.

### Por qué no segunda librería 3D

| Enfoque | Ventaja | Desventaja |
|---|---|---|
| Three.js + Three.js 2D | API consistente | Segundo renderer innecesario, overhead de memoria |
| Three.js + SVG nativo | SVG ligero, exportable, escalable, print-ready | Coordenadas manuales (pero son simples: solo X,Z) |
| Three.js + canvas 2D | Control total | No exportable como vector |

**Ganador: Three.js + SVG nativo.** La proyección 2D es un simple top-down view con Z-flip — no requiere perspectiva ni shading, solo `(x, z)` de cada celda.

### Flujo de datos — Una sola fuente geométrica

```
Input del usuario (S, P, tipo celda, spacing, hex, layers...)
         │
         ▼
    updatePack()          ← FUENTE ÚNICA DE GEOMETRÍA
         │
         ├──► 3D: InstancedMesh matrices ──► Three.js scene ──► WebGL canvas
         │                                        │
         │                                        └──► STL export (binario)
         │
         ├──► 2D: CellPosition2D[] ──────► SVG export (string SVG)
         ├──► 2D: BusbarConnection2D[] ──► SVG export
         └──► 2D: packBounds2D ──────────► SVG viewBox + outlines
```

**`updatePack()`** en `pack-builder.ts` es el motor único. En el mismo loop que calcula las matrices 3D para `InstancedMesh`, pobla los arrays 2D:

```typescript
// Mismo loop, misma iteración:
dummy.position.set(x, y, z);          // → InstancedMesh (Three.js)
cellPositions2D.push({ x, z, s, p }); // → SVG export
```

### Three.js — Render 3D interactivo

**Archivos:** `pack-builder.ts`, `stl-export.ts`

| Componente | Tipo | Detalle |
|---|---|---|
| Escena | `THREE.Scene` | Background configurable |
| Cámara | `PerspectiveCamera` | FOV 45, near=1, far=10000 |
| Renderer | `WebGLRenderer` | antialias, alpha, PCFSoftShadowMap |
| Labels | `CSS2DRenderer` | Overlay HTML en espacio 3D |
| Controles | `OrbitControls` | Damping habilitado |
| Iluminación | Ambient(0.6) + Directional(1.0) | Shadow map 2048×2048 |

**Jerarquía de la escena:**

```
scene
├── packGroup (Group)           # Toda la geometría del pack
│   ├── InstancedMesh cells     # CylinderGeometry / BoxGeometry
│   ├── InstancedMesh caps      # Tapas de celdas
│   ├── InstancedMesh spacers   # Espaciadores
│   ├── InstancedMesh strips    # Busbars (BoxGeometry)
│   ├── InstancedMesh busCaps   # Tapas de busbar
│   ├── TubeGeometry wires      # Cables +/− (CatmullRomCurve3)
│   ├── TubeGeometry interconn  # Conectores inter-layer
│   └── CSS2DObject labels      # Labels de voltaje/nodo
├── dimGroup (Group)            # Líneas de dimensión + flechas
└── bmsBoxGroup (Group)         # Bounding box del BMS (translúcido)
```

**Selección de geometría por tipo de celda:**
- **Cilíndrica:** `CylinderGeometry(d/2, d/2, l, segments)` — segmentos se degradan por rendimiento (32 ≤500 celdas, 16 ≤1000, 10 >1000)
- **Prismática:** `BoxGeometry(cellW, l, cellD)`

**Rendimiento:**
- >500 celdas: reduce segmentos, desactiva sombras, oculta labels
- >1000 celdas: reducción adicional, busbar mode "geo" ( geometría mínima)
- Occlusion check via `Raycaster` contra `packState.occluders`

### SVG — Proyección 2D

**Archivos:** `svg-export.ts`, `SvgExportModal.astro`

El SVG se genera como **string concatenation** (template literals), no como DOM SVG. El output es un Blob para descarga — nunca se inyecta en el DOM para preview en vivo.

**Elementos SVG renderizados:**

| Elemento | SVG | Descripción |
|---|---|---|
| Celdas | `<circle>` (cilíndrica) / `<rect>` (prismática) | Color por grupo paralelo |
| Busbars | `<line>` | Sólida = paralelo, punteada = serie |
| Flechas | `<line marker-end>` | Dirección de corriente en serie |
| Soldadura | `<circle>` Ø3mm | Marcas de spot weld (F15c) |
| Polaridad | `<text>` + / − | Primer/última celda, cruz central |
| Dimensiones | `<line>` + `<text>` | Ancho y profundidad en mm |
| Grid | `<pattern>` | Cuadrícula 10mm opcional |
| Leyenda | `<rect>` + `<text>` | Grupos paralelos |

**Coordenadas:** Top-down view con Z-flip (`svgZ = viewHeight - (z - zMin)`) para que +Z apunte hacia arriba en el SVG, igual que en 3D. Unidades en mm.

**Opciones de export** (`SvgExportOptions`):

```typescript
interface SvgExportOptions {
  showCells: boolean;      // Footprints de celdas
  showBusbars: boolean;    // Conexiones paralelo/serie
  showArrows: boolean;     // Flechas de corriente
  showWelds: boolean;      // Marcas de spot weld
  showPolarity: boolean;   // +/− y cruz de alineación
  showDimensions: boolean; // Líneas de dimensión
  showGrid: boolean;       // Cuadrícula 10mm
}
```

### Export PDF

Usa **jsPDF** v4.2.1 para rasterizar el SVG a 3× resolución en un canvas, luego embeber como imagen PNG en el PDF. Fragmentación automática en A4/Carta con marcas de registro por tile.

### Export STL

Traversa directamente `packGroup.children` (los mismos `InstancedMesh` de Three.js) y exporta geometría binaria STL.-checkbox por componente (celdas, espaciadores, busbars).

### Tipos compartidos entre 3D y 2D

```typescript
// pack-builder.ts — puente entre renderers
interface CellPosition2D {
  x: number; z: number;      // Coordenadas mundo (top-down)
  s: number; p: number;      // Índices serie/paralelo
  layer: number;              // Índice de capa
  cellW: number; cellD: number; // Dimensiones celda
  isPrismatic: boolean;
}

interface BusbarConnection2D {
  x1: number; z1: number;    // Inicio
  x2: number; z2: number;    // Fin
  type: 'parallel' | 'series';
  layer: number;
}

let packBounds2D = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
```

### Resumen de decisión

| Pregunta | Respuesta |
|---|---|
| ¿Three.js cubre el 3D? | Sí — InstancedMesh, PerspectiveCamera, OrbitControls, WebGLRenderer |
| ¿Necesitamos segunda librería 3D para 2D? | No — SVG nativo por string concatenation es suficiente |
| ¿Hay una sola fuente geométrica? | Sí — `updatePack()` calcula geometría una vez, la consumen Three.js (3D), SVG (2D) y STL (export) |
| ¿Por qué SVG sobre canvas 2D? | Exportable como vector, escalable, print-ready, ligero |