import { useEffect, useRef } from "react";

const POLL_INTERVAL = 60_000;

export function useAutoRefresh() {
  const knownBuildId = useRef<string | null>(null);
  const isRefreshing = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    async function checkVersion() {
      if (isRefreshing.current) return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const buildId = data.buildId;
        if (!buildId) return;

        if (knownBuildId.current === null) {
          knownBuildId.current = buildId;
          return;
        }

        if (buildId !== knownBuildId.current) {
          isRefreshing.current = true;
          knownBuildId.current = buildId;
          window.location.reload();
        }
      } catch {}
    }

    checkVersion();
    timer = setInterval(checkVersion, POLL_INTERVAL);

    return () => clearInterval(timer);
  }, []);
}
