import { describe, expect, it } from "vitest";

import { normalize } from "@/shared/lib/text";

describe("normalize", () => {
  it("lowercases", () => {
    expect(normalize("Daft Punk")).toBe("daft punk");
  });

  it("strips diacritics so an unaccented query still matches", () => {
    expect(normalize("Beyoncé")).toBe("beyonce");
    expect(normalize("Sigur Rós")).toBe("sigur ros");
  });

  it("leaves non-latin scripts alone rather than mangling them", () => {
    expect(normalize("東京")).toBe("東京");
  });
});
