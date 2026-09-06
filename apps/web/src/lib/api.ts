/**
 * SIH26162 · Frontend API Client
 * Typed wrapper around the FastAPI backend.
 * All requests go through the configured base URL (env: NEXT_PUBLIC_API_URL).
 */

import type {
  HotspotEvent,
  Facility,
  ThermalClassification,
} from "./types";

export function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined" && window.location) {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      return `${window.location.protocol}//${window.location.host}/api/v1`;
    }
  }
  return "http://localhost:8000/api/v1";
}

export function getWsBase(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  if (typeof window !== "undefined" && window.location) {
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      return `${wsProto}//${window.location.host}/api/v1/ws/alerts`;
    }
  }
  return "ws://localhost:8000/api/v1/ws/alerts";
}

export const API_BASE = getApiBase();
export const WS_URL = getWsBase();

// ── HTTP helpers ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal
): Promise<T> {
  const base = getApiBase();
  const url = `${base}${path}`;
  const res = await fetch(url, {
    ...init,
    signal,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => null);
    }
    throw new ApiError(
      `Request failed: ${res.status} ${res.statusText}`,
      res.status,
      body
    );
  }

  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

// ── Domain endpoints ─────────────────────────────────────────────────────────

export interface EventsQuery {
  classification?: ThermalClassification;
  criticalOnly?: boolean;
  limit?: number;
}

export async function listEvents(
  q: EventsQuery = {},
  signal?: AbortSignal
): Promise<HotspotEvent[]> {
  const params = new URLSearchParams();
  if (q.classification) params.set("classification", q.classification);
  if (q.criticalOnly) params.set("critical_only", "true");
  if (q.limit) params.set("limit", String(q.limit));
  const qs = params.toString();
  return request<HotspotEvent[]>(
    `/events${qs ? `?${qs}` : ""}`,
    {},
    signal
  );
}

export async function getEvent(
  id: string,
  signal?: AbortSignal
): Promise<HotspotEvent> {
  return request<HotspotEvent>(`/events/${encodeURIComponent(id)}`, {}, signal);
}

export async function listFacilities(
  signal?: AbortSignal
): Promise<Facility[]> {
  return request<Facility[]>("/facilities", {}, signal);
}

export interface AnalyticsSummary {
  total_events_processed: number;
  critical_alerts_count: number;
  class_breakdown: Record<string, number>;
  system_accuracy_metric: string;
  mean_latency_seconds: number;
  newest_event_id: string | null;
}

export async function getAnalytics(
  signal?: AbortSignal
): Promise<AnalyticsSummary> {
  return request<AnalyticsSummary>("/analytics/summary", {}, signal);
}

export async function getHealth(signal?: AbortSignal): Promise<{
  status: string;
  version: string;
  uptime_seconds: number;
  components: Record<string, unknown>;
  data_sources: Record<string, string>;
  timestamp: number;
}> {
  return request("/health", {}, signal);
}

// ── Timeline & Historical Playback ───────────────────────────────────────────

export interface TimelineBucket {
  timestamp: string;
  epoch: number;
  total_events: number;
  critical_count: number;
  mean_frp_mw: number;
  max_frp_mw: number;
  class_counts: Record<string, number>;
}

export interface TimelineResponse {
  from_time: string;
  to_time: string;
  interval_minutes: number;
  buckets: TimelineBucket[];
  total_events: number;
}

export interface TimelineQuery {
  fromTime?: string;
  toTime?: string;
  intervalMinutes?: number;
}

export async function getTimeline(
  q: TimelineQuery = {},
  signal?: AbortSignal
): Promise<TimelineResponse> {
  const params = new URLSearchParams();
  if (q.fromTime) params.set("from_time", q.fromTime);
  if (q.toTime) params.set("to_time", q.toTime);
  if (q.intervalMinutes) params.set("interval_minutes", String(q.intervalMinutes));
  const qs = params.toString();
  return request<TimelineResponse>(`/events/timeline${qs ? `?${qs}` : ""}`, {}, signal);
}

export async function getHistory(
  q: { fromTime?: string; toTime?: string; classification?: string; limit?: number } = {},
  signal?: AbortSignal
): Promise<HotspotEvent[]> {
  const params = new URLSearchParams();
  if (q.fromTime) params.set("from_time", q.fromTime);
  if (q.toTime) params.set("to_time", q.toTime);
  if (q.classification) params.set("classification", q.classification);
  if (q.limit) params.set("limit", String(q.limit));
  const qs = params.toString();
  return request<HotspotEvent[]>(`/events/history${qs ? `?${qs}` : ""}`, {}, signal);
}

// ── Analytics ────────────────────────────────────────────────────────────────

export interface FacilityRisk {
  name: string;
  type?: string;
  event_count: number;
  critical_count: number;
  mean_frp_mw: number;
  max_frp_mw: number;
  mean_cde: number | null;
  lat?: number | null;
  lon?: number | null;
}

export interface DetailedAnalytics {
  total_events_processed: number;
  critical_alerts_count: number;
  class_breakdown: Record<string, number>;
  severity_breakdown: Record<string, number>;
  source_breakdown: Record<string, number>;
  mean_cde_score: number | null;
  frp_percentiles: { p50: number; p90: number; p99: number; max: number };
  facilities_ranking: FacilityRisk[];
  state_breakdown: Record<string, number>;
  monitored_facilities: number;
}

// Backend sends raw fields (critical_alerts / max_frp / mean_frp) and may omit
// mean_cde entirely — normalize to the UI-facing FacilityRisk shape so every
// consumer can safely call .toFixed() without undefined/null crashes.
function normalizeFacilityRisk(raw: any): FacilityRisk {
  const meanCde = raw?.mean_cde ?? raw?.mean_cde_score ?? null;
  return {
    name: String(raw?.name ?? "Unknown Facility"),
    type: raw?.type ?? undefined,
    event_count: Number(raw?.event_count ?? 0),
    critical_count: Number(raw?.critical_count ?? raw?.critical_alerts ?? 0),
    mean_frp_mw: Number(raw?.mean_frp_mw ?? raw?.mean_frp ?? 0),
    max_frp_mw: Number(raw?.max_frp_mw ?? raw?.max_frp ?? 0),
    mean_cde:
      meanCde === null || meanCde === undefined || Number.isNaN(Number(meanCde))
        ? null
        : Number(meanCde),
    lat: raw?.lat ?? null,
    lon: raw?.lon ?? null,
  };
}

export async function getDetailedAnalytics(signal?: AbortSignal): Promise<DetailedAnalytics> {
  const data = await request<any>("/analytics/detailed", {}, signal);
  if (!data || !Array.isArray(data.facilities_ranking)) return data;
  return {
    ...data,
    facilities_ranking: data.facilities_ranking.map(normalizeFacilityRisk),
  };
}

export async function getFacilitiesRisk(
  limit = 20,
  signal?: AbortSignal
): Promise<{ facilities: FacilityRisk[]; total_monitored: number }> {
  const data = await request<any>(
    `/analytics/facilities-risk?limit=${limit}`,
    {},
    signal
  );
  if (!data || !Array.isArray(data.facilities)) return data;
  return {
    ...data,
    facilities: data.facilities.map(normalizeFacilityRisk),
  };
}

export async function getModelValidation(signal?: AbortSignal): Promise<any> {
  return request<any>("/analytics/model-validation", {}, signal);
}

// ── Audit & Agent Logs ───────────────────────────────────────────────────────

export interface AgentLogEntry {
  id: string;
  seq: number;
  timestamp: string;
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  source:
    | "SYSTEM"
    | "FIRMS_POLLER"
    | "INGESTION"
    | "SPATIAL_AGENT"
    | "TEMPORAL_AGENT"
    | "VISION_AGENT"
    | "ORCHESTRATOR"
    | "DISPERSION_AGENT"
    | "DISPATCHER"
    | "INTELLIGENCE"
    | "WEBSOCKET";
  message: string;
  event_id: string | null;
  metadata: Record<string, unknown>;
}

export interface LogsQuery {
  level?: string;
  source?: string;
  eventId?: string;
  limit?: number;
  sinceSeq?: number;
}

export async function listLogs(q: LogsQuery = {}, signal?: AbortSignal): Promise<AgentLogEntry[]> {
  const params = new URLSearchParams();
  if (q.level) params.set("level", q.level);
  if (q.source) params.set("source", q.source);
  if (q.eventId) params.set("event_id", q.eventId);
  if (q.limit) params.set("limit", String(q.limit));
  if (q.sinceSeq) params.set("since_seq", String(q.sinceSeq));
  const qs = params.toString();
  return request<AgentLogEntry[]>(`/logs${qs ? `?${qs}` : ""}`, {}, signal);
}

export interface LogsStats {
  total_logs: number;
  error_count: number;
  by_level: Record<string, number>;
  by_source: Record<string, number>;
  newest_seq: number;
}

export async function getLogsStats(signal?: AbortSignal): Promise<LogsStats> {
  return request<LogsStats>("/logs/stats", {}, signal);
}

// ── Tactical Intelligence (Incident Briefs & Copilot) ─────────────────────────

export interface IntelligenceStatus {
  engine: string;
  available: boolean;
  mode: "NEURAL" | "DOCTRINE";
}

export async function getIntelligenceStatus(signal?: AbortSignal): Promise<IntelligenceStatus> {
  return request<IntelligenceStatus>("/intelligence/status", {}, signal);
}

export interface IncidentBrief {
  event_id: string;
  classification: string;
  confidence_score: number;
  facility_name: string | null;
  brief: string;
  mode: "NEURAL" | "DOCTRINE";
  generated_at: string;
  latency_ms: number;
}

export async function generateIncidentBrief(
  eventId: string,
  signal?: AbortSignal
): Promise<IncidentBrief> {
  return request<IncidentBrief>(
    "/intelligence/brief",
    { method: "POST", body: JSON.stringify({ event_id: eventId }) },
    signal
  );
}

export interface CopilotRelatedEvent {
  id: string;
  facility_name: string;
  facility_type?: string;
  classification: string;
  frp_megawatts: number;
  brightness_temp_kelvin: number;
  cde_anomaly_score?: number;
  latitude: number;
  longitude: number;
  is_critical_alert: boolean;
}

export interface CopilotAnswer {
  question: string;
  answer: string;
  mode: "NEURAL" | "DOCTRINE";
  generated_at: string;
  latency_ms: number;
  events_considered: number;
  cached?: boolean;
  related_events?: CopilotRelatedEvent[];
}

export async function askCopilot(
  question: string,
  signal?: AbortSignal
): Promise<CopilotAnswer> {
  return request<CopilotAnswer>(
    "/intelligence/copilot",
    { method: "POST", body: JSON.stringify({ question }) },
    signal
  );
}

// ── Live WebSocket client ───────────────────────────────────────────────────

export type WsMessage =
  | { type: "connected"; session_id?: string; message?: string; timestamp?: string }
  | { type: "new_event"; event: HotspotEvent }
  | { type: "ping"; timestamp: string }
  | { type: "simulated_event"; event: HotspotEvent }
  | { type: string; [k: string]: unknown };

export type WsState = "connecting" | "open" | "closed" | "error";

export interface WsClient {
  socket: WebSocket | null;
  state: WsState;
  reconnectAttempts: number;
  close(): void;
}

export interface WsClientOptions {
  url?: string;
  onMessage?: (msg: WsMessage) => void;
  onStateChange?: (state: WsState) => void;
  /** Optional filters passed as query params to the backend. */
  filters?: {
    role?: string;
    severity?: string; // "CRITICAL,WARNING"
    critical_only?: boolean;
  };
  /** Initial reconnect delay (ms). */
  initialBackoff?: number;
  /** Max reconnect delay (ms). */
  maxBackoff?: number;
}

export function createWsClient(opts: WsClientOptions = {}): WsClient {
  const client: WsClient = {
    socket: null,
    state: "closed",
    reconnectAttempts: 0,
    close: () => {},
  };

  const initialBackoff = opts.initialBackoff ?? 1000;
  const maxBackoff = opts.maxBackoff ?? 30000;
  let manuallyClosed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const buildUrl = () => {
    const base = opts.url ?? getWsBase();
    if (!opts.filters) return base;
    const p = new URLSearchParams();
    if (opts.filters.role) p.set("role", opts.filters.role);
    if (opts.filters.severity) p.set("severity", opts.filters.severity);
    if (opts.filters.critical_only) p.set("critical_only", "true");
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const setState = (s: WsState) => {
    client.state = s;
    opts.onStateChange?.(s);
  };

  const connect = () => {
    if (manuallyClosed) return;
    try {
      setState("connecting");
      const ws = new WebSocket(buildUrl());
      client.socket = ws;

      ws.onopen = () => {
        client.reconnectAttempts = 0;
        setState("open");
      };

      ws.onerror = () => {
        setState("error");
      };

      ws.onclose = () => {
        setState("closed");
        client.socket = null;
        if (manuallyClosed) return;
        // Exponential backoff reconnect
        const delay = Math.min(
          initialBackoff * 2 ** client.reconnectAttempts,
          maxBackoff
        );
        client.reconnectAttempts++;
        timer = setTimeout(connect, delay);
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data) as WsMessage;
          opts.onMessage?.(data);
        } catch (err) {
          console.error("[ws] failed to parse message", err);
        }
      };
    } catch {
      setState("error");
      timer = setTimeout(connect, initialBackoff);
    }
  };

  client.close = () => {
    manuallyClosed = true;
    if (timer) clearTimeout(timer);
    try {
      client.socket?.close();
    } catch {
      /* ignore */
    }
    setState("closed");
  };

  connect();
  return client;
}
