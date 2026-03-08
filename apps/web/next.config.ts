import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@mercury/shared', '@mercury/ui'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
    ],
  },
};

export default nextConfig;
