/** @vitest-environment jsdom */
import type { MouseEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import { rowPlayHandler } from "@/features/library/tracks/rowPlay";

/**
 * A double-click landing on `html`, as React would deliver it — only `target`
 * is read, so there is no need to build a real event.
 *
 * A `div` and not a `tr`: the guard walks ancestors and does not care that the
 * real thing is a table cell.
 */
function dblClickOn(html: string, selector: string): MouseEvent<HTMLElement> {
  const row = document.createElement("div");
  row.innerHTML = html;
  const target = row.querySelector(selector);
  if (!target) throw new Error(`no ${selector} in fixture`);
  return { target } as unknown as MouseEvent<HTMLElement>;
}

describe("rowPlayHandler", () => {
  it("plays when the double-click lands on the row itself", () => {
    const play = vi.fn();
    rowPlayHandler(play)(dblClickOn("<span>Digital Love</span>", "span"));
    expect(play).toHaveBeenCalledOnce();
  });

  it("stays out of the way when a control was double-clicked", () => {
    const play = vi.fn();
    rowPlayHandler(play)(dblClickOn("<button>menu</button>", "button"));
    expect(play).not.toHaveBeenCalled();
  });

  // The click almost always lands on the icon, not on the button around it —
  // this is the case a naive `event.target.tagName` check would miss.
  it("stays out of the way for an icon inside a control", () => {
    const play = vi.fn();
    rowPlayHandler(play)(dblClickOn("<button><svg></svg></button>", "svg"));
    expect(play).not.toHaveBeenCalled();
  });

  it("stays out of the way on a link", () => {
    const play = vi.fn();
    rowPlayHandler(play)(dblClickOn('<a href="/artist">Daft Punk</a>', "a"));
    expect(play).not.toHaveBeenCalled();
  });
});
