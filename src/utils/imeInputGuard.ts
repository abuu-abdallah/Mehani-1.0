/**
 * Global IME / Gboard Arabic input stabilization for Android WebView & React controlled inputs.
 *
 * Ensures:
 * 1. Background polling / snapshot refreshes pause while the user is focused on or actively composing
 *    in any text input, textarea, or contentEditable field.
 * 2. When Gboard commits text on compositionend / suggestion selection / spacebar or blur without a
 *    matching native `input` event (or React's _valueTracker lags behind the DOM value), an `input`
 *    event is dispatched synchronously so React controlled state receives the full multi-word string.
 * 3. Before any form submission executes, any active editable fields inside the form are checked and
 *    flushed cleanly so trailing Arabic composing words are never lost on Save/Submit.
 */

type TextEditable = HTMLInputElement | HTMLTextAreaElement;

interface ReactTrackedElement extends HTMLElement {
  _valueTracker?: {
    getValue?: () => string;
    setValue?: (value: string) => void;
  };
}

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'submit',
  'reset',
  'checkbox',
  'radio',
  'file',
  'image',
  'range',
  'color',
  'hidden',
]);

let installed = false;
let isComposing = false;
let activeComposingElement: TextEditable | null = null;
let lastInputTimestamp = 0;

const lastDispatchedValues = new WeakMap<TextEditable, string>();
const syntheticDispatching = new WeakSet<TextEditable>();
const reSubmittingForms = new WeakSet<HTMLFormElement>();

export function isTextEditableElement(target: EventTarget | Element | null): target is TextEditable {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement) {
    return !target.readOnly && !target.disabled;
  }
  if (target instanceof HTMLInputElement) {
    if (target.readOnly || target.disabled) return false;
    const type = (target.type || 'text').toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(type);
  }
  return false;
}

export function isEditableElementFocused(): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active || !(active instanceof HTMLElement)) return false;
  if (isTextEditableElement(active)) return true;
  return active.isContentEditable;
}

export function isUserActivelyTypingOrComposing(): boolean {
  if (isComposing || isEditableElementFocused()) return true;
  return Date.now() - lastInputTimestamp < 2500;
}

function syncElementToReactIfNeeded(el: TextEditable): boolean {
  if (syntheticDispatching.has(el)) return false;

  const domValue = el.value;
  const trackedValue = (el as ReactTrackedElement)._valueTracker?.getValue?.();
  const hasTrackedMismatch = typeof trackedValue === 'string' && trackedValue !== domValue;
  const hasLastMismatch = lastDispatchedValues.has(el) && lastDispatchedValues.get(el) !== domValue;

  if (!hasTrackedMismatch && !hasLastMismatch) {
    lastDispatchedValues.set(el, domValue);
    return false;
  }

  lastDispatchedValues.set(el, domValue);
  syntheticDispatching.add(el);
  try {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  } finally {
    syntheticDispatching.delete(el);
  }
}

export function installImeInputGuard(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  document.addEventListener(
    'compositionstart',
    (e) => {
      isComposing = true;
      lastInputTimestamp = Date.now();
      if (isTextEditableElement(e.target)) {
        activeComposingElement = e.target;
        if (!lastDispatchedValues.has(e.target)) {
          lastDispatchedValues.set(e.target, e.target.value);
        }
      }
    },
    true
  );

  document.addEventListener(
    'compositionupdate',
    () => {
      isComposing = true;
      lastInputTimestamp = Date.now();
    },
    true
  );

  document.addEventListener(
    'input',
    (e) => {
      if (!isTextEditableElement(e.target)) return;
      if (syntheticDispatching.has(e.target)) return;
      lastInputTimestamp = Date.now();
      lastDispatchedValues.set(e.target, e.target.value);
    },
    true
  );

  document.addEventListener(
    'compositionend',
    (e) => {
      isComposing = false;
      lastInputTimestamp = Date.now();
      const target = e.target;
      if (!isTextEditableElement(target)) {
        activeComposingElement = null;
        return;
      }
      if (activeComposingElement === target) {
        activeComposingElement = null;
      }
      syncElementToReactIfNeeded(target);
      queueMicrotask(() => {
        if (document.contains(target)) {
          syncElementToReactIfNeeded(target);
        }
      });
    },
    true
  );

  document.addEventListener(
    'change',
    (e) => {
      if (!isTextEditableElement(e.target)) return;
      syncElementToReactIfNeeded(e.target);
    },
    true
  );

  document.addEventListener(
    'focusout',
    (e) => {
      const target = e.target;
      if (!isTextEditableElement(target)) return;
      if (activeComposingElement === target) {
        isComposing = false;
        activeComposingElement = null;
      }
      syncElementToReactIfNeeded(target);
    },
    true
  );

  document.addEventListener(
    'submit',
    (e) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;

      if (reSubmittingForms.has(form)) {
        reSubmittingForms.delete(form);
        return;
      }

      let flushedAny = false;
      const controls = form.querySelectorAll('input, textarea');
      controls.forEach((node) => {
        if (isTextEditableElement(node) && syncElementToReactIfNeeded(node)) {
          flushedAny = true;
        }
      });

      if (flushedAny) {
        // Allow React 1 frame to commit the synced state before invoking onSubmit
        e.preventDefault();
        e.stopImmediatePropagation();
        const submitter = (e as SubmitEvent).submitter instanceof HTMLElement ? (e as SubmitEvent).submitter : null;
        reSubmittingForms.add(form);
        window.requestAnimationFrame(() => {
          if (!document.contains(form)) {
            reSubmittingForms.delete(form);
            return;
          }
          if (typeof form.requestSubmit === 'function') {
            form.requestSubmit(submitter || undefined);
          } else {
            reSubmittingForms.delete(form);
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          }
        });
      }
    },
    true
  );
}
