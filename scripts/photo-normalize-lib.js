/**
 * Общая нормализация фото: вертикальный холст, белый фон, растение целиком.
 */
const sharp = require("sharp");

const CANVAS_W = 800;
const CANVAS_H = 1067; /* 3:4 — больше места по высоте, макушки не упираются в край */
const SAFE_SCALE = 0.88;
const WEBP_QUALITY = 82;
const BLACK_THRESH = 34;

async function stripNearBlackBackground(buf) {
  const { data, info } = await sharp(buf)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  for (let i = 0; i < data.length; i += ch) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r <= BLACK_THRESH && g <= BLACK_THRESH && b <= BLACK_THRESH) {
      data[i + 3] = 0;
    }
  }
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: ch },
  }).flatten({ background: "#ffffff" });
}

async function normalizeToWhiteCanvas(inputBuffer) {
  let base = await stripNearBlackBackground(inputBuffer);
  const meta = await base.metadata();
  const w = meta.width || CANVAS_W;
  const h = meta.height || CANVAS_H;
  const maxW = CANVAS_W * SAFE_SCALE;
  const maxH = CANVAS_H * SAFE_SCALE;
  const scale = Math.min(maxW / w, maxH / h);
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));
  const padTop = Math.floor((CANVAS_H - nh) / 2);
  const padBottom = CANVAS_H - nh - padTop;
  const padLeft = Math.floor((CANVAS_W - nw) / 2);
  const padRight = CANVAS_W - nw - padLeft;

  return base
    .resize(nw, nh, { fit: "inside" })
    .extend({
      top: padTop,
      bottom: padBottom,
      left: padLeft,
      right: padRight,
      background: "#ffffff",
    })
    .webp({ quality: WEBP_QUALITY, effort: 4 });
}

module.exports = {
  CANVAS_W,
  CANVAS_H,
  normalizeToWhiteCanvas,
  stripNearBlackBackground,
};
