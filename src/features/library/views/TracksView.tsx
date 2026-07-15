import { Alert, Button, Spinner } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/routes";
import { TrackList } from "@/features/library/TrackList";
import { useLibrary } from "@/features/library/hooks";
import { PageContainer } from "@/shared/ui/PageContainer";

export function TracksView() {
  const { t } = useTranslation("library");
  const library = useLibrary();

  return (
    <PageContainer>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("views.tracks")}</h1>
          {library.data && (
            <p className="mt-1 text-sm text-muted">
              {t("trackCount", { count: library.data.length })}
            </p>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onPress={() => library.refetch()}
          isDisabled={library.isFetching}
        >
          {t("refresh")}
        </Button>
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
          <Link to={paths.download} className="text-accent underline-offset-4 hover:underline">
            {t("goToDownload")}
          </Link>
        </div>
      )}

      {library.data && library.data.length > 0 && <TrackList tracks={library.data} />}
    </PageContainer>
  );
}
