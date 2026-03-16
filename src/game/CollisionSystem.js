export function circleCircle(ax, ay, ar, bx, by, br) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist2 = dx * dx + dy * dy;
  const rSum = ar + br;
  return dist2 <= rSum * rSum;
}

export function rectRect(ax, ay, aw, ah, bx, by, bw, bh) {
  return (
    ax - aw / 2 < bx + bw / 2 &&
    ax + aw / 2 > bx - bw / 2 &&
    ay - ah / 2 < by + bh / 2 &&
    ay + ah / 2 > by - bh / 2
  );
}

export function circleRect(cx, cy, cr, rx, ry, rw, rh) {
  const nearX = Math.max(rx - rw / 2, Math.min(cx, rx + rw / 2));
  const nearY = Math.max(ry - rh / 2, Math.min(cy, ry + rh / 2));
  const dx = cx - nearX;
  const dy = cy - nearY;
  return dx * dx + dy * dy <= cr * cr;
}

export function pointCircle(px, py, cx, cy, cr) {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= cr * cr;
}
