import { useDownloadJobToast } from "@/app/layout/DownloadJobToast";
import { useImportJobToast } from "@/app/layout/ImportJobToast";

/** Progress toasts for downloads and imports while their page is out of sight. */
export function JobProgressToasts() {
  useDownloadJobToast();
  useImportJobToast();
  return null;
}
