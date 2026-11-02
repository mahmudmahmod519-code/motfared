/**
 * The backend's origin, without /api: API_URL (Docker: http://backend:3000). NEXT_PUBLIC_API_URL is still read
 * for older setups that pass it, and a trailing /api on either is dropped so the proxy never asks for /api/api.
 */
const apiOrigin = () =>
  (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/+$/, '').replace(/\/api$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Enable standalone output for Docker deployment
  output: 'standalone',

  // The browser only talks to this app: /api/* is forwarded to the backend.
  // Rewrites are fixed when the app is built, so API_URL must be set at build time (Dockerfile ARG).
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin()}/api/:path*` }];
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },

  // Image domains for production (add your domains)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;