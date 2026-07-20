import { describe, expect, it } from "vitest";

import { detectUrlKind } from "@/features/download/urlKind";

describe("detectUrlKind", () => {
  it("rejects anything that is not a parsable URL", () => {
    expect(detectUrlKind("")).toBeNull();
    expect(detectUrlKind("not a url")).toBeNull();
    expect(detectUrlKind("youtube.com/watch?v=abc")).toBeNull(); // no scheme
  });

  it("rejects hosts other than YouTube", () => {
    expect(detectUrlKind("https://vimeo.com/watch?v=abc")).toBeNull();
    expect(detectUrlKind("https://soundcloud.com/artist/track")).toBeNull();
    // Lookalike host: the check must be on the whole hostname, not a substring.
    expect(detectUrlKind("https://youtube.com.evil.test/watch?v=abc")).toBeNull();
  });

  it("accepts the www / m / music subdomains", () => {
    expect(detectUrlKind("https://www.youtube.com/watch?v=abc")).toBe("single");
    expect(detectUrlKind("https://m.youtube.com/watch?v=abc")).toBe("single");
    expect(detectUrlKind("https://music.youtube.com/watch?v=abc")).toBe("single");
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(detectUrlKind("  https://youtube.com/watch?v=abc  ")).toBe("single");
  });

  it("classifies a bare video as a single", () => {
    expect(detectUrlKind("https://youtube.com/watch?v=abc")).toBe("single");
    expect(detectUrlKind("https://youtu.be/abc")).toBe("single");
  });

  it("classifies a playlist page as an album", () => {
    expect(detectUrlKind("https://youtube.com/playlist?list=OLAK5uy_abc")).toBe("album");
    expect(detectUrlKind("https://youtube.com/playlist?list=PLabc")).toBe("album");
  });

  it("flags a video opened from inside a playlist as mixed", () => {
    expect(detectUrlKind("https://youtube.com/watch?v=abc&list=OLAK5uy_abc")).toBe("mixed");
    expect(detectUrlKind("https://youtu.be/abc?list=PLabc")).toBe("mixed");
  });

  it("ignores auto-generated radio and mix lists", () => {
    // RD…/UL… are not real playlists: the video stays a plain single.
    expect(detectUrlKind("https://youtube.com/watch?v=abc&list=RDabc")).toBe("single");
    expect(detectUrlKind("https://youtube.com/watch?v=abc&list=ULabc")).toBe("single");
    // …and a playlist page pointing at one has nothing to download.
    expect(detectUrlKind("https://youtube.com/playlist?list=RDabc")).toBeNull();
  });

  it("rejects a playlist page with no list at all", () => {
    expect(detectUrlKind("https://youtube.com/playlist")).toBeNull();
  });

  it("rejects YouTube paths that are neither watch nor playlist", () => {
    expect(detectUrlKind("https://youtube.com/")).toBeNull();
    expect(detectUrlKind("https://youtube.com/@channel")).toBeNull();
    expect(detectUrlKind("https://youtube.com/results?search_query=abc")).toBeNull();
  });
});
