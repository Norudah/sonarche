import { changelogMedia } from "@/features/update/changelog/entries";
import { inlineSpans, type ChangelogBlock, type ChangelogEntry } from "@/features/update/changelog/parse";

/** Authored prose, with its marked runs put back — as elements, never as
 * markup: nothing written in `changelog/` reaches the DOM as HTML. */
function Prose({ text }: { text: string }) {
  return (
    <>
      {inlineSpans(text).map((span, index) => {
        if (span.mark === "bold")
          return (
            <strong key={index} className="font-semibold text-foreground">
              {span.text}
            </strong>
          );
        if (span.mark === "code")
          return (
            <code key={index} className="rounded bg-default/60 px-1 py-0.5 font-mono text-[0.8125em]">
              {span.text}
            </code>
          );
        return <span key={index}>{span.text}</span>;
      })}
    </>
  );
}

function Block({ block }: { block: ChangelogBlock }) {
  if (block.kind === "text") {
    return (
      <p className="max-w-prose text-sm leading-relaxed text-foreground/90">
        <Prose text={block.text} />
      </p>
    );
  }

  if (block.kind === "list") {
    return (
      <ul className="flex max-w-prose flex-col gap-2">
        {block.items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-foreground/90">
            <span aria-hidden className="mt-[0.4375rem] size-1.5 shrink-0 rounded-full bg-accent" />
            <span>
              <Prose text={item} />
            </span>
          </li>
        ))}
      </ul>
    );
  }

  const url = changelogMedia(block.src);
  // A note that says "look at this" next to a broken image is worse than the
  // same note without it: a missing file drops the whole figure, caption
  // included.
  if (url == null) return null;

  return (
    <figure className="flex flex-col gap-2">
      <img
        src={url}
        alt={block.alt}
        // Screenshots are wide and the pane is not: cap the height so a
        // full-window capture cannot push the rest of the entry off screen.
        className="max-h-96 w-full rounded-lg border border-separator object-contain"
      />
      {block.alt !== "" && <figcaption className="text-[0.75rem] text-muted">{block.alt}</figcaption>}
    </figure>
  );
}

/**
 * One version's story, as written in `changelog/`.
 *
 * Split from the card that frames it because the entry is also what a future
 * "all versions" surface would draw — and because the card owns which version
 * is being read, which the body has no business knowing.
 */
export function ChangelogBody({ entry }: { entry: ChangelogEntry }) {
  return (
    <div className="flex flex-col gap-6">
      {entry.sections.map((section, index) => (
        <section key={section.title ?? `intro-${index}`} className="flex flex-col gap-3">
          {section.title != null && (
            <h4 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">{section.title}</h4>
          )}
          {section.blocks.map((block, blockIndex) => (
            <Block key={blockIndex} block={block} />
          ))}
        </section>
      ))}
    </div>
  );
}
