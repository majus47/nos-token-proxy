export interface TokenUsage {
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  } | null;
}

export interface ProxyRequest {
  model: string;
  stream?: boolean;
}
