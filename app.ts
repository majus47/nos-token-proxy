import dotenv from "dotenv";
import express from "express";
import { configureServer } from "./config/server";
import { corsMiddleware, handleCorsOptions } from "./middleware/cors";
import { proxyHandler } from "./routes/proxy";
import { FormatDetector } from "./utils/formatDetector";

dotenv.config();
FormatDetector.initialize();

const app = express();
const TARGET_API_URL =
  process.env.TARGET_API_URL || "https://api.openai.com/v1";
const MODEL = process.env.MODEL || "qwen/qwen3-coder:free";
const API_KEYS = process.env.API_KEYS
  ? process.env.API_KEYS.split(",").map((key) => key.trim())
  : [];

if (API_KEYS.length === 0) {
  throw new Error(
    "Either API_KEY or API_KEYS environment variable is required"
  );
}

// Use single key if API_KEYS is not provided
let currentKeyIndex = 0;

function getNextApiKey(): string {
  const key = API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  console.log(
    `Using API key ${currentKeyIndex + 1}/${API_KEYS.length} (rotated)`
  );
  return key;
}
// Apply middleware
app.use(corsMiddleware);
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// Handle OPTIONS requests for CORS
app.options("/*splat", handleCorsOptions);

// Main proxy route
app.all("/*splat", async (req, res) => {
  const apiKey = getNextApiKey(); // CHANGED: was API_KEY
  console.log(`Call with: ${apiKey}`);
  console.log(MODEL);
  await proxyHandler(req, res, apiKey, TARGET_API_URL, MODEL);
});

const server = app.listen(process.env.PORT || 4015, () => {
  console.log(`Proxy server listening on port ${process.env.PORT || 4015}`);
});

configureServer(server);

export default app;
