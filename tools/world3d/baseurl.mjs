// Stats and tests load the game from the repo root, so ../art and ../fonts resolve.
// MK_BASE still overrides (full URL of index.html, or of dev.html for the collision tool).
export function pageUrl(file = 'index.html') {
  const port = process.env.MKPORT || '47321';
  const fallback = `http://127.0.0.1:${port}/world3d/${file}`;
  const base = process.env.MK_BASE;
  if (!base) return fallback;
  if (file === 'index.html') return base;
  return base.replace(/[^/]*$/, file);
}
