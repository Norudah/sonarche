import { describe, expect, it } from "vitest";

import { AUDIO_FORMATS, isNativeFormat, parseAudioFormat } from "@/features/settings/audioFormats";

describe("parseAudioFormat", () => {
  it("reads back every format the app offers", () => {
    for (const format of AUDIO_FORMATS) {
      expect(parseAudioFormat(format)).toBe(format);
    }
  });

  it("falls back to the native format on anything unknown", () => {
    // A preference file from another build, or a value the backend has since
    // dropped. Neither may leave the card with no selection.
    expect(parseAudioFormat(null)).toBe("m4a");
    expect(parseAudioFormat("")).toBe("m4a");
    expect(parseAudioFormat("wav")).toBe("m4a");
  });
});

describe("isNativeFormat", () => {
  it("is true only for the stream the download already receives", () => {
    expect(isNativeFormat("m4a")).toBe(true);
    expect(isNativeFormat("mp3")).toBe(false);
    expect(isNativeFormat("flac")).toBe(false);
  });
});
