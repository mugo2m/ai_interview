import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* General Next.js Config Options */

  // Images (optional, uncomment if you need remote image patterns)
  // images: {
  //   remotePatterns: [
  //     {
  //       protocol: "https",
  //       hostname: "ik.imagekit.io",
  //       port: "",
  //     },
  //   ],
  // },

  // TypeScript build errors are ignored
  typescript: {
    ignoreBuildErrors: true,
  },

  // Other future-proof Next.js options can go here
};

export default nextConfig;
