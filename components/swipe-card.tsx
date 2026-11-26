"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { DELETE_AHOOGA_EVERY_MS, DELETE_BREATH_MS, breathDelayMs, playDeleteAhooga, stopDeleteAhooga } from "@/lib/delete-alarm";
import { reusedSlotMustSnap } from "@/lib/delete-cover";
import { playSwipeTone } from "@/lib/flap-sound";
import {
  cardAlarmLive,
  freshLockDrag,
  lockDragArmed,
  lockDragMoved,
  lockDragSettled,
  lockOutsideClose,
  playLockCue,
  type LockDrag,
} from "@/lib/lock-sound";
import { unlockAppAudio } from "@/lib/sound-preload";
import { isDeleteIntent } from "@/lib/editor-keys";
import {
  SWIPE_REVEAL_PX,
  clampSwipe,
  leverTapDeletes,
  lockSwipeAxis,
  settleSwipe,
  wellSide,
  type SwipeAxis,
} from "@/lib/swipe-delete";

/** Unlit wire inside the Delete button. It scales with the bulb. */
function DeleteFilament() {
  return (
    <span className="delete-filament" aria-hidden="true">
      <svg viewBox="0 0 32 14">
        <path d="M1 7 L5 1.5 L9 12.5 L13 1.5 L17 12.5 L21 1.5 L25 12.5 L31 7" />
      </svg>
    </span>
  );
}

/** Keys and presses that belong to the description editor, not the card. */
function fromEditor(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest("input, textarea, [contenteditable='true'], .stack-key, .stack-edit, .stack-lock, .stack-metal") != null;
}

export function SwipeCard({
  id,
  label,
  open,
  locked = false,
  cover = "row",
  coverShift = 0,
  shell = null,
  leaving = false,
  winch = false,
  paying = false,
  lowering = false,
  hanging = false,
  rising = false,
  reelCard = false,
  onOpen,
  onClose,
  onDelete,
  onDepart,
  children,
}: {
  id: string;
  label: string;
  open: boolean;
  locked?: boolean;
  /** "arm" readies the slot, "over" pulls the rows up across it, "front" paints a row above it. */
  cover?: "row" | "arm" | "over" | "front";
  coverShift?: number;
  /** The empty plate collapses upward. `lift` is how far that plate has been pulled. */
  shell?: { height: number; marginTop: number; marginBottom?: number; lift?: number } | null;
  /** The parent has accepted this row's delete, so the face shoots off. */
  leaving?: boolean;
  /** This card is reeling in the chain under it. */
  winch?: boolean;
  /** The new card is still sliding out from behind the name plate. */
  paying?: boolean;
  /** The stack is easing down to make room for this card. */
  lowering?: boolean;
  /** This row hangs from the plate above, so it owns the link threaded into that plate. */
  hanging?: boolean;
  /** This row is sliding up with a delete. The deleted row is the reel card. */
  rising?: boolean;
  reelCard?: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
  onDepart: () => void;
  children: ReactNode;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [reveal, setReveal] = useState(SWIPE_REVEAL_PX);
  const [glowPoint, setGlowPoint] = useState<{ x: number; y: number; r: number } | null>(null);
  const breathStart = useRef<number | null>(null);
  const breathAligned = useRef(false);
  const phase = useRef<LockDrag>(freshLockDrag(0));
  const cardRef = useRef<HTMLLIElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef(SWIPE_REVEAL_PX);
  const prevId = useRef(id);
  const prevLeaving = useRef(leaving);
  const drag = useRef({
    pointer: -1,
    axis: "undecided" as SwipeAxis,
    startX: 0,
    startY: 0,
    origin: 0,
    lastX: 0,
    lastT: 0,
    velocity: 0,
    offset: 0,
    endedAt: Number.NEGATIVE_INFINITY,
  });
  const shown = dragging || leaving ? offset : open ? reveal : 0;

  /** Card base well height: the Card minus the Card base ring. That side is the swipe stop. */
  function readWell(): number {
    const card = cardRef.current;
    if (!card) return revealRef.current;
    const raw = getComputedStyle(card).getPropertyValue("--open-y");
    let ring = parseFloat(raw);
    if (!Number.isFinite(ring)) {
      const board = card.querySelector(".stack-card");
      ring = board instanceof HTMLElement ? parseFloat(getComputedStyle(board).borderTopWidth) : 6;
    }
    const side = wellSide(card.getBoundingClientRect().height, ring, revealRef.current);
    revealRef.current = side;
    return side;
  }

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || typeof ResizeObserver === "undefined") return;
    const publish = () => {
      const side = readWell();
      setReveal((current) => (Math.abs(current - side) < 0.05 ? current : side));
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(card);
    const board = card.querySelector(".stack-card");
    if (board instanceof HTMLElement) observer.observe(board);
    return () => observer.disconnect();
  }, []);

  const alarmLive = cardAlarmLive(open, dragging, leaving);

  useEffect(() => {
    if (!leaving) return;
    stopDeleteAhooga();
    playSwipeTone("clunk");
  }, [leaving]);

  useLayoutEffect(() => {
    const face = faceRef.current;
    const snap = reusedSlotMustSnap(prevId.current, id, prevLeaving.current, leaving);
    prevId.current = id;
    prevLeaving.current = leaving;
    if (!face || !snap) return;
    setOffset(0);
    setDragging(false);
    drag.current.offset = 0;
    drag.current.pointer = -1;
    drag.current.axis = "undecided";
    face.style.transition = "none";
    face.style.transform = "translateX(0px)";
    void face.offsetWidth;
    face.style.transition = "";
    face.style.transform = "";
  }, [id, leaving]);

  useLayoutEffect(() => {
    if (!alarmLive) return;
    const root = document.documentElement;
    const startedAt = performance.now();
    breathStart.current = startedAt;
    breathAligned.current = false;
    root.style.setProperty("--breath-ms", `${DELETE_BREATH_MS}ms`);
    root.style.setProperty("--breath-delay", `${breathDelayMs(startedAt, performance.now())}ms`);
    root.dataset.breathStart = String(startedAt);
    let alive = true;
    let timer = 0;
    const blast = () => {
      if (alive) void playDeleteAhooga();
    };
    const arm = (index: number) => {
      const due = startedAt + index * DELETE_AHOOGA_EVERY_MS;
      timer = window.setTimeout(() => {
        blast();
        if (alive) arm(index + 1);
      }, Math.max(0, due - performance.now()));
    };
    blast();
    arm(1);
    const onHide = () => {
      if (document.visibilityState !== "visible") stopDeleteAhooga();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onHide);
      root.style.removeProperty("--breath-ms");
      root.style.removeProperty("--breath-delay");
      delete root.dataset.breathStart;
      breathStart.current = null;
      breathAligned.current = false;
      stopDeleteAhooga();
    };
  }, [alarmLive]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const node = document.querySelector(`[data-swipe-id="${CSS.escape(id)}"]`);
      if (node && event.target instanceof Node && node.contains(event.target)) return;
      const cue = lockOutsideClose(true, drag.current.pointer !== -1);
      if (cue) playLockCue(cue);
      onClose();
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [id, open, onClose]);

  function reduced(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (fromEditor(event.target)) return;
    unlockAppAudio();
    if (locked || event.button !== 0) return;
    const side = readWell();
    setReveal((current) => (Math.abs(current - side) < 0.05 ? current : side));
    phase.current = freshLockDrag(open ? side : 0);
    drag.current = {
      pointer: event.pointerId,
      axis: "undecided",
      startX: event.clientX,
      startY: event.clientY,
      origin: open ? side : 0,
      lastX: event.clientX,
      lastT: event.timeStamp,
      velocity: 0,
      offset: open ? SWIPE_REVEAL_PX : 0,
      endedAt: drag.current.endedAt,
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (state.pointer !== event.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (state.axis === "undecided") {
      state.axis = lockSwipeAxis(dx, dy);
      if (state.axis !== "drag") return;
      const armed = lockDragArmed(phase.current);
      phase.current = armed.drag;
      if (armed.cue) playLockCue(armed.cue);
      setOffset(phase.current.offset);
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (state.axis !== "drag") return;
    const dt = Math.max(1, event.timeStamp - state.lastT);
    state.velocity = (event.clientX - state.lastX) / dt;
    state.lastX = event.clientX;
    state.lastT = event.timeStamp;
    const next = clampSwipe(state.origin + dx, revealRef.current);
    const moved = lockDragMoved(phase.current, next, revealRef.current);
    phase.current = moved.drag;
    if (moved.cue) playLockCue(moved.cue);
    state.offset = next;
    setOffset(next);
  }

  function finish(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (state.pointer !== event.pointerId) return;
    const axis = state.axis;
    state.pointer = -1;
    state.axis = "undecided";
    setDragging(false);
    if (axis === "drag") state.endedAt = performance.now();
    if (axis !== "drag") {
      if (open && axis === "undecided") onClose();
      return;
    }
    const end = settleSwipe(state.offset, revealRef.current);
    const settled = lockDragSettled(phase.current, end, revealRef.current);
    phase.current = settled.drag;
    if (settled.cue) playLockCue(settled.cue);
    if (end === "open") onOpen();
    else onClose();
  }

  function depart() {
    if (leaving) return;
    if (reduced()) {
      stopDeleteAhooga();
      playSwipeTone("clunk");
      onDelete();
      return;
    }
    onDepart();
  }

  function onLeverClick() {
    if (!leverTapDeletes(performance.now() - drag.current.endedAt)) return;
    depart();
  }

  const alarm = leaving ? "off" : dragging && offset > 0 ? "drag" : open && !dragging ? "open" : "off";

  useLayoutEffect(() => {
    if (alarm !== "open") {
      setGlowPoint((current) => (current == null ? current : null));
      return;
    }
    const card = cardRef.current;
    const button = card?.querySelector(".stack-swipe-delete");
    if (!(button instanceof HTMLElement) || !card) return;
    const place = () => {
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const bulb = button.querySelector(".stack-swipe-push");
      let radius = 0;
      if (bulb instanceof HTMLElement) {
        const box = bulb.getBoundingClientRect();
        const ring = getComputedStyle(bulb).boxShadow.match(/0px 0px 0px ([0-9.]+)px/);
        const spread = ring ? Number(ring[1]) : 0;
        radius = box.width / 2 + spread;
      }
      setGlowPoint((current) => {
        if (
          current &&
          Math.abs(current.x - x) < 0.5 &&
          Math.abs(current.y - y) < 0.5 &&
          Math.abs(current.r - radius) < 0.5
        ) return current;
        return { x, y, r: radius };
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(button);
    observer.observe(card);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    const viewport = window.visualViewport;
    viewport?.addEventListener("scroll", place);
    viewport?.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      viewport?.removeEventListener("scroll", place);
      viewport?.removeEventListener("resize", place);
    };
  }, [alarm]);

  useLayoutEffect(() => {
    if (alarm !== "open" || breathAligned.current) return;
    const startedAt = breathStart.current;
    if (startedAt == null) return;
    let frame = 0;
    const align = () => {
      if (breathAligned.current) return;
      const glow = document.querySelector(".delete-screen-glow");
      const nodes = [
        glow,
        cardRef.current?.querySelector(".delete-filament"),
        cardRef.current?.querySelector(".delete-bulb-core"),
      ];
      const glowAnim = glow instanceof Element ? glow.getAnimations()[0] : undefined;
      if (!glowAnim) {
        frame = requestAnimationFrame(align);
        return;
      }
      for (const node of nodes) {
        if (!(node instanceof Element)) continue;
        for (const anim of node.getAnimations()) {
          try {
            anim.startTime = startedAt;
          } catch {
            /* A finished animation can refuse a new start. */
          }
        }
      }
      breathAligned.current = true;
    };
    align();
    return () => cancelAnimationFrame(frame);
  }, [alarm, glowPoint]);

  return (
    <li
      ref={cardRef}
      className={`stack-swipe${shown > 0 || leaving ? " is-raised" : ""}${leaving ? " is-departing" : ""}${paying ? " is-paying" : ""}${lowering ? " is-lowering" : ""}${cover === "arm" || cover === "over" || shell ? " is-remnant" : ""}${cover === "arm" || cover === "over" ? " is-cover-ready" : ""}${cover === "over" ? " is-covering" : ""}${cover === "front" ? " is-cover-front" : ""}${shell ? " is-collapsing is-reeled" : ""}${rising ? " is-rising" : ""}${reelCard ? " is-reel-card" : ""}`}
      data-swipe-id={id}
      data-open={open ? "true" : "false"}
      data-alarm={alarm}
      data-winch={winch ? "card" : undefined}
      style={{
        ["--reveal" as string]: `${reveal}px`,
        ["--swipe" as string]: `${shown}px`,
        ["--cover" as string]: cover === "arm" || cover === "over" ? `${coverShift}px` : undefined,
        ["--reel" as string]: shell ? `${shell.lift && shell.lift > 0 ? shell.lift + shell.height : shell.height}px` : undefined,
        ["--lift" as string]: shell ? `${shell.lift ?? 0}px` : undefined,
        height: shell ? `${shell.height}px` : undefined,
        marginTop: shell ? `${shell.marginTop}px` : undefined,
        marginBottom: shell?.marginBottom ? `${shell.marginBottom}px` : undefined,
      }}
    >
      {hanging ? (
        <>
          <span className="mock-link is-left" aria-hidden="true" />
          <span className="mock-link is-right" aria-hidden="true" />
        </>
      ) : null}
      <span className="mock-plate" aria-hidden="true" />
      <span className="mock-slot" aria-hidden="true" />
      <span className="mock-glow" aria-hidden="true" />
      <span className="mock-hole is-top is-left" aria-hidden="true" />
      <span className="mock-hole is-top is-right" aria-hidden="true" />
      <span className="mock-hole is-bottom is-left" aria-hidden="true" />
      <span className="mock-hole is-bottom is-right" aria-hidden="true" />
      <span className="stack-empty-plate" aria-hidden="true" />
      <button
        type="button"
        className="stack-swipe-delete"
        aria-label={`Delete ${label}`}
        onPointerUp={(event) => {
          if (leverTapDeletes(performance.now() - drag.current.endedAt)) return;
          event.preventDefault();
        }}
        onClick={onLeverClick}
      >
        <span className="stack-swipe-plate" aria-hidden="true">
          {/* saved for settings tray: lighthouse beams (.delete-beam) stay in CSS and are not mounted. */}
          <span className="delete-amber" aria-hidden="true" />
          <span className="stack-swipe-push">
            <span className="delete-bulb-core" aria-hidden="true" />
            <DeleteFilament />
          </span>
        </span>
      </button>
      <div className={`stack-swipe-window${paying || lowering ? " is-masked" : ""}`}>
        <div
          ref={faceRef}
          className={dragging ? "stack-swipe-face is-dragging" : "stack-swipe-face"}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finish}
          onPointerCancel={finish}
          onKeyDown={(event) => {
            if (fromEditor(event.target) || fromEditor(document.activeElement)) return;
            if (event.key !== "Backspace" && event.key !== "Delete") return;
            event.preventDefault();
            event.stopPropagation();
          }}
          onBeforeInput={(event) => {
            if (fromEditor(event.target)) return;
            const inputType = (event.nativeEvent as InputEvent).inputType;
            if (inputType !== "deleteContentBackward" && inputType !== "deleteContentForward") return;
            event.preventDefault();
          }}
          tabIndex={0}
        >
          {children}
        </div>
      </div>
      {alarm === "open" && glowPoint
        ? createPortal(
            <div
              className="delete-screen-glow"
              style={{
                ["--glow-x" as string]: `${glowPoint.x}px`,
                ["--glow-y" as string]: `${glowPoint.y}px`,
                ["--glow-r" as string]: `${glowPoint.r}px`,
              }}
              aria-hidden="true"
            />,
            document.body,
          )
        : null}
    </li>
  );
}
