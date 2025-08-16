
import { Request, Response } from 'express';
import { ProxyRequest } from '../types';
import { handleStreamingRequest } from '../services/streamingService';
import { handleNonStreamingRequest } from '../services/nonStreamingService';

export async function proxyHandler(
  req: Request, 
  res: Response,
  apiKey: string,
  targetApiUrl: string,
  model: string,
): Promise<void> {
  try {
    let bodyData: ProxyRequest = req.body;
    bodyData.model = model;
    
    const isStreaming = bodyData.stream === true;
    const targetUrl = targetApiUrl + req.originalUrl.replace("/nos-proxy", "");
    
    console.log(`${isStreaming ? 'Streaming' : 'Non-streaming'} request to: ${targetUrl}`);

    let success = false; 
    if (isStreaming) {
      success = await handleStreamingRequest(targetUrl, apiKey, bodyData, req, res); 
    } else {
      success = await handleNonStreamingRequest(targetUrl, apiKey, bodyData, req, res); 
    }
    
    if (!success && !res.headersSent) {  
      res.status(500).json({ error: 'Request failed' }); 
    }

  } catch (error: unknown) {
    console.error('Proxy error:', error);
    
    if (!res.headersSent) {
      if (error instanceof Error) {
        res.status(500).json({ 
          error: 'Internal server error',
          message: error.message 
        });
      } else {
        res.status(500).json({ error: 'Unknown error occurred' });
      }
    }
  }
}
