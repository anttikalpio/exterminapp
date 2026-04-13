import sharp from "sharp";

interface TrapMarker {
  lat: number;
  lng: number;
  status: string;
  label: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "#16a34a",
  inactive: "#9ca3af",
  damaged: "#f59e0b",
  removed: "#ef4444",
};

const TILE_SIZE = 256;
const TILE_URL = "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png";

// ── Mercator math ──────────────────────────────────────────────

function lngToTileX(lng: number, zoom: number) {
  return ((lng + 180) / 360) * Math.pow(2, zoom);
}

function latToTileY(lat: number, zoom: number) {
  const latRad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    Math.pow(2, zoom)
  );
}

function lngToPixel(
  lng: number,
  zoom: number,
  centerLng: number,
  imgWidth: number
) {
  const cx = lngToTileX(centerLng, zoom) * TILE_SIZE;
  const px = lngToTileX(lng, zoom) * TILE_SIZE;
  return Math.round(px - cx + imgWidth / 2);
}

function latToPixel(
  lat: number,
  zoom: number,
  centerLat: number,
  imgHeight: number
) {
  const cy = latToTileY(centerLat, zoom) * TILE_SIZE;
  const py = latToTileY(lat, zoom) * TILE_SIZE;
  return Math.round(py - cy + imgHeight / 2);
}

function computeZoom(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  width: number,
  height: number
): number {
  for (let z = 18; z >= 1; z--) {
    const x1 = lngToTileX(minLng, z) * TILE_SIZE;
    const x2 = lngToTileX(maxLng, z) * TILE_SIZE;
    const y1 = latToTileY(maxLat, z) * TILE_SIZE; // maxLat is north = smaller y
    const y2 = latToTileY(minLat, z) * TILE_SIZE;
    if (x2 - x1 < width * 0.8 && y2 - y1 < height * 0.8) return z;
  }
  return 1;
}

// ── Main export ────────────────────────────────────────────────

export async function generateStaticMapImage(options: {
  traps: TrapMarker[];
  width?: number;
  height?: number;
}): Promise<string> {
  const { traps, width = 550, height = 300 } = options;

  if (traps.length === 0) {
    // Return a transparent 1x1 PNG as fallback
    const buf = await sharp({
      create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    return `data:image/png;base64,${buf.toString("base64")}`;
  }

  // Compute bounds
  const lats = traps.map((t) => t.lat);
  const lngs = traps.map((t) => t.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  const zoom =
    traps.length === 1
      ? 16
      : computeZoom(minLat, maxLat, minLng, maxLng, width, height);

  // Determine which tiles we need
  const centerTileX = lngToTileX(centerLng, zoom);
  const centerTileY = latToTileY(centerLat, zoom);
  const centerPixelX = centerTileX * TILE_SIZE;
  const centerPixelY = centerTileY * TILE_SIZE;

  const topLeftPixelX = centerPixelX - width / 2;
  const topLeftPixelY = centerPixelY - height / 2;

  const startTileX = Math.floor(topLeftPixelX / TILE_SIZE);
  const startTileY = Math.floor(topLeftPixelY / TILE_SIZE);
  const endTileX = Math.floor((topLeftPixelX + width) / TILE_SIZE);
  const endTileY = Math.floor((topLeftPixelY + height) / TILE_SIZE);

  const maxTile = Math.pow(2, zoom) - 1;

  // Fetch tiles
  const tileComposites: Array<{
    input: Buffer;
    left: number;
    top: number;
  }> = [];

  const fetchPromises: Promise<void>[] = [];
  for (let tx = startTileX; tx <= endTileX; tx++) {
    for (let ty = startTileY; ty <= endTileY; ty++) {
      if (ty < 0 || ty > maxTile) continue;
      const wrappedX = ((tx % (maxTile + 1)) + (maxTile + 1)) % (maxTile + 1);
      const url = TILE_URL.replace("{z}", String(zoom))
        .replace("{x}", String(wrappedX))
        .replace("{y}", String(ty));

      const left = Math.round(tx * TILE_SIZE - topLeftPixelX);
      const top = Math.round(ty * TILE_SIZE - topLeftPixelY);

      fetchPromises.push(
        fetch(url)
          .then((res) => res.arrayBuffer())
          .then((ab) => {
            tileComposites.push({
              input: Buffer.from(ab),
              left,
              top,
            });
          })
          .catch(() => {
            // Skip failed tiles silently
          })
      );
    }
  }

  await Promise.all(fetchPromises);

  // Build the SVG overlay with trap markers
  const markerRadius = 7;
  const markerSvgParts: string[] = [];
  for (const trap of traps) {
    const x = lngToPixel(trap.lng, zoom, centerLng, width);
    const y = latToPixel(trap.lat, zoom, centerLat, height);
    const color = STATUS_COLORS[trap.status] ?? "#6b7280";

    // Circle marker
    markerSvgParts.push(
      `<circle cx="${x}" cy="${y}" r="${markerRadius}" fill="${color}" stroke="white" stroke-width="2"/>`
    );
    // Label
    markerSvgParts.push(
      `<text x="${x}" y="${y - markerRadius - 3}" text-anchor="middle" font-size="10" font-family="Helvetica, Arial, sans-serif" fill="#111827" font-weight="bold">${escapeXml(trap.label)}</text>`
    );
  }

  const markerSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${markerSvgParts.join("")}</svg>`;

  // Composite: base canvas → tiles → markers
  let image = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 240, g: 240, b: 240, alpha: 255 },
    },
  });

  // Sort composites to get consistent layering
  tileComposites.sort((a, b) => a.top - b.top || a.left - b.left);

  image = image.composite([
    ...tileComposites,
    { input: Buffer.from(markerSvg), left: 0, top: 0 },
  ]);

  const pngBuffer = await image.png().toBuffer();
  return `data:image/png;base64,${pngBuffer.toString("base64")}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
