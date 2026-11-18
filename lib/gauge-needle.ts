/** Round dial viewBox and the hub the needle must spin on. */
export const ROUND_GAUGE_VIEW = { width: 96, height: 82, cx: 48, cy: 42 };

/**
 * CSS rotation around the hub. An SVG `rotate(angle cx cy)` attribute plus
 * `transition: transform` is interpolated from transform-origin 0,0, so the
 * hub walks off center. A single rotate() with the origin at the hub does not.
 */
export function needlePivotStyle(
  angle: number,
  cx = ROUND_GAUGE_VIEW.cx,
  cy = ROUND_GAUGE_VIEW.cy,
  width = ROUND_GAUGE_VIEW.width,
  height = ROUND_GAUGE_VIEW.height,
) {
  const x = (cx / width) * 100;
  const y = (cy / height) * 100;
  return {
    transformBox: "view-box" as const,
    transformOrigin: `${x}% ${y}%`,
    transform: `rotate(${angle}deg)`,
  };
}

/** Where the declared origin sits, in viewBox units. It must be the hub. */
export function pivotPoint(style: { transformOrigin: string }, width = ROUND_GAUGE_VIEW.width, height = ROUND_GAUGE_VIEW.height) {
  const [xRaw, yRaw] = style.transformOrigin.split(" ");
  return {
    x: (Number.parseFloat(xRaw) / 100) * width,
    y: (Number.parseFloat(yRaw) / 100) * height,
  };
}
