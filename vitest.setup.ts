import "@testing-library/jest-dom/vitest";

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// The vendored React build exposes createRoot on its root entry point rather
// than on a separate client entry, which React warns about on every mount.
const consoleError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes('importing createRoot from "react-dom"')) {
    return;
  }
  consoleError(...args);
};
