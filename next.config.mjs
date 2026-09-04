/** @type {import('next').NextConfig} */

// The published build is a fully static demo: no route handlers, no database,
// no outbound requests. Set NEXT_PUBLIC_DEMO_MODE=false to build the real app.
const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
const isDev = process.env.NODE_ENV !== "production";

// Next injects inline bootstrap scripts, so a production CSP has to allow them
// (or move to a nonce, which needs middleware and therefore a server).
const scriptSrc = isDev || isDemo ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline'";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Content-Security-Policy",
    value:
      `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ` +
      `font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self';`
  }
];

const nextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  reactStrictMode: true,

  // Static export for the demo. `next build` emits ./out, which any static host
  // (Cloudflare Pages, GitHub Pages, Netlify) can serve as-is.
  ...(isDemo
    ? {
        output: "export",
        trailingSlash: true,
        images: { unoptimized: true }
      }
    : {
        async headers() {
          return [{ source: "/(.*)", headers: securityHeaders }];
        }
      })
};

export default nextConfig;
