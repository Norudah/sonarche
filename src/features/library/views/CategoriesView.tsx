import { Alert, Spinner } from "@heroui/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/routes";
import { groupAlbums } from "@/features/library/albums/albums";
import { groupCategories } from "@/features/library/categories/categories";
import { CategoryList } from "@/features/library/categories/CategoryList";
import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";
import { useLibrary } from "@/features/library/hooks";
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
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-4xl">◎</p>
          <p className="max-w-md text-sm text-muted">{t("categories.empty")}</p>
          <Link to={paths.libraryAlbums} className="text-accent underline-offset-4 hover:underline">
            {t("categories.emptyAction")}
          </Link>
        </div>
      )}

      {categories.length > 0 && <CategoryList categories={categories} labelOf={labelOf} />}
    </PageContainer>
  );
}
