import type { NextConfig } from "next";

// Phase 10 (Production Security): a static (nonce-free) CSP via next.config
// headers() rather than a proxy-injected nonce — nonces force every page
// into dynamic rendering (see Next.js's own CSP guide), which would
// regress the static optimization several routes already get (/about,
// /login, /register, ...). 'unsafe-inline' on style-src is the one real
// compromise this requires: the drag-and-drop image reorder UI (Phase 2,
// @dnd-kit) sets an inline `style` for its live transform, and there's no
// nonce plumbing here to allowlist just that.
const isDev = process.env.NODE_ENV === "development";

// Listing photos live in Supabase Storage (a remote host, not same-origin)
// — next/image requires an explicit remotePattern for any such host, and
// the CSP's img-src should be scoped to that same host rather than a
// blanket `https:`.
function supabaseHostname(): string | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname || null;
  } catch {
    return null;
  }
}
const supabaseHost = supabaseHostname();

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:${supabaseHost ? ` https://${supabaseHost}` : ""};
  font-src 'self';
  connect-src 'self'${supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ""};
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          // Belt-and-suspenders alongside frame-ancestors above — covers
          // older browsers that don't understand CSP's frame-ancestors.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Ignored by browsers on a plain-HTTP response, so this is safe
          // to always send regardless of how a given deployment terminates
          // TLS in front of Next.js.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
