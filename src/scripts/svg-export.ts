/* ─────────────────────────────────────────────
   F15a + F15b + F15c — SVG 2D Projection + PDF Export + Spot Welding
   Generates top-down SVG projection of the battery pack
   ───────────────────────────────────────────── */

import { jsPDF } from 'jspdf';
import {
  getCellPositions2D,
  getBusbarConnections2D,
  getPackBounds2D,
  getStats,
  type CellPosition2D,
} from './pack-builder';
import { inputs } from './dom';

/* ── Parallel group color palette ── */
const PARALLEL_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#eab308', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
];

function getParallelColor(p: number): string {
  return PARALLEL_COLORS[p % PARALLEL_COLORS.length];
}

/* ── SVG Generation ── */

export interface SvgExportOptions {
  showCells: boolean;
  showBusbars: boolean;
  showArrows: boolean;
  showWelds: boolean;
  showPolarity: boolean;
  showDimensions: boolean;
  showGrid: boolean;
}

export function generatePackSvg(opts: SvgExportOptions): string {
  const cells = getCellPositions2D();
  const buses = getBusbarConnections2D();
  const bounds = getPackBounds2D();
  const stats = getStats();

  if (cells.length === 0) return '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

  const PAD = 25; // mm padding around pack
  const vxMin = bounds.minX - PAD;
  const vzMin = bounds.minZ - PAD;
  const vxMax = bounds.maxX + PAD;
  const vzMax = bounds.maxZ + PAD;
  const vw = vxMax - vxMin;
  const vh = vzMax - vzMin;

  // Flip Z so top-down view matches 3D orientation (positive Z = up in SVG)
  const tx = (x: number) => x - vxMin;
  const tz = (z: number) => vh - (z - vzMin);

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw.toFixed(2)} ${vh.toFixed(2)}" width="${vw.toFixed(2)}mm" height="${vh.toFixed(2)}mm">`);

  // Defs: arrow markers, patterns
  parts.push('<defs>');
  parts.push(`<marker id="arrow" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="8" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,3 L0,6 Z" fill="#334155"/></marker>`);
  parts.push(`<pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e2e8f0" stroke-width="0.1"/></pattern>`);
  parts.push('</defs>');

  // Background
  parts.push(`<rect width="${vw.toFixed(2)}" height="${vh.toFixed(2)}" fill="white"/>`);

  // Grid overlay
  if (opts.showGrid) {
    parts.push(`<rect width="${vw.toFixed(2)}" height="${vh.toFixed(2)}" fill="url(#grid)"/>`);
  }

  // Pack outline
  const ow = (bounds.maxX - bounds.minX).toFixed(2);
  const oh = (bounds.maxZ - bounds.minZ).toFixed(2);
  parts.push(`<rect x="${tx(bounds.minX).toFixed(2)}" y="${tz(bounds.maxZ).toFixed(2)}" width="${ow}" height="${oh}" fill="none" stroke="#94a3b8" stroke-width="0.5" stroke-dasharray="2,1"/>`);

  // Busbars (parallel + series)
  if (opts.showBusbars) {
    for (const b of buses) {
      const color = b.type === 'parallel' ? '#94a3b8' : '#64748b';
      const sw = b.type === 'parallel' ? 0.4 : 0.6;
      const dash = b.type === 'series' ? 'stroke-dasharray="1,0.5"' : '';
      parts.push(`<line x1="${tx(b.x1).toFixed(2)}" y1="${tz(b.z1).toFixed(2)}" x2="${tx(b.x2).toFixed(2)}" y2="${tz(b.z2).toFixed(2)}" stroke="${color}" stroke-width="${sw}" ${dash}/>`);
    }
  }

  // Cells
  if (opts.showCells) {
    for (const c of cells) {
      const cx = tx(c.x).toFixed(2);
      const cz = tz(c.z).toFixed(2);
      const fill = getParallelColor(c.p);
      const stroke = '#1e293b';
      const sw = 0.2;

      if (c.isPrismatic) {
        parts.push(`<rect x="${(tx(c.x) - c.cellW / 2).toFixed(2)}" y="${(tz(c.z) - c.cellD / 2).toFixed(2)}" width="${c.cellW.toFixed(2)}" height="${c.cellD.toFixed(2)}" fill="${fill}" fill-opacity="0.3" stroke="${stroke}" stroke-width="${sw}" data-s="${c.s}" data-p="${c.p}" data-layer="${c.layer}"/>`);
      } else {
        const r = (c.cellD / 2).toFixed(2);
        parts.push(`<circle cx="${cx}" cy="${cz}" r="${r}" fill="${fill}" fill-opacity="0.3" stroke="${stroke}" stroke-width="${sw}" data-s="${c.s}" data-p="${c.p}" data-layer="${c.layer}"/>`);
      }

      // Cell label (S#, P#) — only for small packs
      if (cells.length <= 200) {
        const fontSize = cells.length <= 50 ? 1.8 : 1.2;
        parts.push(`<text x="${cx}" y="${cz}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" font-family="monospace" fill="#1e293b" font-weight="bold">S${c.s + 1}</text>`);
      }
    }
  }

  // Spot welds (F15c)
  if (opts.showWelds) {
    const weldR = 1.5; // Ø3mm / 2
    for (const c of cells) {
      // Two weld points per cell: positive (top) and negative (bottom) terminals
      // In 2D top-down, these are at the edges of the cell along the series direction
      const weldOffset = c.cellD * 0.35;
      const isPlus = c.s % 2 === 0;

      // Positive terminal weld
      parts.push(`<circle cx="${tx(c.x).toFixed(2)}" cy="${tz(c.z - weldOffset).toFixed(2)}" r="${weldR}" fill="none" stroke="${isPlus ? '#ef4444' : '#1e293b'}" stroke-width="0.3"/>`);
      // Negative terminal weld
      parts.push(`<circle cx="${tx(c.x).toFixed(2)}" cy="${tz(c.z + weldOffset).toFixed(2)}" r="${weldR}" fill="none" stroke="${isPlus ? '#1e293b' : '#ef4444'}" stroke-width="0.3"/>`);
    }
  }

  // Current direction arrows (F15a)
  if (opts.showArrows && cells.length > 0) {
    // Draw arrows along the series path
    const sGroups = new Map<number, CellPosition2D[]>();
    for (const c of cells) {
      if (!sGroups.has(c.s)) sGroups.set(c.s, []);
      sGroups.get(c.s)!.push(c);
    }

    const sortedS = [...sGroups.keys()].sort((a, b) => a - b);
    for (let i = 0; i < sortedS.length - 1; i++) {
      const sA = sGroups.get(sortedS[i])!;
      const sB = sGroups.get(sortedS[i + 1])!;
      // Arrow from center of group A to center of group B
      const avgA = sA.reduce((acc, c) => ({ x: acc.x + c.x / sA.length, z: acc.z + c.z / sA.length }), { x: 0, z: 0 });
      const avgB = sB.reduce((acc, c) => ({ x: acc.x + c.x / sB.length, z: acc.z + c.z / sB.length }), { x: 0, z: 0 });

      const x1 = tx(avgA.x).toFixed(2);
      const y1 = tz(avgA.z).toFixed(2);
      const x2 = tx(avgB.x).toFixed(2);
      const y2 = tz(avgB.z).toFixed(2);

      parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#334155" stroke-width="0.4" marker-end="url(#arrow)"/>`);
    }
  }

  // Polarity markers (F15c)
  if (opts.showPolarity && cells.length > 0) {
    const firstCell = cells[0];
    const lastCell = cells[cells.length - 1];
    const fontSize = 3;

    // Negative terminal (first cell)
    parts.push(`<text x="${tx(firstCell.x).toFixed(2)}" y="${(tz(firstCell.z) + firstCell.cellD / 2 + 4).toFixed(2)}" text-anchor="middle" font-size="${fontSize}" font-family="sans-serif" fill="#1e293b" font-weight="bold">−</text>`);

    // Positive terminal (last cell)
    parts.push(`<text x="${tx(lastCell.x).toFixed(2)}" y="${(tz(lastCell.z) - lastCell.cellD / 2 - 2).toFixed(2)}" text-anchor="middle" font-size="${fontSize}" font-family="sans-serif" fill="#ef4444" font-weight="bold">+</text>`);

    // Center cross for alignment
    const cX = tx((bounds.minX + bounds.maxX) / 2);
    const cZ = tz((bounds.minZ + bounds.maxZ) / 2);
    const crossSize = 5;
    parts.push(`<line x1="${(cX - crossSize).toFixed(2)}" y1="${cZ.toFixed(2)}" x2="${(cX + crossSize).toFixed(2)}" y2="${cZ.toFixed(2)}" stroke="#94a3b8" stroke-width="0.2"/>`);
    parts.push(`<line x1="${cX.toFixed(2)}" y1="${(cZ - crossSize).toFixed(2)}" x2="${cX.toFixed(2)}" y2="${(cZ + crossSize).toFixed(2)}" stroke="#94a3b8" stroke-width="0.2"/>`);
  }

  // Dimension lines
  if (opts.showDimensions && cells.length > 0) {
    const packW = (bounds.maxX - bounds.minX).toFixed(1);
    const packD = (bounds.maxZ - bounds.minZ).toFixed(1);
    const dimOffset = 8;
    const fontSize = 2;

    // Width dimension (top)
    const yDim = tz(bounds.maxZ) - dimOffset;
    parts.push(`<line x1="${tx(bounds.minX).toFixed(2)}" y1="${yDim.toFixed(2)}" x2="${tx(bounds.maxX).toFixed(2)}" y2="${yDim.toFixed(2)}" stroke="#334155" stroke-width="0.15"/>`);
    parts.push(`<line x1="${tx(bounds.minX).toFixed(2)}" y1="${(yDim - 1).toFixed(2)}" x2="${tx(bounds.minX).toFixed(2)}" y2="${(yDim + 1).toFixed(2)}" stroke="#334155" stroke-width="0.15"/>`);
    parts.push(`<line x1="${tx(bounds.maxX).toFixed(2)}" y1="${(yDim - 1).toFixed(2)}" x2="${tx(bounds.maxX).toFixed(2)}" y2="${(yDim + 1).toFixed(2)}" stroke="#334155" stroke-width="0.15"/>`);
    parts.push(`<text x="${((tx(bounds.minX) + tx(bounds.maxX)) / 2).toFixed(2)}" y="${(yDim - 1.5).toFixed(2)}" text-anchor="middle" font-size="${fontSize}" font-family="monospace" fill="#334155">${packW}mm</text>`);

    // Depth dimension (right)
    const xDim = tx(bounds.maxX) + dimOffset;
    parts.push(`<line x1="${xDim.toFixed(2)}" y1="${tz(bounds.minZ).toFixed(2)}" x2="${xDim.toFixed(2)}" y2="${tz(bounds.maxZ).toFixed(2)}" stroke="#334155" stroke-width="0.15"/>`);
    parts.push(`<line x1="${(xDim - 1).toFixed(2)}" y1="${tz(bounds.minZ).toFixed(2)}" x2="${(xDim + 1).toFixed(2)}" y2="${tz(bounds.minZ).toFixed(2)}" stroke="#334155" stroke-width="0.15"/>`);
    parts.push(`<line x1="${(xDim - 1).toFixed(2)}" y1="${tz(bounds.maxZ).toFixed(2)}" x2="${(xDim + 1).toFixed(2)}" y2="${tz(bounds.maxZ).toFixed(2)}" stroke="#334155" stroke-width="0.15"/>`);
    parts.push(`<text x="${(xDim + 2).toFixed(2)}" y="${((tz(bounds.minZ) + tz(bounds.maxZ)) / 2).toFixed(2)}" text-anchor="middle" font-size="${fontSize}" font-family="monospace" fill="#334155" transform="rotate(-90,${(xDim + 2).toFixed(2)},${((tz(bounds.minZ) + tz(bounds.maxZ)) / 2).toFixed(2)})">${packD}mm</text>`);
  }

  // Legend (bottom-left)
  if (opts.showCells && cells.length > 0) {
    const legendX = tx(bounds.minX);
    const legendY = tz(bounds.minZ) + 12;

    // Build unique parallel groups preserving insertion order
    const pSeen = new Map<number, boolean>();
    for (const c of cells) {
      if (!pSeen.has(c.p)) pSeen.set(c.p, true);
    }
    const pGroups = [...pSeen.keys()];

    parts.push(`<text x="${legendX.toFixed(2)}" y="${legendY.toFixed(2)}" font-size="2" font-family="sans-serif" fill="#64748b" font-weight="bold">Parallel Groups (P${pGroups.length}):</text>`);
    for (let i = 0; i < pGroups.length; i++) {
      const ly = legendY + 4 + i * 3.5;
      const pVal = pGroups[i];
      parts.push(`<rect x="${legendX.toFixed(2)}" y="${(ly - 2).toFixed(2)}" width="3" height="2" fill="${getParallelColor(pVal)}" fill-opacity="0.5" stroke="#1e293b" stroke-width="0.15"/>`);
      parts.push(`<text x="${(legendX + 4.5).toFixed(2)}" y="${ly.toFixed(2)}" font-size="1.8" font-family="monospace" fill="#334155">P${pVal + 1}</text>`);
    }
  }

  // Title block
  if (stats) {
    const titleY = 5;
    parts.push(`<text x="${(vw / 2).toFixed(2)}" y="${titleY.toFixed(2)}" text-anchor="middle" font-size="3" font-family="sans-serif" fill="#1e293b" font-weight="bold">${stats.name || 'Battery Pack'} — ${stats.s}S ${stats.p}P</text>`);
    parts.push(`<text x="${(vw / 2).toFixed(2)}" y="${(titleY + 4).toFixed(2)}" text-anchor="middle" font-size="2" font-family="monospace" fill="#64748b">${stats.v}V | ${stats.ah}Ah | ${stats.cells} cells</text>`);
  }

  parts.push('</svg>');
  return parts.join('\n');
}

/* ── SVG Download ── */

export function exportSvg(): void {
  const svg = generatePackSvg({
    showCells: true,
    showBusbars: true,
    showArrows: true,
    showWelds: false,
    showPolarity: true,
    showDimensions: true,
    showGrid: false,
  });

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  const stats = getStats();
  const packName = (inputs['pack-name'] as HTMLInputElement | null)?.value || 'battery_pack';
  const safeName = packName.replace(/[^a-z0-9]/gi, '_');
  link.href = URL.createObjectURL(blob);
  link.download = `${safeName}_${stats?.s ?? ''}S${stats?.p ?? ''}P_2D.svg`;
  link.click();
}

/* ── PDF Download (F15b) ── */

export type PaperSize = 'a4' | 'letter';
export type PaperOrientation = 'portrait' | 'landscape';

export interface PdfExportOptions extends SvgExportOptions {
  paperSize: PaperSize;
  orientation: PaperOrientation;
}

export function exportPdf(opts: PdfExportOptions): void {
  const svgStr = generatePackSvg(opts);

  // Create a canvas to rasterize the SVG
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const img = new Image();
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    const paperW = opts.paperSize === 'a4' ? 210 : 216; // mm
    const paperH = opts.paperSize === 'a4' ? 297 : 279; // mm
    const isLandscape = opts.orientation === 'landscape';
    const pageW = isLandscape ? paperH : paperW;
    const pageH = isLandscape ? paperW : paperH;

    // Registration margin
    const margin = 10; // mm
    const printW = pageW - margin * 2;
    const printH = pageH - margin * 2;

    // Scale SVG to fit page
    const svgVB = getSvgViewBox(svgStr);
    const svgAspect = svgVB.w / svgVB.h;
    const pageAspect = printW / printH;

    let drawW: number, drawH: number;
    if (svgAspect > pageAspect) {
      drawW = printW;
      drawH = printW / svgAspect;
    } else {
      drawH = printH;
      drawW = printH * svgAspect;
    }

    const offsetX = margin + (printW - drawW) / 2;
    const offsetY = margin + (printH - drawH) / 2;

    // High-res raster
    const scale = 3; // 3x for print quality
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const pdf = new jsPDF({
      orientation: opts.orientation,
      unit: 'mm',
      format: opts.paperSize,
    });

    // Add rasterized SVG
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', offsetX, offsetY, drawW, drawH);

    // Registration marks (F15b)
    const markLen = 3; // mm
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.1);

    // Top-left
    pdf.line(margin - markLen, margin, margin, margin);
    pdf.line(margin, margin - markLen, margin, margin);
    // Top-right
    pdf.line(pageW - margin, margin, pageW - margin + markLen, margin);
    pdf.line(pageW - margin, margin - markLen, pageW - margin, margin);
    // Bottom-left
    pdf.line(margin - markLen, pageH - margin, margin, pageH - margin);
    pdf.line(margin, pageH - margin, margin, pageH - margin + markLen);
    // Bottom-right
    pdf.line(pageW - margin, pageH - margin, pageW - margin + markLen, pageH - margin);
    pdf.line(pageW - margin, pageH - margin, pageW - margin, pageH - margin + markLen);

    // Title
    const stats = getStats();
    if (stats) {
      pdf.setFontSize(8);
      pdf.setTextColor(100);
      pdf.text(`${stats.name || 'Pack'} — ${stats.s}S${stats.p}P — ${stats.v}V ${stats.ah}Ah`, margin, pageH - margin + 5);
      pdf.text(`Generated by Battery Pack Architect — ${new Date().toLocaleDateString()}`, margin, pageH - margin + 9);
    }

    const packName = (inputs['pack-name'] as HTMLInputElement | null)?.value || 'battery_pack';
    const safeName = packName.replace(/[^a-z0-9]/gi, '_');
    pdf.save(`${safeName}_${stats?.s ?? ''}S${stats?.p ?? ''}P_2D.pdf`);

    URL.revokeObjectURL(url);
  };

  img.src = url;
}

function getSvgViewBox(svg: string): { x: number; y: number; w: number; h: number } {
  const match = svg.match(/viewBox="([^"]+)"/);
  if (match) {
    const parts = match[1].split(/\s+/).map(Number);
    return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
  }
  return { x: 0, y: 0, w: 100, h: 100 };
}
