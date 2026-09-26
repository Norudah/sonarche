// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useNewJobIds } from "@/features/download/queue/useNewJobIds";

describe("useNewJobIds", () => {
  it("treats the jobs of the first render as history", () => {
    const { result } = renderHook(({ ids }) => useNewJobIds(ids), { initialProps: { ids: ["a", "b"] } });
    expect([...result.current]).toEqual([]);
  });

  it("flags jobs that arrive later", () => {
    const { result, rerender } = renderHook(({ ids }) => useNewJobIds(ids), { initialProps: { ids: ["a"] } });
    rerender({ ids: ["b", "a"] });
    expect([...result.current]).toEqual(["b"]);
  });

  it("keeps a job flagged after it leaves the list", () => {
    const { result, rerender } = renderHook(({ ids }) => useNewJobIds(ids), { initialProps: { ids: ["a"] } });
    rerender({ ids: ["b", "a"] });
    rerender({ ids: ["a"] });
    rerender({ ids: ["c", "a"] });
    expect([...result.current].sort()).toEqual(["b", "c"]);
  });

  it("keeps its identity while nothing new arrives", () => {
    const { result, rerender } = renderHook(({ ids }) => useNewJobIds(ids), { initialProps: { ids: ["a"] } });
    rerender({ ids: ["b", "a"] });
    const flagged = result.current;
    rerender({ ids: ["b", "a"] });
    expect(result.current).toBe(flagged);
  });
});
