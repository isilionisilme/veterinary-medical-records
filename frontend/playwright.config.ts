import { defineConfig } from "@playwright/test";
import os from "node:os";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:15173";
const useExternalServers = process.env.PLAYWRIGHT_EXTERNAL_SERVERS === "1";
const cpuCount = os.cpus().length;
// Keep local runs fast by default, but avoid oversaturating the machine.
const localDefaultWorkers = Math.min(Math.max(6, Math.floor(cpuCount * 0.75)), 12);
const ciWorkersFromEnv = Number(process.env.PLAYWRIGHT_CI_WORKERS);
const ciWorkers = Number.isFinite(ciWorkersFromEnv) && ciWorkersFromEnv > 0 ? ciWorkersFromEnv : 6;
const workers = process.env.PLAYWRIGHT_WORKERS
  ? Number(process.env.PLAYWRIGHT_WORKERS)
  : process.env.CI
    ? ciWorkers
    : localDefaultWorkers;
const webServer = useExternalServers
  ? undefined
  : [
      {
        command:
          "python -m uvicorn backend.app.main:create_app --factory --host 127.0.0.1 --port 8000",
        url: "http://127.0.0.1:8000/openapi.json",
        cwd: "..",
        // Backend may already be running (local or CI docker stack).
        reuseExistingServer: true,
        timeout: 120_000,
      },
      {
        command: "node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 15173",
        url: baseURL,
        cwd: ".",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
    ];

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  workers,
  expect: {
    timeout: 5_000,
  },
  outputDir: "./test-results",
  // Stabilize CI against intermittent timing/network-related flakes.
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL,
    headless: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "smoke",
      testMatch: /app-loads|upload-smoke/,
      timeout: 30_000,
    },
    {
      name: "core",
      testMatch: /pdf-viewer|extracted-data|field-editing|review-workflow|document-sidebar/,
      timeout: 60_000,
    },
    {
      name: "extended",
      testMatch: /.*\.spec\.ts$/,
      timeout: 90_000,
    },
  ],
  webServer,
  reporter: [["html", { outputFolder: "playwright-report", open: "never" }]],
});
