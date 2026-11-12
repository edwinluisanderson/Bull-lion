"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="workshop">
      <main className="machine-wrap">
        <section className="cabinet error-card">
          <h1 className="plate-title">The works jammed</h1>
          <p className="fine-print">
            The cabinet failed to render. Give the crank another turn.
          </p>
          <Button className="assay-trigger" onClick={() => reset()}>
            Try the crank again
          </Button>
        </section>
      </main>
    </div>
  );
}
