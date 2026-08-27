import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * Minimal React 18 render helper for component tests.
 *
 * The App Router components use `useFormState`/`useFormStatus`, which only
 * exist in the React build Next.js vendors; vitest.config.ts aliases `react`
 * and `react-dom` to that build, so tests mount with it directly rather than
 * through a testing library that resolves its own copy of the renderer.
 */
export function renderComponent(ui: ReactElement): { container: HTMLElement; unmount: () => void } {
  const container = document.createElement("div");
  document.body.appendChild(container);

  let root: Root;
  withActEnvironment(() => {
    root = createRoot(container);
    root.render(ui);
  });

  return {
    container,
    unmount: () => {
      withActEnvironment(() => root.unmount());
      container.remove();
    },
  };
}

export function cleanupRendered(): void {
  document.body.innerHTML = "";
}

/**
 * Mount/unmount inside act(), but leave the flag off while tests fire events:
 * user-event dispatches real DOM events, which React flushes synchronously.
 */
function withActEnvironment(work: () => void): void {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    act(work);
  } finally {
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  }
}
