"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { createPortal } from "react-dom";

import {
  DELETE_AHOOGA_EVERY_MS,
  DELETE_LINGER_MS,
  playDeleteAhooga,
  stopDeleteAhooga,
} from "@/lib/delete-alarm";
import { playSwipeTone } from "@/lib/flap-sound";
import {
  SWIPE_REVEAL_PX,
  clampSwipe,
  crossedDetent,
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
  onOpen,
  onClose,
  onDelete,
  children,
}: {
  id: string;
  label: string;
  open: boolean;
  locked?: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [departing, setDeparting] = useState(false);
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
  const departTimer = useRef(0);
  const shown = dragging || departing ? offset : open ? SWIPE_REVEAL_PX : 0;

  useEffect(() => () => window.clearTimeout(departTimer.current), []);

  useEffect(() => {
    const lockedOpen = open && !dragging && !departing;
    if (!lockedOpen) return;
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
  }, [open, dragging, departing]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const node = document.querySelector(`[data-swipe-id="${id}"]`);
      if (node && event.target instanceof Node && node.contains(event.target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [id, open, onClose]);

  function reduced(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (locked || event.button !== 0) return;
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
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (state.axis !== "drag") return;
    const dt = Math.max(1, event.timeStamp - state.lastT);
    state.velocity = (event.clientX - state.lastX) / dt;
    state.lastX = event.clientX;
    state.lastT = event.timeStamp;
    const next = clampSwipe(state.origin + dx);
    if (!reduced() && crossedDetent(state.offset, next)) playSwipeTone("detent");
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
    if (settleSwipe(state.offset) === "open") onOpen();
    else onClose();
  }

  function depart() {
    if (departing) return;
    stopDeleteAhooga();
    playSwipeTone("clunk");
    if (reduced()) {
      onDelete();
      return;
    }
    setDeparting(true);
    departTimer.current = window.setTimeout(() => onDelete(), DELETE_LINGER_MS);
  }

  function onLeverClick() {
    if (!leverTapDeletes(performance.now() - drag.current.endedAt)) return;
    depart();
  }

  const alarm = departing ? "off" : dragging && offset > 0 ? "drag" : open && !dragging ? "open" : "off";
  const glow =
    alarm === "open" && typeof document !== "undefined"
      ? createPortal(<div className="delete-alarm-glow" aria-hidden="true" />, document.body)
      : null;

  return (
    <li
      className={`stack-swipe${shown > 0 || departing ? " is-raised" : ""}${departing ? " is-departing" : ""}`}
      data-swipe-id={id}
      data-open={open ? "true" : "false"}
      data-alarm={alarm}
      style={{ ["--reveal" as string]: `${SWIPE_REVEAL_PX}px`, ["--swipe" as string]: `${shown}px` }}
    >
      {glow}
      <button
        type="button"
        className="stack-swipe-delete"
        aria-label={`Delete ${label}`}
        onPointerUp={(event) => {
          if (leverTapDeletes(performance.now() - drag.current.endedAt)) return;
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={onLeverClick}
      >
        <span className="stack-swipe-plate" aria-hidden="true">
          <span className="delete-amber">
            <span className="delete-amber-rotor" />
          </span>
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
