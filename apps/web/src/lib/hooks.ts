/**
 * SIH26162 · React hooks for backend data
 * Each hook manages loading / error / data state with auto-refresh and abort.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  createWsClient,
  getAnalytics,
  getDetailedAnalytics,
  getModelValidation,
  getHealth,
  getTimeline,
  listEvents,
  listFacilities,
  listLogs,
  generateIncidentBrief,
  askCopilot,
  getWsBase,
  type WsClient,
  type WsMessage,
  type WsState,
  type EventsQuery,
  type AnalyticsSummary,
  type DetailedAnalytics,
  type TimelineResponse,
  type TimelineQuery,
  type AgentLogEntry,
  type LogsQuery,
  type IncidentBrief,
} from "./api";
import type {
  Facility,
  HotspotEvent,
} from "./types";

// ── Generic helpers ──────────────────────────────────────────────────────────

interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * useAsync — Stale-while-revalidate with exponential-backoff auto-retry.
 *
 * Key behaviours:
 *  - Never clears `data` on re-fetch or transient error (stale-while-revalidate).
 *  - On fetch failure, retries automatically with backoff: 1s → 2s → 4s → 8s → 15s cap.
 *  - Retry timer resets on the first successful fetch.
 *  - `loading` stays true only on the initial (first-ever) fetch; subsequent refreshes
 *    that fail do NOT set loading — data stays visible and the error is surfaced.
 */
function useAsync<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = []
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const tickRef = useRef(tick);
  tickRef.current = tick;
  const refresh = () => setTick((n) => n + 1);

  // Track whether we have ever loaded successfully — influences loading state
  const everLoaded = useRef(false);

  useEffect(() => {
    const ctrl = new AbortController();
    const startedAt = Date.now();

    // Only set loading on the initial fetch, not on background refresh
    if (!everLoaded.current) setLoading(true);

    const doFetch = () =>
      fn(ctrl.signal)
        .then((d) => {
          if (ctrl.signal.aborted) return;
          everLoaded.current = true;
          setData(d);
          setError(null);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (ctrl.signal.aborted) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          const finalErr = err instanceof Error ? err : new Error(String(err));
          setError(finalErr);
          // Only show loading on first attempt; keep existing data on background failures
          if (!everLoaded.current) {
            setLoading(false);
          }

          // ── Auto-retry with backoff ──────────────────────────
          const elapsed = Date.now() - startedAt;
          // Don't keep retrying forever if the tick changed (manual refresh or new deps)
          if (tickRef.current !== tick) return;
          // Cap backoff at 15s, start at 1s
          const delay = Math.min(1000 * Math.pow(2, Math.floor(elapsed / 15000)), 15_000);
          setTimeout(() => {
            if (!ctrl.signal.aborted && tickRef.current === tick) doFetch();
          }, delay);
        });

    doFetch();

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return { data, error, loading, refresh };
}

// ── Domain hooks ────────────────────────────────────────────────────────────

export function useEvents(
  query: EventsQuery = {},
  refreshMs = 30_000
): AsyncState<HotspotEvent[]> {
  const { data: rawData, error, loading, refresh } = useAsync<HotspotEvent[]>(
    (signal) => listEvents(query, signal),
    [JSON.stringify(query)]
  );

  // Clean deduplication of incoming events
  const data = rawData
    ? (() => {
        const seen = new Set<string>();
        const res: HotspotEvent[] = [];
        for (const ev of rawData) {
          if (!ev || typeof ev.latitude !== "number" || typeof ev.longitude !== "number") continue;
          const k = ev.id || `${ev.latitude.toFixed(4)}_${ev.longitude.toFixed(4)}_${ev.acq_datetime || ev.created_at || ""}`;
          if (!seen.has(k)) {
            seen.add(k);
            res.push(ev);
          }
        }
        return res;
      })()
    : null;

  // Polling
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (refreshMs <= 0) return;
    const id = setInterval(() => refreshRef.current(), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);
  return { data, error, loading, refresh };
}

export function useFacilities(
  refreshMs = 60_000
): AsyncState<Facility[]> {
  const { data, error, loading, refresh } = useAsync<Facility[]>(
    (signal) => listFacilities(signal),
    []
  );
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (refreshMs <= 0) return;
    const id = setInterval(() => refreshRef.current(), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);
  return { data, error, loading, refresh };
}

export function useAnalytics(
  refreshMs = 15_000
): AsyncState<AnalyticsSummary> {
  const { data, error, loading, refresh } = useAsync<AnalyticsSummary>(
    (signal) => getAnalytics(signal),
    []
  );
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (refreshMs <= 0) return;
    const id = setInterval(() => refreshRef.current(), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);
  return { data, error, loading, refresh };
}

export function useHealth(refreshMs = 10_000): AsyncState<{
  status: string;
  version: string;
  uptime_seconds: number;
  components: Record<string, unknown>;
  data_sources: Record<string, string>;
  timestamp: number;
}> {
  const { data, error, loading, refresh } = useAsync<{
    status: string;
    version: string;
    uptime_seconds: number;
    components: Record<string, unknown>;
    data_sources: Record<string, string>;
    timestamp: number;
  }>((signal) => getHealth(signal), []);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (refreshMs <= 0) return;
    const id = setInterval(() => refreshRef.current(), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);
  return { data, error, loading, refresh };
}

// ── WebSocket alert stream hook ─────────────────────────────────────────────

export interface UseAlertStreamOptions {
  /** If provided, only events matching this handler are accepted. */
  onEvent?: (event: HotspotEvent) => void;
  /** Optional filters passed to backend. */
  filters?: {
    role?: string;
    severity?: string;
    critical_only?: boolean;
  };
  /** Pause the auto-reconnect (used when console is closed). */
  enabled?: boolean;
}

export interface AlertStreamState {
  state: WsState;
  error: Error | null;
  latestEvent: HotspotEvent | null;
  totalReceived: number;
  close: () => void;
}

export function useAlertStream(
  options: UseAlertStreamOptions = {}
): AlertStreamState {
  const [state, setState] = useState<WsState>("closed");
  const [error, setError] = useState<Error | null>(null);
  const [latestEvent, setLatestEvent] = useState<HotspotEvent | null>(null);
  const [totalReceived, setTotalReceived] = useState(0);
  const clientRef = useRef<WsClient | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    if (options.enabled === false) {
      clientRef.current?.close();
      clientRef.current = null;
      setState("closed");
      return;
    }

    const client = createWsClient({
      filters: optsRef.current.filters,
      onStateChange: (s) => {
        setState(s);
        if (s === "error") {
          setError(new Error("WebSocket connection error"));
        }
      },
      onMessage: (msg: WsMessage) => {
        if (!msg || typeof msg !== "object") return;
        // Real backend sends: "event" (live) and "backlog" (initial load)
        // Legacy simulation sent: "new_event", "simulated_event"
        const msgType = (msg as { type?: string }).type;
        if (msgType === "event" || msgType === "backlog" || msgType === "new_event" || msgType === "simulated_event") {
          const ev = (msg as { event: HotspotEvent }).event;
          if (!ev) return;
          setLatestEvent(ev);
          setTotalReceived((n) => n + 1);
          optsRef.current.onEvent?.(ev);
        }
      },
    });
    clientRef.current = client;

    return () => {
      client.close();
      clientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.enabled]);

  return {
    state,
    error,
    latestEvent,
    totalReceived,
    close: () => {
      clientRef.current?.close();
      clientRef.current = null;
    },
  };
}

// ── Error type guard helper for components ──────────────────────────────────

export function describeError(err: Error | null | undefined): string {
  if (!err) return "";
  if (err instanceof ApiError) {
    const detail =
      typeof err.body === "object" && err.body && "detail" in err.body
        ? String((err.body as { detail: unknown }).detail)
        : err.message;
    return `Backend error (${err.status}): ${detail}`;
  }
  if (err instanceof TypeError) {
    return "Cannot reach backend: " + (err.message || "Network request failed");
  }
  return err.message;
}

// ── Timeline hook ───────────────────────────────────────────────────────────

export function useTimeline(
  query: TimelineQuery = {},
  refreshMs = 30_000
): AsyncState<TimelineResponse> {
  const { data, error, loading, refresh } = useAsync<TimelineResponse>(
    (signal) => getTimeline(query, signal),
    [JSON.stringify(query)]
  );
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (refreshMs <= 0) return;
    const id = setInterval(() => refreshRef.current(), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);
  return { data, error, loading, refresh };
}

// ── Detailed analytics hook ──────────────────────────────────────────────────

export function useDetailedAnalytics(refreshMs = 20_000): AsyncState<DetailedAnalytics> {
  const { data, error, loading, refresh } = useAsync<DetailedAnalytics>(
    (signal) => getDetailedAnalytics(signal),
    []
  );
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (refreshMs <= 0) return;
    const id = setInterval(() => refreshRef.current(), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);
  return { data, error, loading, refresh };
}

// ── ML Model Validation & Accuracy Metrics hook ──────────────────────────────

export function useModelValidation(): AsyncState<any> {
  const { data, error, loading, refresh } = useAsync<any>(
    (signal) => getModelValidation(signal),
    []
  );
  return { data, error, loading, refresh };
}

// ── System & agent logs hook ─────────────────────────────────────────────────

export function useLogs(
  query: LogsQuery = {},
  refreshMs = 10_000
): AsyncState<AgentLogEntry[]> {
  const { data, error, loading, refresh } = useAsync<AgentLogEntry[]>(
    (signal) => listLogs(query, signal),
    [JSON.stringify(query)]
  );
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (refreshMs <= 0) return;
    const id = setInterval(() => refreshRef.current(), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);
  return { data, error, loading, refresh };
}

// ── Real-time log stream hook ────────────────────────────────────────────────

export function useLogStream(opts: { enabled?: boolean; maxEntries?: number } = {}) {
  const [logs, setLogs] = useState<AgentLogEntry[]>([]);
  const [state, setState] = useState<WsState>("connecting");
  const maxEntries = opts.maxEntries ?? 200;

  useEffect(() => {
    if (opts.enabled === false) return;
    const wsBase = getWsBase();
    const wsUrl = wsBase.replace("/ws/alerts", "/ws/logs");

    const client = createWsClient({
      url: wsUrl,
      onStateChange: setState,
      onMessage: (msg) => {
        if (msg.type === "log_backlog" && Array.isArray(msg.logs)) {
          setLogs(msg.logs as AgentLogEntry[]);
        } else if (msg.type === "log" && msg.entry) {
          setLogs((prev) => [msg.entry as AgentLogEntry, ...prev].slice(0, maxEntries));
        }
      },
    });

    return () => client.close();
  }, [opts.enabled, maxEntries]);

  const clearLogs = () => setLogs([]);

  return { logs, state, clearLogs };
}

// ── Tactical Incident Brief hook ─────────────────────────────────────────────
const briefMemoryCache = new Map<string, IncidentBrief>();

export function useIncidentBrief(eventId: string | null) {
  const [brief, setBrief] = useState<IncidentBrief | null>(() => {
    return eventId ? briefMemoryCache.get(eventId) ?? null : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!eventId) {
      setBrief(null);
      return;
    }

    // Return instant cached brief if available
    const cached = briefMemoryCache.get(eventId);
    if (cached) {
      setBrief(cached);
      setLoading(false);
      return;
    }

    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    generateIncidentBrief(eventId, ctrl.signal)
      .then((b) => {
        if (!ctrl.signal.aborted && b) {
          briefMemoryCache.set(eventId, b);
          setBrief(b);
        }
      })
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [eventId]);

  return { brief, loading, error };
}
