import { describe, expect, it } from "vitest";

import { classifyPlaybackError } from "@/shared/player/playbackError";

describe("classifyPlaybackError", () => {
  it("reads the format out of the engine's refusal", () => {
    const failure = classifyPlaybackError("unsupported audio format: /Music/Boards of Canada/Roygbiv.opus");

    expect(failure).toEqual({ kind: "unsupportedFormat", extension: "opus" });
  });

  it("lowercases the extension, because ripped files shout", () => {
    const failure = classifyPlaybackError("unsupported audio format: /Music/TRACK.WMA");

    expect(failure).toEqual({ kind: "unsupportedFormat", extension: "wma" });
  });

  it("does not mistake a dotted folder name for a format", () => {
    const failure = classifyPlaybackError("unsupported audio format: /Music/Godspeed You! Black Emperor/f#a#");

    expect(failure).toEqual({ kind: "unsupportedFormat", extension: "" });
  });

  it("treats a hidden file as having no extension", () => {
    const failure = classifyPlaybackError("unsupported audio format: /Music/.opus");

    expect(failure).toEqual({ kind: "unsupportedFormat", extension: "" });
  });

  it("calls anything else unreadable rather than guessing", () => {
    expect(classifyPlaybackError("no such file: /Music/gone.m4a")).toEqual({ kind: "unreadable" });
    expect(classifyPlaybackError("playback error: no audio output")).toEqual({ kind: "unreadable" });
  });

  it("survives an error that is not a string", () => {
    expect(classifyPlaybackError(new Error("unsupported audio format: /Music/a.ape"))).toEqual({
      kind: "unsupportedFormat",
      extension: "ape",
    });
    expect(classifyPlaybackError(undefined)).toEqual({ kind: "unreadable" });
    expect(classifyPlaybackError({ nope: true })).toEqual({ kind: "unreadable" });
  });
});
