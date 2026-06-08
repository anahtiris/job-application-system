import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to this folder. Without this, a stray
  // lockfile at the repo root makes Turbopack watch the whole repo (.venv,
  // databases, generated applications/), which leaks memory until the dev
  // server exhausts RAM and the machine crashes.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
