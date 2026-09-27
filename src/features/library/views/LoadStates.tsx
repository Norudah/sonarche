import { Alert, Spinner } from "@heroui/react";
import { useTranslation } from "react-i18next";

/** Shown while the library (or a playlist) loads. */
export function LoadingSpinner() {
  return (
    <div className="flex justify-center py-16">
      <Spinner size="lg" />
    </div>
  );
}

export function LoadError({ error }: { error: unknown }) {
  const { t } = useTranslation("library");
  return (
    <Alert status="danger">
      <Alert.Content>
        <Alert.Title>{t("loadFailed")}</Alert.Title>
        <Alert.Description>{String(error)}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
