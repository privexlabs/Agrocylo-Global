/**
 * Single source of truth for backend connection configuration.
 *
 * Set NEXT_PUBLIC_API_URL in `.env.local` for both REST and Socket.io.
 * Defaults to same-origin /api, which works with the repo's Caddy/proxy setup.
 */
const rawApiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

export const API_BASE_URL =
  rawApiBaseUrl && rawApiBaseUrl.length > 0 ? rawApiBaseUrl : "/api";
