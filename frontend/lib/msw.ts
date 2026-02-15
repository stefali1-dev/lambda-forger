let started = false;

export async function ensureMocking(): Promise<void> {
  const shouldUseMocks = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

  if (!shouldUseMocks || started || typeof window === "undefined") {
    return;
  }

  const { worker } = await import("@/mocks/browser");
  await worker.start({
    onUnhandledRequest: "bypass",
    serviceWorker: {
      url: "/mockServiceWorker.js",
    },
  });

  started = true;
}
