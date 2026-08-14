import { describe, expect, it } from "vitest";
import { createScaledClock, DEFAULT_SLOW_FACTOR, MAX_SLOW_FACTOR, resolveTimeScale } from "./debug";

describe("resolveTimeScale", () => {
  it("runs at full speed without a slow parameter", () => {
    expect(resolveTimeScale("")).toBe(1);
    expect(resolveTimeScale("?layout=left")).toBe(1);
  });

  it("divides the timeline speed by the requested factor", () => {
    expect(resolveTimeScale("?slow=8")).toBeCloseTo(0.125);
    expect(resolveTimeScale("?slow=2")).toBeCloseTo(0.5);
    expect(resolveTimeScale("?slow=10&layout=left")).toBeCloseTo(0.1);
  });

  it("applies a default factor when the value is omitted", () => {
    expect(resolveTimeScale("?slow")).toBeCloseTo(1 / DEFAULT_SLOW_FACTOR);
    expect(resolveTimeScale("?slow=")).toBeCloseTo(1 / DEFAULT_SLOW_FACTOR);
  });

  it("accepts fractional factors", () => {
    expect(resolveTimeScale("?slow=1.5")).toBeCloseTo(1 / 1.5);
  });

  it("clamps the factor to a usable range", () => {
    expect(resolveTimeScale(`?slow=${MAX_SLOW_FACTOR * 10}`)).toBeCloseTo(1 / MAX_SLOW_FACTOR);
    expect(resolveTimeScale("?slow=0.25")).toBe(1);
  });

  it("ignores values that are not positive numbers", () => {
    expect(resolveTimeScale("?slow=0")).toBe(1);
    expect(resolveTimeScale("?slow=-4")).toBe(1);
    expect(resolveTimeScale("?slow=fast")).toBe(1);
    expect(resolveTimeScale("?slow=NaN")).toBe(1);
    expect(resolveTimeScale("?slow=Infinity")).toBe(1);
  });
});

describe("createScaledClock", () => {
  it("starts on the first timestamp so the emitter delta stays small", () => {
    const clock = createScaledClock(0.25);
    expect(clock(1000)).toBe(1000);
  });

  it("advances by the scaled elapsed time", () => {
    const clock = createScaledClock(0.25);
    clock(1000);
    expect(clock(1100)).toBeCloseTo(1025);
    expect(clock(1200)).toBeCloseTo(1050);
  });

  it("passes real time through at full speed", () => {
    const clock = createScaledClock(1);
    clock(500);
    expect(clock(516)).toBeCloseTo(516);
    expect(clock(532)).toBeCloseTo(532);
  });
});
