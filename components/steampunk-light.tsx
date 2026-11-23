"use client";

import { useId, type CSSProperties } from "react";

import { cagePaths, LAMP_REST, lampPaint, STEAMPUNK_LIGHT_PX } from "@/lib/steampunk-light";

/** A caged bulb seen from directly above. Upper-left light, same as the cabinet. */
export function SteampunkLight({
  className = "",
  brightness,
  driven = false,
}: {
  className?: string;
  /** Omit to keep the resting lamp. 0 is off, 1 is full. */
  brightness?: number;
  /** Read brightness from inherited CSS variables. The wheel lamps drive these. */
  driven?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const bars = cagePaths();
  const paint = brightness === undefined ? LAMP_REST : lampPaint(brightness);
  const varStyle = (property: string, variable: string): CSSProperties | undefined =>
    driven ? ({ [property]: `var(${variable})` } as CSSProperties) : undefined;
  return (
    <svg
      className={`steampunk-light ${className}`.trim()}
      width={STEAMPUNK_LIGHT_PX}
      height={STEAMPUNK_LIGHT_PX}
      viewBox="0 0 32 32"
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      <defs>
        <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
          <stop
            offset="0%"
            stopColor={driven ? "var(--lamp-bloom)" : "#ffcf70"}
            stopOpacity={driven ? undefined : paint.haloOpacity}
            style={varStyle("stopOpacity", "--lamp-halo")}
          />
          <stop
            offset="48%"
            stopColor={driven ? "var(--lamp-color)" : "#e6a23a"}
            stopOpacity={driven ? undefined : paint.haloOpacity * 0.4}
            style={driven ? ({ stopOpacity: "calc(var(--lamp-halo) * 0.4)" } as CSSProperties) : undefined}
          />
          <stop offset="100%" stopColor={driven ? "var(--lamp-color)" : "#e6a23a"} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-bulb`} cx="38%" cy="34%" r="70%">
          <stop offset="0%" stopColor={driven ? undefined : paint.bulbCore} style={varStyle("stopColor", "--lamp-core")} />
          <stop offset="42%" stopColor={driven ? undefined : paint.bulbMid} style={varStyle("stopColor", "--lamp-mid")} />
          <stop offset="100%" stopColor={driven ? undefined : paint.bulbEdge} style={varStyle("stopColor", "--lamp-edge")} />
        </radialGradient>
        <radialGradient id={`${id}-glass`} cx="32%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.72" />
          <stop offset="22%" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="68%" stopColor="#d7e6ef" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
        </radialGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="42%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#5c4316" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={`${id}-brass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f3e2ad" />
          <stop offset="46%" stopColor="#c4963e" />
          <stop offset="100%" stopColor="#7a5a22" />
        </linearGradient>
        <clipPath id={`${id}-dome`}>
          <circle cx="16" cy="16" r="11.2" />
        </clipPath>
      </defs>

      <circle cx="16" cy="16" r="26" fill={`url(#${id}-halo)`} />
      <circle cx="16" cy="16" r="13.15" fill="none" stroke={`url(#${id}-brass)`} strokeWidth="2.7" />
      <circle cx="16" cy="16" r="11.55" fill="#2a160c" fillOpacity="0.35" />
      <circle cx="16" cy="16" r="7.4" fill={driven ? "var(--lamp-bloom)" : "#ffcf70"} fillOpacity={driven ? undefined : paint.glowOpacity} style={varStyle("fillOpacity", "--lamp-glow")} />
      <circle cx="16" cy="16" r="4.7" fill={`url(#${id}-bulb)`} />
      <circle cx="16" cy="16" r="11.2" fill={`url(#${id}-glass)`} stroke={`url(#${id}-rim)`} strokeWidth="0.9" />
      <circle cx="16" cy="16" r="11.2" fill={driven ? "var(--lamp-color)" : "#ffcf70"} fillOpacity={driven ? undefined : paint.glassWarm} style={varStyle("fillOpacity", "--lamp-glass")} />
      <ellipse cx="11.2" cy="10.4" rx="3.1" ry="1.7" fill="#ffffff" fillOpacity="0.72" transform="rotate(-32 11.2 10.4)" />

      <g clipPath={`url(#${id}-dome)`}>
        <g transform="translate(0.45 0.55)" stroke="#2a160c" strokeOpacity="0.4" strokeWidth="1.7" fill="none" strokeLinecap="round">
          {bars.map((bar) => (
            <path key={`shadow-${bar.axis}-${bar.d}`} d={bar.d} />
          ))}
        </g>
        <g stroke={`url(#${id}-brass)`} strokeWidth="1.55" fill="none" strokeLinecap="round">
          {bars.map((bar) => (
            <path key={`${bar.axis}-${bar.d}`} d={bar.d} />
          ))}
        </g>
        <g stroke={driven ? "var(--lamp-color)" : "#ffb347"} strokeWidth="0.7" fill="none" strokeLinecap="round" strokeOpacity={driven ? undefined : paint.barWarm} style={varStyle("strokeOpacity", "--lamp-bar")}>
          {bars.map((bar) => (
            <path key={`warm-${bar.axis}-${bar.d}`} d={bar.d} />
          ))}
        </g>
      </g>
    </svg>
  );
}

