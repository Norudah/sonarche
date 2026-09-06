// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { check } = vi.hoisted(() => ({ check: vi.fn() }));

vi.mock("@tauri-apps/plugin-updater", () => ({ check }));

import { checkForUpdate, useUpdateCheck } from "@/features/update/hooks";

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

// Regression: a dev build's version is routinely behind the latest GitHub
// release, so an unguarded check() offers an update the dev session has no
// way to install (the launch toast fired on every `npm run tauri dev`).
describe("update check, gated on dev mode", () => {
  it("checkForUpdate never calls the updater plugin in dev", async () => {
    vi.stubEnv("DEV", true);
    const queryClient = new QueryClient();

    const result = await checkForUpdate(queryClient);

    expect(result).toBeNull();
    expect(check).not.toHaveBeenCalled();
  });

  it("checkForUpdate calls the updater plugin outside dev", async () => {
    vi.stubEnv("DEV", false);
    check.mockResolvedValue({ version: "0.10.0" });
    const queryClient = new QueryClient();

    const result = await checkForUpdate(queryClient);

    expect(result).toEqual({ version: "0.10.0" });
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("useUpdateCheck's manual refetch is gated the same way", async () => {
    vi.stubEnv("DEV", true);
    const { result } = renderHook(() => useUpdateCheck(), { wrapper });

    const { data } = await result.current.refetch();

    expect(data).toBeNull();
    expect(check).not.toHaveBeenCalled();
  });
});
