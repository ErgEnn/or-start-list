"use client";

import { useCallback, useEffect, useState } from "react";

type LiveData = {
  count: number;
  eventName: string | null;
};

export default function LivePage() {
  const [data, setData] = useState<LiveData>({ count: 0, eventName: null });
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/live", { cache: "no-store" });
      const json = (await res.json()) as LiveData;
      setData({ count: json.count ?? 0, eventName: json.eventName ?? null });
    } catch {
      // Keep showing the last known value on transient errors.
    } finally {
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    void fetchCount();
    const interval = setInterval(() => void fetchCount(), 60_000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "24px",
        gap: "8px",
        background: "#0f172a",
        color: "#f8fafc",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontSize: "clamp(1rem, 5vw, 1.75rem)",
          fontWeight: 500,
          color: "#94a3b8",
          letterSpacing: "0.02em",
        }}
      >
        {data.eventName ?? "Registreerimisi täna"}
      </div>
      <div
        style={{
          fontSize: "clamp(5rem, 30vw, 14rem)",
          fontWeight: 800,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {data.count}
      </div>
      <div
        style={{
          position: "fixed",
          bottom: "16px",
          left: 0,
          right: 0,
          fontSize: "0.8rem",
          color: "#64748b",
        }}
      >
        {lastRefresh
          ? `Uuendatud ${lastRefresh.toLocaleTimeString("et-EE")}`
          : "Laadin…"}
      </div>
    </main>
  );
}
