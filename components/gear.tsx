export function Gear({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <g fill="currentColor">
        {Array.from({ length: 8 }, (_, tooth) => (
          <rect
            key={tooth}
            x="44"
            y="4"
            width="12"
            height="18"
            rx="2"
            transform={`rotate(${tooth * 45} 50 50)`}
          />
        ))}
        <circle cx="50" cy="50" r="28" />
      </g>
      <circle cx="50" cy="50" r="12" fill="#3a2414" />
      <circle cx="50" cy="50" r="4.5" fill="#f0d78c" />
    </svg>
  );
}
