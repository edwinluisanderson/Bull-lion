/** A pointer event the reel gesture follows. Tests can send a plain object. */
export type ReelPointerEvent = {
  type?: string;
  button?: number;
  pointerId: number;
  clientY: number;
  timeStamp: number;
  cancelable?: boolean;
  preventDefault?: () => void;
};

export type ReelPointerHost = {
  focus(options?: { preventScroll?: boolean }): void;
  blur(): void;
  getBoundingClientRect(): { top: number; height: number };
  setPointerCapture?(pointerId: number): void;
  releasePointerCapture?(pointerId: number): void;
  hasPointerCapture?(pointerId: number): boolean;
};

export type ReelPointerEngine = {
  pointerDown(y: number, time: number, localY?: number, height?: number): void;
  pointerMove(y: number, time: number): void;
  pointerUp(): void;
};

/**
 * Follow one finger on a reel.
 * `lostpointercapture` during setPointerCapture is the browser handing the
 * pointer over, not the finger leaving, so it does not end the gesture.
 * A later loss or a pointercancel does end it, which keeps the reel from
 * sitting in a drag with no listeners.
 */
export function beginReelPointer(input: {
  event: ReelPointerEvent;
  host: ReelPointerHost;
  engine: ReelPointerEngine | null;
  add(type: string, listener: (event: ReelPointerEvent) => void): void;
  remove(type: string, listener: (event: ReelPointerEvent) => void): void;
  onType?: (type: string) => void;
}): void {
  const { event, host, engine } = input;
  if (event.button !== undefined && event.button !== 0) return;
  input.onType?.("pointerdown");
  if (event.cancelable) event.preventDefault?.();
  host.focus({ preventScroll: true });
  const bounds = host.getBoundingClientRect();
  const pointerId = event.pointerId;
  let closed = false;
  let captureArmed = false;
  const endGesture = (type: string) => {
    if (closed) return;
    closed = true;
    input.onType?.(type);
    input.remove("pointermove", onMove);
    input.remove("pointerup", onUp);
    input.remove("pointercancel", onUp);
    input.remove("lostpointercapture", onLost);
    if (host.hasPointerCapture?.(pointerId)) {
      try {
        host.releasePointerCapture?.(pointerId);
      } catch {
        /* The pointer is already gone. */
      }
    }
    engine?.pointerUp();
    host.blur();
  };
  const onMove = (moveEvent: ReelPointerEvent) => {
    if (moveEvent.pointerId !== pointerId) return;
    input.onType?.("pointermove");
    if (moveEvent.cancelable) moveEvent.preventDefault?.();
    engine?.pointerMove(moveEvent.clientY, moveEvent.timeStamp);
  };
  const onUp = (upEvent: ReelPointerEvent) => {
    if (upEvent.pointerId !== pointerId) return;
    endGesture(upEvent.type || "pointerup");
  };
  const onLost = (lostEvent: ReelPointerEvent) => {
    if (lostEvent.pointerId !== pointerId) return;
    if (!captureArmed) return;
    endGesture("lostpointercapture");
  };
  input.add("pointermove", onMove);
  input.add("pointerup", onUp);
  input.add("pointercancel", onUp);
  input.add("lostpointercapture", onLost);
  engine?.pointerDown(event.clientY, event.timeStamp, event.clientY - bounds.top, bounds.height);
  try {
    host.setPointerCapture?.(pointerId);
  } catch {
    /* Capture is optional. The window listeners still follow the finger. */
  }
  captureArmed = true;
}
