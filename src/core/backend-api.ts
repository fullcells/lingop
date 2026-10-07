export const BE_API_PRODUCTION_URL = "https://lingoprocessor.omnilingualaccess.com";
export const BE_API_STAGING_URL =
  "https://8dcadfe3-0ab5-4955-b9b9-b245538d1706-00-2p8c2kfg1pll4.riker.replit.dev";
export const BE_API_GCLOUD_RUN_URL =
  "https://lingoprocessor-v20-mnykwbetrq-uc.a.run.app";

export type BackendTarget = "production" | "staging" | "gcloud-run";

/** Validate configuration strings before sending requests to a backend. */
export function parseBackendTarget(value: string | undefined): BackendTarget | undefined {
  if (value === undefined) return undefined;
  if (value === "production" || value === "staging" || value === "gcloud-run") return value;
  throw new Error(`Invalid Lingop backend target: ${value}`);
}

export type BEApiBaseUrlOptions = {
  /** Explicit selection takes precedence over the legacy staging flag. */
  backendTarget?: BackendTarget | undefined;
  useStagingBackend?: boolean | undefined;
};

export function getBEApiBaseUrl({
  backendTarget,
  useStagingBackend = false,
}: BEApiBaseUrlOptions = {}): string {
  const target = parseBackendTarget(backendTarget) ?? (useStagingBackend ? "staging" : "production");
  switch (target) {
    case "production": return BE_API_PRODUCTION_URL;
    case "staging": return BE_API_STAGING_URL;
    case "gcloud-run": return BE_API_GCLOUD_RUN_URL;
  }
}
