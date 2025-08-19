import { Request, Response } from "express";
import { APIFormatContext } from "../types/api";
import { APIMapper } from "../utils/apiMapper";
import { extractUsageFromChunk, logTokenUsage } from "../utils/tokenUsage";

export async function handleStreamingRequest(
  targetUrl: string,
  apiKey: string,
  bodyData: any,
  context: APIFormatContext,
  req: Request,
  res: Response
): Promise<boolean> {
  const response = await fetch(targetUrl, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyData),
  });

  if (!response.ok) {
    console.error(`API error: ${response.status} ${response.statusText}`);

    const errorText = await response.text();
    console.error("Error response:", errorText.substring(0, 500));

    res.status(response.status).json({
      error: `API Error: ${response.status}`,
      message: response.statusText,
      details: errorText.startsWith("<!DOCTYPE")
        ? "HTML error page returned"
        : errorText.substring(0, 200),
    });
    return false;
  }

  if (!response.body) {
    console.error("No response body from API");
    res.status(500).json({ error: "No response body from API" });
    return false;
  }

  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, Cache-Control",
    "X-Accel-Buffering": "no",
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let isStreamActive = true;

  // Handle client disconnect
  const cleanup = () => {
    isStreamActive = false;
    reader.cancel().catch(() => {});
  };

  req.on("close", cleanup);
  req.on("aborted", cleanup);
  res.on("close", cleanup);

  try {
    while (isStreamActive) {
      const { done, value } = await reader.read();

      if (done) break;
      if (!isStreamActive || res.destroyed) break;

      let chunk = decoder.decode(value, { stream: true });

      // Extract and log token usage (before mapping)
      const usage = extractUsageFromChunk(chunk);
      if (usage) {
        logTokenUsage(usage);
      }

      // Apply API format mapping using context
      chunk = APIMapper.mapStreamingChunk(chunk, context);

      res.write(chunk);
    }
  } catch (readError) {
    console.error("Stream read error:", readError);
    if (isStreamActive && !res.destroyed) {
      res.write(
        'data: {"error":{"message":"Stream read error","type":"stream_error"}}\n\n'
      );
      res.write("data: [DONE]\n\n");
    }
  } finally {
    cleanup();
    if (!res.destroyed) {
      res.end();
    }
  }

  return true;
}
