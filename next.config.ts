import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** pdf-parse / pdfjs yerel modülleri; Vercel’de paketlenince çökme riski azalır */
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
