/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "standalone",
  typedRoutes: true,
  async rewrites() {
    const internal = process.env.INTERNAL_API_BASE;
    return internal
      ? [{ source: "/api/:path*", destination: `${internal}/api/:path*` }]
      : [];
  },
};

export default config;
