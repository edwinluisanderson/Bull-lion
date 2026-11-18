"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { DELETE_AHOOGA_EVERY_MS, playDeleteAhooga, stopDeleteAhooga } from "@/lib/delete-alarm";
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
import {
  SWIPE_REVEAL_PX,
  clampSwipe,
  leverTapDeletes,
  lockSwipeAxis,
  settleSwipe,
  type SwipeAxis,
} from "@/lib/swipe-delete";

export function SwipeCard({
  id,
  label,
  open,
  locked = false,
  cover = "row",
  coverShift = 0,
  shell = null,
  leaving = false,
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
  /** Last-card collapse: an explicit height that then eases to zero. */
  shell?: { height: number; marginTop: number } | null;
  /** The parent has accepted this row's delete, so the face shoots off. */
  leaving?: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
  onDepart: () => void;
  children: ReactNode;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const phase = useRef<LockDrag>(freshLockDrag(0));
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
  const shown = dragging || leaving ? offset : open ? SWIPE_REVEAL_PX : 0;

  const alarmLive = cardAlarmLive(open, dragging, leaving);

  useEffect(() => {
    if (!leaving) return;
    stopDeleteAhooga();
    playSwipeTone("clunk");
  }, [leaving]);

  useEffect(() => {
    if (!alarmLive) return;
    let alive = true;
    const blast = () => {
      if (alive) void playDeleteAhooga();
    };
    blast();
    const timer = window.setInterval(blast, DELETE_AHOOGA_EVERY_MS);
    const onHide = () => {
      if (document.visibilityState !== "visible") stopDeleteAhooga();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
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
    unlockAppAudio();
    if (locked || event.button !== 0) return;
    phase.current = freshLockDrag(open ? SWIPE_REVEAL_PX : 0);
    drag.current = {
      pointer: event.pointerId,
      axis: "undecided",
      startX: event.clientX,
      startY: event.clientY,
      origin: open ? SWIPE_REVEAL_PX : 0,
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
    const next = clampSwipe(state.origin + dx);
    const moved = lockDragMoved(phase.current, next);
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
    const end = settleSwipe(state.offset);
    const settled = lockDragSettled(phase.current, end);
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

  return (
    <li
      className={`stack-swipe${shown > 0 || leaving ? " is-raised" : ""}${leaving ? " is-departing" : ""}${cover === "arm" || cover === "over" || shell ? " is-remnant" : ""}${cover === "arm" || cover === "over" ? " is-cover-ready" : ""}${cover === "over" ? " is-covering" : ""}${cover === "front" ? " is-cover-front" : ""}${shell ? " is-collapsing" : ""}`}
      data-swipe-id={id}
      data-open={open ? "true" : "false"}
      data-alarm={alarm}
      style={{
        ["--reveal" as string]: `${SWIPE_REVEAL_PX}px`,
        ["--swipe" as string]: `${shown}px`,
        ["--cover" as string]: cover === "arm" || cover === "over" ? `${coverShift}px` : undefined,
        height: shell ? `${shell.height}px` : undefined,
        marginTop: shell ? `${shell.marginTop}px` : undefined,
      }}
    >
      {alarm === "open" ? <div className="delete-alarm-glow" aria-hidden="true" /> : null}
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
          <span className="delete-beam" aria-hidden="true" />
          <span className="delete-amber" aria-hidden="true" />
          <span className="stack-swipe-push" />
        </span>
      </button>
      <div
        className={dragging ? "stack-swipe-face is-dragging" : "stack-swipe-face"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onKeyDown={(event) => {
          if (event.key !== "Delete" && event.key !== "Backspace") return;
          event.preventDefault();
          depart();
        }}
        tabIndex={0}
        aria-keyshortcuts="Delete"
      >
        {children}
      </div>
    </li>
  );
}
