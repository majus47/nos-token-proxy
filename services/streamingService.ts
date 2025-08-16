import { Request, Response } from 'express';
import { extractUsageFromChunk, logTokenUsage } from "../utils/tokenUsage"

export async function handleStreamingRequest(
  targetUrl: string,
  apiKey: string,
  bodyData: any,
  req: Request,
  res: Response
): Promise<boolean> {  // CHANGED: void -> boolean
  const response = await fetch(targetUrl, {
    method: req.method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bodyData),
  });

  if (!response.ok) {
    console.error(`API error: ${response.status}`);
    res.status(response.status).json({
      error: `API Error: ${response.status}`,
      message: await response.text()
    });
    return false;  // CHANGED: return -> return false
  }

  if (!response.body) {
    console.error('No response body from API');
    res.status(500).json({ error: 'No response body from API' });
    return false;  // CHANGED: return -> return false
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control',
    'X-Accel-Buffering': 'no',
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let isStreamActive = true;

  // Handle client disconnect
  const cleanup = () => {
    isStreamActive = false;
    reader.cancel().catch(() => {});
  };

  req.on('close', cleanup);
  req.on('aborted', cleanup);
  res.on('close', cleanup);

  try {
    while (isStreamActive) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (!isStreamActive || res.destroyed) break;

      const chunk = decoder.decode(value, { stream: true });

      // Extract and log token usage
      const usage = extractUsageFromChunk(chunk);
      if (usage) {
        logTokenUsage(usage);
      }

      res.write(chunk);
    }
  } catch (readError) {
    console.error('Stream read error:', readError);
    if (isStreamActive && !res.destroyed) {
      res.write('data: {"error":{"message":"Stream read error","type":"stream_error"}}\n\n');
      res.write('data: [DONE]\n\n');
    }
  } finally {
    cleanup();
    if (!res.destroyed) {
      res.end();
    }
  }
  
  return true;  // ADDED: new line
}