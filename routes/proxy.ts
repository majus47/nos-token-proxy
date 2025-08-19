import { Request, Response } from "express";
import { handleNonStreamingRequest } from "../services/nonStreamingService";
import { handleStreamingRequest } from "../services/streamingService";
import { APIMapper } from "../utils/apiMapper";
import { FormatDetector } from "../utils/formatDetector";

export async function proxyHandler(
  req: Request,
  res: Response,
  apiKey: string,
  targetApiUrl: string,
  model: string
): Promise<void> {
  try {
    const clientFormat = FormatDetector.detectClientFormat(
      req.originalUrl,
      req.body
    );
    const context = FormatDetector.createContext(clientFormat);
    console.log(
      `Request mapping: ${context.clientFormat} -> ${context.targetFormat} (mapping: ${context.needsMapping})`
    );

    let bodyData = APIMapper.mapRequest(req.body, context);
    bodyData.model = model;

    const endpoint = APIMapper.getTargetEndpoint(req.originalUrl, context);
    const targetUrl = targetApiUrl + endpoint;

    const isStreaming = bodyData.stream === true;
    console.log(
      `${isStreaming ? "Streaming" : "Non-streaming"} request to: ${targetUrl}`
    );

    let success = false;
    if (isStreaming) {
      success = await handleStreamingRequest(
        targetUrl,
        apiKey,
        bodyData,
        context,
        req,
        res
      );
    } else {
      success = await handleNonStreamingRequest(
        targetUrl,
        apiKey,
        bodyData,
        context,
        req,
        res
      );
    }

    if (!success && !res.headersSent) {
      res.status(500).json({ error: "Request failed" });
    }
  } catch (error: unknown) {
    console.error("Proxy error:", error);

    if (!res.headersSent) {
      if (error instanceof Error) {
        res.status(500).json({
          error: "Internal server error",
          message: error.message,
        });
      } else {
        res.status(500).json({ error: "Unknown error occurred" });
      }
    }
  }
}
