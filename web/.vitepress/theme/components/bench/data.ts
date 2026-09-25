// Fetches bench-data at runtime: the index plus per-run reports and plans
// (design/benchmarking.md §7-8). `?data=<base url>` overrides the default branch raw URL,
// for local fixtures and previews.
import type { BenchIndex, BenchSystem, Plan, Report } from "./types.ts";

export const DEFAULT_BASE = "https://raw.githubusercontent.com/enumeratio/enumeratio/bench-data/";

export function baseUrlFrom(search: string): string {
  const params = new URLSearchParams(search);
  const override = params.get("data");
  if (!override) return DEFAULT_BASE;
  return override.endsWith("/") ? override : `${override}/`;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new HttpError(res.status, url);
  return (await res.json()) as T;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`${status} fetching ${url}`);
  }
}

export async function loadIndex(base: string): Promise<BenchIndex> {
  return getJson<BenchIndex>(`${base}index.json`);
}

export async function loadPlan(base: string, runId: string): Promise<Plan> {
  return getJson<Plan>(`${base}runs/${runId}/plan.json`);
}

export async function loadReport(base: string, runId: string, system: BenchSystem): Promise<Report> {
  return getJson<Report>(`${base}runs/${runId}/${system}.json`);
}
