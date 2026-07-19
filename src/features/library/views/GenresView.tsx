import { Accordion, Alert, Button, Chip, Spinner } from "@heroui/react";
import { Loader2, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { useLibrary, useRecomputeGenres } from "@/features/library/hooks";
import { TrackTable } from "@/features/library/tracks/TrackTable";
import { PageContainer } from "@/shared/ui/PageContainer";

const PARENT_OTHER = "__other__";
const PARENT_NONE = "__none__";
const SUB_NONE = "__none__";

interface SubGroup {
  key: string;
  tracks: LibraryTrack[];
}

interface ParentGroup {
  key: string;
  tracks: LibraryTrack[];
  subs: SubGroup[];
}

function parentKeyFor(track: LibraryTrack): string {
  if (track.genreBucket) return track.genreBucket;
  return track.genre ? PARENT_OTHER : PARENT_NONE;
}

function subKeyFor(track: LibraryTrack): string {
  return track.genre ?? SUB_NONE;
}

function groupByGenre(tracks: LibraryTrack[]): ParentGroup[] {
  const parents = new Map<string, Map<string, LibraryTrack[]>>();

  for (const track of tracks) {
    const parentKey = parentKeyFor(track);
    const subKey = subKeyFor(track);
    if (!parents.has(parentKey)) parents.set(parentKey, new Map());
    const subs = parents.get(parentKey)!;
    if (!subs.has(subKey)) subs.set(subKey, []);
    subs.get(subKey)!.push(track);
  }

  const parentGroups: ParentGroup[] = Array.from(parents.entries()).map(([key, subs]) => {
    const subGroups = Array.from(subs.entries())
      .map(([subKey, subTracks]) => ({ key: subKey, tracks: subTracks }))
      .sort((a, b) => {
        if (a.key === SUB_NONE) return 1;
        if (b.key === SUB_NONE) return -1;
        return a.key.localeCompare(b.key);
      });
    return {
      key,
      tracks: subGroups.flatMap((s) => s.tracks),
      subs: subGroups,
    };
  });

  const rank = (key: string) => (key === PARENT_OTHER ? 1 : key === PARENT_NONE ? 2 : 0);
  parentGroups.sort((a, b) => {
    const rankDiff = rank(a.key) - rank(b.key);
    if (rankDiff !== 0) return rankDiff;
    if (rank(a.key) !== 0) return 0;
    return b.tracks.length - a.tracks.length || a.key.localeCompare(b.key);
  });

  return parentGroups;
}

export function GenresView() {
  const { t } = useTranslation("library");
  const library = useLibrary();
  const recompute = useRecomputeGenres();
  const [selected, setSelected] = useState<{ parent: string; sub: string | null } | null>(null);

  const parentGroups = useMemo(() => groupByGenre(library.data ?? []), [library.data]);

  const recomputeFeedback = recompute.isError
    ? { text: t("genres.recomputeFailed"), tone: "text-danger" }
    : recompute.isSuccess
      ? {
          text: t("genres.recomputeDone", {
            updated: recompute.data.updated,
            total: recompute.data.total,
          }),
          tone: "text-success",
        }
      : null;

  const labelFor = (key: string) =>
    key === PARENT_OTHER || key === SUB_NONE ? t("genres.other") : key === PARENT_NONE ? t("genres.none") : key;

  const selectedGroup = selected ? parentGroups.find((g) => g.key === selected.parent) : null;
  const filtered =
    selected == null
      ? []
      : selected.sub == null
        ? (selectedGroup?.tracks ?? [])
        : (selectedGroup?.subs.find((s) => s.key === selected.sub)?.tracks ?? []);

  return (
    <PageContainer>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{t("views.genres")}</h1>
          {library.data && library.data.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              className="rounded-xl"
              isDisabled={recompute.isPending}
              onPress={() => recompute.mutate()}
            >
              {recompute.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("genres.recomputing")}
                </>
              ) : (
                <>
                  <RefreshCw className="size-4" />
                  {t("genres.recompute")}
                </>
              )}
            </Button>
          )}
        </div>
        {recomputeFeedback && (
          <p className={`text-sm ${recomputeFeedback.tone}`}>{recomputeFeedback.text}</p>
        )}
      </div>

      {library.isPending && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {library.isError && (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Title>{t("loadFailed")}</Alert.Title>
            <Alert.Description>{String(library.error)}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {library.data && library.data.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-4xl">♪</p>
          <p className="text-muted">{t("empty")}</p>
        </div>
      )}

      {parentGroups.length > 0 && (
        <Accordion allowsMultipleExpanded>
          {parentGroups.map((group) => (
            <Accordion.Item key={group.key} id={group.key}>
              <Accordion.Heading>
                <Accordion.Trigger className="flex w-full items-center gap-2 py-2 text-left">
                  <Accordion.Indicator />
                  <span className="font-medium">{labelFor(group.key)}</span>
                  <Chip color="default" size="sm" variant="soft" className="ml-1">
                    {group.tracks.length}
                  </Chip>
                </Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel>
                <Accordion.Body className="flex flex-col gap-1 py-1 pl-8">
                  <button
                    type="button"
                    onClick={() => setSelected({ parent: group.key, sub: null })}
                    className={
                      "cursor-pointer flex items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-default/40" +
                      (selected?.parent === group.key && selected.sub == null
                        ? " bg-accent/15 text-accent"
                        : "")
                    }
                  >
                    <span className="font-medium">{t("genres.allOf", { parent: labelFor(group.key) })}</span>
                  </button>
                  {group.subs.map((sub) => (
                    <button
                      key={sub.key}
                      type="button"
                      onClick={() => setSelected({ parent: group.key, sub: sub.key })}
                      className={
                        "cursor-pointer flex items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-default/40" +
                        (selected?.parent === group.key && selected.sub === sub.key
                          ? " bg-accent/15 text-accent"
                          : "")
                      }
                    >
                      <span>{labelFor(sub.key)}</span>
                      <span className="text-muted">{sub.tracks.length}</span>
                    </button>
                  ))}
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      )}

      {selected == null && parentGroups.length > 0 && (
        <p className="py-8 text-center text-sm text-muted">{t("genres.pickHint")}</p>
      )}

      {selected != null && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              {labelFor(selected.parent)}
              {selected.sub != null && ` › ${labelFor(selected.sub)}`}
            </p>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="cursor-pointer text-sm text-accent underline-offset-4 hover:underline"
            >
              {t("genres.clear")}
            </button>
          </div>
          <TrackTable
            tracks={filtered}
            animationKey={`${selected.parent}:${selected.sub ?? ""}`}
          />
        </div>
      )}
    </PageContainer>
  );
}
