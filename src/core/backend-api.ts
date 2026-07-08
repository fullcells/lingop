export const BE_API_PRODUCTION_URL = "https://lingoprocessor.omnilingualaccess.com";
export const BE_API_STAGING_URL =
  "https://8dcadfe3-0ab5-4955-b9b9-b245538d1706-00-2p8c2kfg1pll4.riker.replit.dev";
export const INTERNAL_API_BASE_URL = "https://camplingo.com";

export type BackendApiEnvironmentOptions = {
  useStagingBackend?: boolean;
};

export function getBEApiBaseUrl({
  useStagingBackend = false,
}: BackendApiEnvironmentOptions = {}): string {
  return useStagingBackend ? BE_API_STAGING_URL : BE_API_PRODUCTION_URL;
}
