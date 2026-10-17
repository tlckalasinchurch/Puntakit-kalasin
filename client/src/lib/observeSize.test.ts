import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { observeSize } from "./observeSize";

type Entry = { contentRect: { width: number; height: number } };

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;
  constructor(private readonly callback: (entries: Entry[]) => void) {
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  disconnect() {
    this.disconnected = true;
  }
  emit(...sizes: Array<[number, number]>) {
    this.callback(sizes.map(([width, height]) => ({ contentRect: { width, height } })));
  }
}

let frames: Array<{ id: number; run: () => void }> = [];
let nextId = 1;
const flushFrame = () => {
  const due = frames;
  frames = [];
  for (const frame of due) frame.run();
};

const el = {} as Element;

beforeEach(() => {
  FakeResizeObserver.instances = [];
  frames = [];
  nextId = 1;
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.stubGlobal("requestAnimationFrame", (run: () => void) => {
    const id = nextId++;
    frames.push({ id, run });
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames = frames.filter((frame) => frame.id !== id);
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("observeSize", () => {
  it("observes the element it is given", () => {
    observeSize(el, () => {});
    expect(FakeResizeObserver.instances).toHaveLength(1);
    expect(FakeResizeObserver.instances[0].observed).toEqual([el]);
  });

  it("calls back once per frame however many size changes arrive in it", () => {
    const onResize = vi.fn();
    observeSize(el, onResize);
    const observer = FakeResizeObserver.instances[0];
    observer.emit([300, 200]);
    observer.emit([320, 200], [340, 200]);
    observer.emit([360, 200]);
    expect(onResize).not.toHaveBeenCalled();
    flushFrame();
    expect(onResize).toHaveBeenCalledTimes(1);
    observer.emit([380, 200]);
    flushFrame();
    expect(onResize).toHaveBeenCalledTimes(2);
  });

  it("ignores a 0x0 (or one-sided zero) container, e.g. a dialog that is not open yet", () => {
    const onResize = vi.fn();
    observeSize(el, onResize);
    const observer = FakeResizeObserver.instances[0];
    observer.emit([0, 0]);
    observer.emit([0, 300]);
    observer.emit([300, 0]);
    flushFrame();
    expect(onResize).not.toHaveBeenCalled();
    observer.emit([300, 300]);
    flushFrame();
    expect(onResize).toHaveBeenCalledTimes(1);
  });

  it("cleanup disconnects the observer and drops a frame that is still pending", () => {
    const onResize = vi.fn();
    const stop = observeSize(el, onResize);
    const observer = FakeResizeObserver.instances[0];
    observer.emit([300, 200]);
    stop();
    expect(observer.disconnected).toBe(true);
    flushFrame();
    expect(onResize).not.toHaveBeenCalled();
  });

  it("cleanup is safe to call twice", () => {
    const stop = observeSize(el, () => {});
    stop();
    expect(() => stop()).not.toThrow();
  });

  it("does nothing, and does not throw, where ResizeObserver does not exist", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const onResize = vi.fn();
    let stop: () => void = () => {};
    expect(() => {
      stop = observeSize(el, onResize);
    }).not.toThrow();
    expect(() => stop()).not.toThrow();
    expect(onResize).not.toHaveBeenCalled();
  });
});
