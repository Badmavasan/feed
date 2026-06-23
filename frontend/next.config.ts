import type { NextConfig } from 'next';
import nextI18NextConfig from './next-i18next.config.js';

// 从配置中解构出 i18n
const { i18n } = nextI18NextConfig as { i18n: NextConfig['i18n'] };

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  i18n, // 加上 i18n
  async rewrites() {
    // Server-side proxy target for backend-served static uploads.
    // In Docker this points at the backend service name (e.g. http://backend:3001);
    // locally it falls back to localhost.
    const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://localhost:3001';
    return [
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
