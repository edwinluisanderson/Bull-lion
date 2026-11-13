import { priceParts } from "@/lib/price-reels";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export function RollingPrice({ value }: { value: string }) {
  const parts = priceParts(value);

  return (
    <p className="rolling-price" data-testid="melt-value" aria-label={value}>
      <span className="sr-only">{value}</span>
      <span className="rolling-price-wheels" aria-hidden="true">
        {parts.map((part) =>
          part.kind === "mark" ? (
            <span key={part.key} className="price-mark">
              {part.char}
            </span>
          ) : (
            <span key={part.key} className="digit-reel">
              <span
                className="digit-reel-strip"
                style={{
                  transform: `translate3d(0, calc(${part.digit} * -1em), 0)`,
                  transitionDelay: `${part.order * 50}ms`,
                }}
              >
                {DIGITS.map((digit) => (
                  <span key={digit}>{digit}</span>
                ))}
              </span>
            </span>
          ),
        )}
      </span>
    </p>
  );
}
