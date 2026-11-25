"use client";

/** A small amber lamp. It opens the exact figure the flaps had to round. */
export function RoundedLight({
  exact,
  open,
  onToggle,
}: {
  exact: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <span className="rounded-light">
      <button type="button" className="rounded-lamp" aria-label={`Rounded. Exact amount ${exact}`} aria-expanded={open} onClick={onToggle}>
        <span className="sr-only">rounded</span>
      </button>
      {open ? <span className="rounded-exact">{exact}</span> : null}
    </span>
  );
}
