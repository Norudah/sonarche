import { describe, expect, it, vi } from "vitest";

import { createTextFilter } from "@/shared/lib/search";

interface Item {
  label: string;
}

const byLabel = () => createTextFilter<Item>((item) => item.label);

describe("createTextFilter", () => {
  it("requires every term to match somewhere, in any order", () => {
    const filter = byLabel();
    const items = [{ label: "Daft Punk Discovery" }, { label: "Daft Punk Homework" }];

    expect(filter(items, "daft disc")).toEqual([{ label: "Daft Punk Discovery" }]);
    expect(filter(items, "disc daft")).toEqual([{ label: "Daft Punk Discovery" }]);
  });

  it("ignores case and accents", () => {
    const filter = byLabel();

    expect(filter([{ label: "Beyoncé" }], "beyonce")).toHaveLength(1);
    expect(filter([{ label: "Beyonce" }], "BEYONCÉ")).toHaveLength(1);
  });

  it("returns the input array itself when the query is blank", () => {
    // By reference: an empty search is the default state and must not copy the
    // whole library on every render.
    const filter = byLabel();
    const items = [{ label: "anything" }];

    expect(filter(items, "   ")).toBe(items);
  });

  it("builds an item's haystack once, however many queries it is searched by", () => {
    const haystackOf = vi.fn((item: Item) => item.label);
    const filter = createTextFilter<Item>(haystackOf);
    const items = [{ label: "Discovery" }, { label: "Homework" }];

    filter(items, "d");
    filter(items, "o");
    filter(items, "ver");

    expect(haystackOf).toHaveBeenCalledTimes(items.length);
  });

  it("indexes a replacement object rather than serving the old text", () => {
    // The correctness claim behind keying on identity: an edit refetches the
    // library, which mints new objects, so nothing has to invalidate the cache.
    const filter = byLabel();
    const before = { label: "Untitled" };
    filter([before], "untitled");

    const after = { label: "Lucy" };

    expect(filter([after], "lucy")).toEqual([after]);
    expect(filter([after], "untitled")).toEqual([]);
  });
});
