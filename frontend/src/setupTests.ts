import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;
let consoleWarnSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error");
  consoleWarnSpy = vi.spyOn(console, "warn");
});

afterEach(() => {
  if (consoleErrorSpy && consoleErrorSpy.mock.calls.length > 0) {
    const impl = consoleErrorSpy.getMockImplementation();
    if (!impl) {
      const calls = consoleErrorSpy.mock.calls;
      consoleErrorSpy.mockRestore();
      throw new Error(
        `Unexpected console.error (${calls.length} call(s)). ` +
          `First call: ${JSON.stringify(calls[0])}. ` +
          `Use suppressConsoleError() from test/helpers to allow expected errors.`,
      );
    }
  }
  consoleErrorSpy?.mockRestore();

  if (consoleWarnSpy && consoleWarnSpy.mock.calls.length > 0) {
    const impl = consoleWarnSpy.getMockImplementation();
    if (!impl) {
      const calls = consoleWarnSpy.mock.calls;
      consoleWarnSpy.mockRestore();
      throw new Error(
        `Unexpected console.warn (${calls.length} call(s)). ` +
          `First call: ${JSON.stringify(calls[0])}. ` +
          `Use suppressConsoleWarn() from test/helpers to allow expected warnings.`,
      );
    }
  }
  consoleWarnSpy?.mockRestore();
});

if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth")?.get) {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      return 800;
    },
  });
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}

    observe() {
      this.callback([], this as unknown as ResizeObserver);
    }

    unobserve() {}

    disconnect() {}
  };
}

if (!HTMLCanvasElement.prototype.getContext) {
  // no-op
}

HTMLCanvasElement.prototype.getContext = (() =>
  ({}) as CanvasRenderingContext2D) as unknown as HTMLCanvasElement["getContext"];

HTMLElement.prototype.scrollIntoView = () => {};
