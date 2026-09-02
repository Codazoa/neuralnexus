/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  // Overridable output dir. Defaults to .next; local verification can
  // point at a fresh dir (e.g. NN_DIST_DIR=.nnext) if the default is
  // owned by another user.
  distDir: process.env.NN_DIST_DIR || '.next',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '/u/**',
      }
    ]
  }
}

module.exports = nextConfig
