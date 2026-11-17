"use client";

import { useId } from "react";

import { cagePaths, STEAMPUNK_LIGHT_PX } from "@/lib/steampunk-light";

/** A caged bulb seen from directly above. Upper-left light, same as the cabinet. */
export function SteampunkLight({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const bars = cagePaths();
  return (
    <svg
      className={`steampunk-light ${className}`.trim()}
      width={STEAMPUNK_LIGHT_PX}
      height={STEAMPUNK_LIGHT_PX}
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${id}-bulb`} cx="38%" cy="34%" r="70%">
          <stop offset="0%" stopColor="#fff8dc" />
          <stop offset="42%" stopColor="#ffcf70" />
          <stop offset="100%" stopColor="#e6a23a" />
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

      <circle cx="16" cy="16" r="13.15" fill="none" stroke={`url(#${id}-brass)`} strokeWidth="2.55" />
      <circle cx="16" cy="16" r="11.55" fill="#2a160c" fillOpacity="0.35" />
      <circle cx="16" cy="16" r="7.4" fill="#ffcf70" fillOpacity="0.28" />
      <circle cx="16" cy="16" r="4.7" fill={`url(#${id}-bulb)`} />
      <circle cx="16" cy="16" r="11.2" fill={`url(#${id}-glass)`} stroke={`url(#${id}-rim)`} strokeWidth="0.7" />
      <ellipse cx="11.2" cy="10.4" rx="3.1" ry="1.7" fill="#ffffff" fillOpacity="0.72" transform="rotate(-32 11.2 10.4)" />

      <g clipPath={`url(#${id}-dome)`}>
        <g transform="translate(0.45 0.55)" stroke="#2a160c" strokeOpacity="0.4" strokeWidth="1.35" fill="none" strokeLinecap="round">
          {bars.map((bar) => (
            <path key={`shadow-${bar.axis}-${bar.d}`} d={bar.d} />
          ))}
        </g>
        <g stroke={`url(#${id}-brass)`} strokeWidth="1.25" fill="none" strokeLinecap="round">
          {bars.map((bar) => (
            <path key={`${bar.axis}-${bar.d}`} d={bar.d} />
          ))}
        </g>
      </g>
    </svg>
  );
}
