/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['cheerio'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.cricclubs.com',
      },
    ],
  },
}

module.exports = nextConfig

