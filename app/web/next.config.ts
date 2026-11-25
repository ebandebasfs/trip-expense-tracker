import type { NextConfig } from 'next';

// The browser calls /api/* on this origin. Next forwards it to the API, so the session cookie stays same-origin.
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/:path*',
      },
    ];
  },
};

export default nextConfig;
