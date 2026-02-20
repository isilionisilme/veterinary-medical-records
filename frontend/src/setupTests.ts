import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
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

HTMLCanvasElement.prototype.getContext =
  ((() => ({}) as CanvasRenderingContext2D) as unknown as HTMLCanvasElement["getContext"]);

HTMLElement.prototype.scrollIntoView = () => {};
