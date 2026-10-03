// Genera los iconos de la PWA a partir del logo de InventX escritorio (xing.ico).
import sharp from "sharp";
const logo = (s, cx, cy) => {
  const k = s / 125;
  const t = (x, y) => `${(cx - 62.5 * k + x * k).toFixed(1)},${(cy - 62.5 * k + y * k).toFixed(1)}`;
  const w = (21 * k).toFixed(1);
  return (
    `<path d="M${t(36, 20)} L${t(58, 56)} L${t(24, 104)}" fill="none" stroke="#0b74d6" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M${t(102, 20)} L${t(78, 62)} L${t(102, 104)}" fill="none" stroke="#a8d0f5" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
};
const svg = (n, { bg = "#ffffff", scale = 0.72 } = {}) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}"><rect width="${n}" height="${n}" fill="${bg}"/>${logo(n * scale, n / 2, n / 2)}</svg>`);
const jobs = [
  ["icon-192.png", svg(192)],
  ["icon-512.png", svg(512)],
  ["icon-maskable-512.png", svg(512, { scale: 0.55 })],
  ["apple-touch-icon.png", svg(180, { scale: 0.66 })],
  ["favicon-64.png", svg(64, { scale: 0.95, bg: "#00000000" })],
];
Promise.all(jobs.map(([f, s]) => sharp(s).png().toFile(`public/icons/${f}`))).then(() => console.log("iconos generados"));
