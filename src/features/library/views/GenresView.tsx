import { useTranslation } from "react-i18next";

import { LibraryPlaceholder } from "@/features/library/LibraryPlaceholder";

export function GenresView() {
  const { t } = useTranslation("library");
  return <LibraryPlaceholder title={t("views.genres")} />;
}
