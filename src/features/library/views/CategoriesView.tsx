import { Alert, Spinner } from "@heroui/react";
import { ArrowRight, Tags } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { paths } from "@/app/routes";
import { groupAlbums } from "@/features/library/albums/albums";
import { groupCategories } from "@/features/library/categories/categories";
import { CategoryList } from "@/features/library/categories/CategoryList";
import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";
import { useLibrary } from "@/features/library/hooks";
import { ActionLink } from "@/shared/ui/ActionLink";
import { EmptyState } from "@/shared/ui/EmptyState";
import { PageContainer } from "@/shared/ui/PageContainer";

/**
 * The category index — the genres page's twin for the user's own axis
 * (context: Video Games, Film…), cutting across genres.
 *
 * No search field and no banner for the untagged: the set is a handful of
 * curated values, and a track without a category is the normal case rather
 * than a problem to fix. The empty state explains the axis instead of
 * apologising, because on a fresh library it is the page's most likely face.
 */
export function CategoriesView() {
  const { t } = useTranslation("library");
  const library = useLibrary();
  const labelOf = useCategoryLabel();

  const categories = useMemo(() => {
    const tracks = library.data ?? [];
    return groupCategories(tracks, groupAlbums(tracks));
  }, [library.data]);

  const categorized = categories.reduce((sum, category) => sum + category.trackCount, 0);

  const meta = [
    t("categories.categoryCount", { count: categories.length }),
    t("categories.categorizedCount", { count: categorized }),
  ];

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("views.categories")}</h1>
          <p className="mt-0.5 text-[0.8125rem] text-muted">{meta.join(" · ")}</p>
        </div>
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

      {library.data && categories.length === 0 && (
        <EmptyState
          icon={Tags}
          title={t("categories.empty.title")}
          body={t("categories.empty.body")}
          action={
            <ActionLink to={paths.libraryAlbums} trailingIcon={ArrowRight}>
              {t("categories.emptyAction")}
            </ActionLink>
          }
        />
      )}

      {categories.length > 0 && <CategoryList categories={categories} labelOf={labelOf} />}
    </PageContainer>
  );
}
