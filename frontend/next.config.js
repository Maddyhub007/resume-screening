/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        // Any request from the frontend to /api/* is transparently
        // forwarded to the Flask backend. The browser never sees
        // a cross-origin request — it looks like same-origin to localhost:3000.
        source:      "/api/:path*",
        destination: "http://localhost:5000/api/:path*",
      },
    ];
  },
  images: { unoptimized: true },
};
module.exports = nextConfig;
