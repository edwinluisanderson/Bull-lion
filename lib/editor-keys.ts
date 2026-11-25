/** A key or input event that would remove a card if it reached the card face. */
export type EditorKey = {
  key?: string;
  keyCode?: number;
  inputType?: string;
};

export type EditorTarget = {
  tagName?: string;
  isContentEditable?: boolean;
};

const EDITOR_TAGS = new Set(["input", "textarea"]);

/** True when the event started in a text field, including a contenteditable. */
export function isTextEditingTarget(target: EditorTarget | null | undefined): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  return EDITOR_TAGS.has((target.tagName ?? "").toLowerCase());
}

/** Desktop Backspace/Delete, plus the Android soft keyboard's composition delete. */
export function isDeleteIntent(event: EditorKey): boolean {
  const key = event.key ?? "";
  if (key === "Backspace" || key === "Delete" || key === "Unidentified") return true;
  if (event.keyCode === 8 || event.keyCode === 46 || event.keyCode === 229) return true;
  return event.inputType === "deleteContentBackward" || event.inputType === "deleteContentForward";
}

/** Card-level handlers must ignore this event. The field owns it. */
export function swallowCardDelete(target: EditorTarget | null | undefined, event: EditorKey): boolean {
  return isTextEditingTarget(target) && isDeleteIntent(event);
}

/** Backspace in an empty field still must not fall through to deleting the card. */
export function blockEmptyEditorDelete(value: string, event: EditorKey): boolean {
  return value.length === 0 && isDeleteIntent(event);
}
