import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/my-diabacar",
        destination: "/my-diaba-auto",
        permanent: true,
      },
      {
        source: "/my-diabacar/:path*",
        destination: "/my-diaba-auto/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
