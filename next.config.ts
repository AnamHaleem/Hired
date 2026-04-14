import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/resumes": [
      "./node_modules/@napi-rs/canvas/**/*",
    ],
  },
};

export default nextConfig;
