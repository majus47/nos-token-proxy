import { APIFormat, APIFormatContext } from "../types/api";

export class FormatDetector {
  private static targetFormat: APIFormat | null = null;

  static initialize(): void {
    // Target format from environment, or null for auto-detection
    const envFormat = process.env.TARGET_API_FORMAT as APIFormat;
    this.targetFormat = envFormat || null;

    if (this.targetFormat) {
      console.log(`Target API format: ${this.targetFormat}`);
    } else {
      console.log("Target API format: auto-detect (same as client)");
    }
  }

  static detectClientFormat(path: string, body: any): APIFormat {
    // Primary detection: URL path
    if (path.includes("/v1/messages")) {
      return "anthropic";
    }
    if (path.includes("/chat/completions")) {
      return "openai";
    }

    // Fallback: body structure analysis
    if (
      body.max_tokens &&
      Array.isArray(body.messages) &&
      !body.messages.some((m: any) => m.role === "system")
    ) {
      return "anthropic";
    }

    return "openai"; // Default
  }

  static createContext(clientFormat: APIFormat): APIFormatContext {
    // If no target format specified, use client format (no mapping)
    const targetFormat = this.targetFormat || clientFormat;
    const needsMapping = clientFormat !== targetFormat;

    return {
      clientFormat,
      targetFormat,
      needsMapping,
    };
  }
}
