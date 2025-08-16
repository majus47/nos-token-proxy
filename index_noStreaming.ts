import axios, { AxiosError } from "axios";
import dotenv from "dotenv";
import express from "express";

import { Cache } from "./lib/Cache";

dotenv.config();

const app = express();

let apiTokenCache = new Map();
let apiTokenStatisticsCache = new Map();
let apiRequestStatisticsCache = new Map();
let apiMinuteCache = new Cache(60_000);
let apiHourCache = new Cache(3_600_000);
let apiDayCache = new Cache(8_640_000);

const API_KEYS = process.env.API_KEYS?.split(",") || [];
const TARGET_API_URL =
  process.env.TARGET_API_URL || "https://api.openai.com/v1";
const TARGET_API_HOST = new URL(TARGET_API_URL).host;

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});



app.use(express.json());
app.use("/nos-proxy/*splat", async (req, res) => {
    console.log("ORIGINAL URL: "+ req.originalUrl);
  try {
    // GET LATEST API KEY
    let chosenKey = null;

    if (API_KEYS.length > 0) {
      chosenKey = API_KEYS[apiTokenCache.get("current_key") || 0];

      apiTokenCache.set(
        "current_key",
        ((apiTokenCache.get("current_key") || 0) + 1) % API_KEYS.length
      );
    } else {
      console.error("No API keys configured");
      return res.status(401).json({ error: "No API keys provided" });
    }

    let bodyData : {model:string, stream: boolean} = req.body;
    bodyData.model = "z-ai/glm-4.5-air:free"
    bodyData.stream = false;
    //console.log(bodyData);

    // FETCH
    const response = await axios({
      method: req.method,
      url: TARGET_API_URL + req.originalUrl.replace("/nos-proxy", ""),
      headers: {
        authorization: `Bearer ${chosenKey}`,
      },
      data: bodyData,
    });

    res.status(response.status).json(response.data);

    // UPDATE STATISTICS
    const tokensUsed = response.data.usage?.total_tokens || 0;
    apiTokenStatisticsCache.set(
      chosenKey,
      (apiTokenStatisticsCache.get(chosenKey) || 0) + tokensUsed
    );
      
    apiRequestStatisticsCache.set(
      chosenKey,
      (apiRequestStatisticsCache.get(chosenKey) || 0) + 1
    );
      
    apiMinuteCache.set(chosenKey, tokensUsed);
    apiHourCache.set(chosenKey, tokensUsed);
    apiDayCache.set(chosenKey, tokensUsed);
  } catch (error  : unknown) { 
    
    const axiosError = error as AxiosError;
    if (axiosError.response) {
      res.status(axiosError.response.status).json(axiosError.response.data);
    } else if (axiosError.request) {
      res.status(503).json({ error: "Service unavailable" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});
  
// Endpoint to get current global token usage and request metrics
app.get("/usage-status", async (req, res) => {
  const totalTokensUsed = await getTotalTokensUsed();
  const totalRequests = await getTotalRequestsUsed();
       
  // Get usage per key statistics for all intervals   
  const usagePerKeyStats = API_KEYS.map((key) => {
    const requestsLastMinute = apiMinuteCache.get(key);
    const requestsLastHour = apiHourCache.get(key);
    const requestsLastDay = apiDayCache.get(key);
    return {
      name: key,
      tokensTotal: apiTokenStatisticsCache.get(key),
      requestsTotal: apiRequestStatisticsCache.get(key),
      requestsLastMinute: requestsLastMinute.length,
      tokensLastMinute: requestsLastMinute.reduce((acc: number, curr: number) => acc + curr, 0),
      requestsLastHour: requestsLastHour.length,
      tokensLastHour: requestsLastHour.reduce((acc: number, curr: number)  => acc + curr, 0),
      requestsLastDay: requestsLastDay.length,
      tokensLastDay: requestsLastDay.reduce((acc: number, curr: number)  => acc + curr, 0),
    };
  });
    
  res.json({
    totalTokensUsed,
    totalRequests,
    usagePerKeyStats,
  });
});
      
// Helper function to get total tokens used across all keys
const getTotalTokensUsed = async () => {
  const promises = Array.from( 
    apiTokenStatisticsCache.values(),
    (value) => value
  );
  const results = await Promise.all(promises);
      
  return results.reduce((acc, curr) => acc + curr, 0);
};   
   
const getTotalRequestsUsed = async () => {
  const promises = Array.from(
    apiRequestStatisticsCache.values(),
    (value) => value
  );
  const results = await Promise.all(promises);
       
  return results.reduce((acc, curr) => acc + curr, 0);
};
    
const server = app.listen(process.env.PORT || 4015, () => {
  console.log(`Proxy server listening on port ${process.env.PORT || 4015}`);
});
      
server.timeout = 5 * 60 * 1000;
      
      
