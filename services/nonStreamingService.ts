import { Request, Response } from 'express';
import { logTokenUsage } from '../utils/tokenUsage';

export async function handleNonStreamingRequest(
  targetUrl: string,
  apiKey: string,
  bodyData: any,
  req: Request,
  res: Response
): Promise<boolean> {
  const response = await fetch(targetUrl, {
    method: req.method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bodyData),
  });

  const responseData = await response.json();
  
  // Log token usage for non-streaming
  if (responseData.usage?.total_tokens) {
    logTokenUsage(responseData.usage);
  }
  
  res.status(response.status).json(responseData);
  return true;
}