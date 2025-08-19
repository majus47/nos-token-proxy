import { Request, Response } from "express";
import { APIFormatContext } from "../types/api";
import { APIMapper } from "../utils/apiMapper";
import { logTokenUsage } from "../utils/tokenUsage";

export async function handleNonStreamingRequest(
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

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    console.error(`Unexpected content type: ${contentType}`);
    const responseText = await response.text();
    console.error("Non-JSON response:", responseText.substring(0, 500));

    res.status(502).json({
      error: "Invalid response format",
      message: "API returned non-JSON response",
      contentType: contentType,
    });
    return false;
  }

  let responseData;
  try {
    responseData = await response.json();
  } catch (parseError) {
    console.error("JSON parse error:", parseError);
    const responseText = await response.text();
    console.error("Unparseable response:", responseText.substring(0, 500));

    res.status(502).json({
      error: "Response parsing failed",
      message: "Could not parse API response as JSON",
    });
    return false;
  }

  // Log token usage (before mapping)
  if (responseData.usage?.total_tokens) {
    // OpenAI format
    logTokenUsage(responseData.usage);
  } else if (responseData.usage?.input_tokens) {
    // Anthropic format
    logTokenUsage({
      total_tokens:
        responseData.usage.input_tokens + responseData.usage.output_tokens,
      prompt_tokens: responseData.usage.input_tokens,
      completion_tokens: responseData.usage.output_tokens,
    });
  }

  // Apply API format mapping using context
  responseData = APIMapper.mapResponse(responseData, context);

  res.status(response.status).json(responseData);
  return true;
}
