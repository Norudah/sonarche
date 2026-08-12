import { useDownloadJobToast } from "@/app/layout/DownloadJobToast";
import { useImportJobToast } from "@/app/layout/ImportJobToast";

/**
 * The shell's watch over long-running work: a download job and a folder import
 * each get a persistent progress toast while their own page is out of sight,
 * and a one-line verdict when they end there. Mounted once, inside the gate —
 * both need the router, the query cache and the toast viewport around them.
 */
export function JobProgressToasts() {
  useDownloadJobToast();
  useImportJobToast();
  return null;
}
