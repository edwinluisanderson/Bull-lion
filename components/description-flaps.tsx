"use client";

import { useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

import { SplitFlap } from "@/components/split-flap";
import { cursorFromTap } from "@/lib/flap-edit";

function flapTapIndex(event: ReactPointerEvent<HTMLDivElement>, cap: number): number {
  const tile = event.target instanceof Element ? event.target.closest("[data-flap-index]") : null;
  const raw = tile instanceof HTMLElement ? Number(tile.dataset.flapIndex) : Number.NaN;
  const rect = event.currentTarget.getBoundingClientRect();
  return cursorFromTap(Number.isFinite(raw) ? raw : null, event.clientX - rect.left, rect.width, cap);
}

/**
 * The description flaps are the editor. A hidden field only summons the phone keyboard.
 * Enter blurs, and blur saves. Escape drops the edit.
 */
export function DescriptionFlaps({
  label,
  text,
  cap,
  active,
  cursor,
  instant,
  style,
  onActivate,
  onMove,
  onType,
  onBackspace,
  onPaste,
  onCommit,
  onCancel,
}: {
  label: string;
  text: string;
  cap: number;
  active: boolean;
  cursor: number;
  instant: boolean;
  style?: CSSProperties;
  onActivate: (index: number) => void;
  onMove: (index: number) => void;
  onType: (raw: string) => void;
  onBackspace: () => void;
  onPaste: (raw: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const swallowed = useRef(false);
  const blurTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(blurTimer.current), []);

  function markSwallowed() {
    swallowed.current = true;
    window.setTimeout(() => {
      swallowed.current = false;
    }, 0);
  }

  function point(event: ReactPointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    const index = flapTapIndex(event, cap);
    if (inputRef.current && document.activeElement === inputRef.current) {
      event.preventDefault();
      onMove(index);
      return;
    }
    onActivate(index);
  }

  return (
    <div
      className="stack-edit"
      style={style}
      data-editing={active ? "true" : "false"}
      aria-label={active ? undefined : `Edit description, ${label}`}
      onPointerDown={point}
      onPointerUp={(event) => {
        event.stopPropagation();
        inputRef.current?.focus({ preventScroll: true });
      }}
    >
      <SplitFlap text={text} width={cap} instant={active ? false : instant} cursor={active ? cursor : null} />
      <input
        ref={inputRef}
        className="stack-key"
        style={{ fontSize: "16px" }}
        aria-label={`Description for ${label}`}
        tabIndex={-1}
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        inputMode="text"
        onPointerDown={(event) => event.stopPropagation()}
        onPaste={(event) => {
          event.preventDefault();
          event.stopPropagation();
          markSwallowed();
          onPaste(event.clipboardData.getData("text"));
        }}
        onBeforeInput={(event) => {
          event.stopPropagation();
          const native = event.nativeEvent as InputEvent;
          const kind = native.inputType;
          if (kind === "insertText" || kind === "insertCompositionText" || kind === "insertFromPaste") {
            event.preventDefault();
            if (swallowed.current) return;
            markSwallowed();
            if (kind === "insertFromPaste") onPaste(native.data ?? "");
            else onType(native.data ?? "");
            return;
          }
          if (kind === "deleteContentBackward" || kind === "deleteContentForward") {
            event.preventDefault();
            if (swallowed.current) return;
            markSwallowed();
            onBackspace();
          }
        }}
        onChange={(event) => {
          const value = event.currentTarget.value;
          event.currentTarget.value = "";
          if (swallowed.current || !value) return;
          markSwallowed();
          onType(value);
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
            event.currentTarget.blur();
            return;
          }
          if (event.key === "Unidentified" || event.keyCode === 229) return;
          if (event.key === "Backspace" || event.key === "Delete" || event.keyCode === 8 || event.keyCode === 46) {
            event.preventDefault();
            if (swallowed.current) return;
            markSwallowed();
            onBackspace();
          }
        }}
        onBlur={() => {
          const field = inputRef.current;
          window.clearTimeout(blurTimer.current);
          blurTimer.current = window.setTimeout(() => {
            if (field && document.activeElement === field) return;
            onCommit();
          }, 0);
        }}
      />
    </div>
  );
}
