import { describe, expect, it } from "vitest";

import { inlineSpans, parseChangelogEntry } from "@/features/update/changelog/parse";

const ENTRY = `---
date: 2026-08-12
---

# Une bibliothèque qui se range toute seule

Deux mois de travail sur ce qui se passe **après** le téléchargement.

## Téléchargements

Un téléchargement mal classé se rattrape sans rien re-télécharger.

![La ligne d'historique et son menu](media/2.0-download-undo.webp)

- Annuler un téléchargement
- Changer sa destination

## Réglages
- Quatre suppressions ciblées
`;

describe("parseChangelogEntry", () => {
  it("reads the date out of the front matter and the headline out of the h1", () => {
    const entry = parseChangelogEntry(ENTRY, "2.0.0", "fr");
    expect(entry?.date).toBe("2026-08-12");
    expect(entry?.title).toBe("Une bibliothèque qui se range toute seule");
    expect(entry?.version).toBe("2.0.0");
    expect(entry?.language).toBe("fr");
  });

  it("keeps the blocks before the first heading in a section of their own", () => {
    const entry = parseChangelogEntry(ENTRY, "2.0.0", "fr");
    expect(entry?.sections[0]).toEqual({
      title: null,
      blocks: [{ kind: "text", text: "Deux mois de travail sur ce qui se passe **après** le téléchargement." }],
    });
  });

  it("reads prose, image and list as three blocks of one section", () => {
    const entry = parseChangelogEntry(ENTRY, "2.0.0", "fr");
    expect(entry?.sections[1]).toEqual({
      title: "Téléchargements",
      blocks: [
        { kind: "text", text: "Un téléchargement mal classé se rattrape sans rien re-télécharger." },
        { kind: "image", alt: "La ligne d'historique et son menu", src: "media/2.0-download-undo.webp" },
        { kind: "list", items: ["Annuler un téléchargement", "Changer sa destination"] },
      ],
    });
  });

  it("joins the lines of a paragraph and closes it on the blank line", () => {
    const entry = parseChangelogEntry("# T\n\nune phrase\ncoupée en deux\n\nune autre\n", "1.0.0", "fr");
    expect(entry?.sections[0].blocks).toEqual([
      { kind: "text", text: "une phrase coupée en deux" },
      { kind: "text", text: "une autre" },
    ]);
  });

  it("ignores a date that is not a plain YYYY-MM-DD", () => {
    const entry = parseChangelogEntry("---\ndate: hier\n---\n\n# T\n", "1.0.0", "fr");
    expect(entry?.date).toBeNull();
  });

  it("returns null on a file with nothing to show", () => {
    expect(parseChangelogEntry("", "1.0.0", "fr")).toBeNull();
    expect(parseChangelogEntry("---\ndate: 2026-01-01\n---\n", "1.0.0", "fr")).toBeNull();
  });

  it("takes a deeper heading as a section, not as a lost line", () => {
    const entry = parseChangelogEntry("# T\n\n### Détail\n- une puce\n", "1.0.0", "fr");
    expect(entry?.sections).toEqual([{ title: "Détail", blocks: [{ kind: "list", items: ["une puce"] }] }]);
  });
});

describe("inlineSpans", () => {
  it("splits the marked runs out of the prose, in order", () => {
    expect(inlineSpans("ce qui se passe **après** le `.m3u8`")).toEqual([
      { text: "ce qui se passe ", mark: "plain" },
      { text: "après", mark: "bold" },
      { text: " le ", mark: "plain" },
      { text: ".m3u8", mark: "code" },
    ]);
  });

  it("leaves an unclosed marker as text rather than swallowing the rest", () => {
    expect(inlineSpans("2 ** 10 morceaux")).toEqual([{ text: "2 ** 10 morceaux", mark: "plain" }]);
  });
});
