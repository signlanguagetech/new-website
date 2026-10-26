import { defineConfig } from 'astro/config';

import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

const dev = process.env.NODE_ENV === "development";
const url = dev ? "http://localhost:4321" : "https://signlanguagetech.com";
const server = dev ? {
    host: true,
    allowedHosts: [".trycloudflare.com"]
  } : undefined;

export default defineConfig({
  site: url,
  integrations: [tailwind(), mdx(), sitemap()],
  output: "static",
  server: server
});
