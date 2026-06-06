/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['t.me', 'telegram.org'],
  },
  async rewrites() {
    // In Docker/production: BACKEND_URL=http://backend:4000
    // In local dev: falls back to localhost:4000
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
