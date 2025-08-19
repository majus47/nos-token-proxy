import {
  AnthropicMessage,
  AnthropicRequest,
  AnthropicResponse,
  APIFormatContext,
  OpenAIMessage,
  OpenAIRequest,
  OpenAIResponse,
} from "../types/api";

export class APIMapper {
  static mapRequest(body: any, context: APIFormatContext): any {
    if (!context.needsMapping) return body;

    if (
      context.clientFormat === "anthropic" &&
      context.targetFormat === "openai"
    ) {
      return this.anthropicToOpenAI(body);
    }

    if (
      context.clientFormat === "openai" &&
      context.targetFormat === "anthropic"
    ) {
      return this.openAIToAnthropic(body);
    }

    return body;
  }

  static mapResponse(response: any, context: APIFormatContext): any {
    if (!context.needsMapping) return response;

    if (
      context.targetFormat === "anthropic" &&
      context.clientFormat === "openai"
    ) {
      return this.anthropicResponseToOpenAI(response);
    }

    if (
      context.targetFormat === "openai" &&
      context.clientFormat === "anthropic"
    ) {
      return this.openAIResponseToAnthropic(response);
    }

    return response;
  }

  static mapStreamingChunk(chunk: string, context: APIFormatContext): string {
    if (!context.needsMapping) return chunk;

    try {
      const lines = chunk.split("\n");
      const convertedLines: string[] = [];

      for (const line of lines) {
        if (!line.startsWith("data: ") || line === "data: [DONE]") {
          convertedLines.push(line);
          continue;
        }

        const dataStr = line.slice(6);
        if (dataStr === "[DONE]") {
          convertedLines.push(line);
          continue;
        }

        try {
          const data = JSON.parse(dataStr);
          let convertedData;

          if (
            context.targetFormat === "anthropic" &&
            context.clientFormat === "openai"
          ) {
            convertedData = this.convertAnthropicStreamToOpenAI(data);
          } else if (
            context.targetFormat === "openai" &&
            context.clientFormat === "anthropic"
          ) {
            convertedData = this.convertOpenAIStreamToAnthropic(data);
          } else {
            convertedData = data;
          }

          convertedLines.push(`data: ${JSON.stringify(convertedData)}`);
        } catch (parseError) {
          convertedLines.push(line);
        }
      }

      return convertedLines.join("\n");
    } catch (error) {
      return chunk;
    }
  }

  static getTargetEndpoint(
    originalUrl: string,
    context: APIFormatContext
  ): string {

    // If no mapping needed, use original endpoint
    if (!context.needsMapping) {
      return originalUrl;
    }

    // Map endpoints when converting between API formats
    if (
      context.clientFormat === "anthropic" &&
      context.targetFormat === "openai"
    ) {
      // Client sent /v1/messages → Target needs /v1/chat/completions
      return "/v1/chat/completions";
    }

    if (
      context.clientFormat === "openai" &&
      context.targetFormat === "anthropic"
    ) {
      // Client sent /v1/chat/completions → Target needs /v1/messages
      return "/v1/messages";
    }

    return originalUrl;
  }

  // Private mapping methods with tool calling support
  private static anthropicToOpenAI(
    anthropicReq: AnthropicRequest
  ): OpenAIRequest {
    const openAIMessages: OpenAIMessage[] = [];

    if (anthropicReq.system) {
      openAIMessages.push({
        role: "system",
        content: anthropicReq.system,
      });
    }

    for (const message of anthropicReq.messages) {
      if (message.role === "user") {
        let content: string;
        let toolResults: any[] = [];

        if (typeof message.content === "string") {
          content = message.content;
        } else if (Array.isArray(message.content)) {
          // Separate text and tool results
          const textBlocks = message.content.filter(
            (block) => block.type === "text"
          );
          toolResults = message.content.filter(
            (block) => block.type === "tool_result"
          );

          content = textBlocks.map((block) => block.text || "").join("");
        } else {
          content = "";
        }

        // Add user message
        openAIMessages.push({
          role: "user",
          content,
        });

        // Add tool result messages
        for (const toolResult of toolResults) {
          openAIMessages.push({
            role: "tool",
            content: toolResult.content || "",
            tool_call_id: toolResult.tool_use_id || "",
            name: toolResult.name || "",
          });
        }
      } else if (message.role === "assistant") {
        let content = "";
        let toolCalls: any[] = [];

        if (typeof message.content === "string") {
          content = message.content;
        } else if (Array.isArray(message.content)) {
          // Separate text and tool calls
          const textBlocks = message.content.filter(
            (block) => block.type === "text"
          );
          const toolUseBlocks = message.content.filter(
            (block) => block.type === "tool_use"
          );

          content = textBlocks.map((block) => block.text || "").join("");

          toolCalls = toolUseBlocks.map((block) => ({
            id: block.id || "",
            type: "function" as const,
            function: {
              name: block.name || "",
              arguments: JSON.stringify(block.input || {}),
            },
          }));
        }

        const assistantMessage: OpenAIMessage = {
          role: "assistant",
          content: content || null,
        };

        if (toolCalls.length > 0) {
          assistantMessage.tool_calls = toolCalls;
        }

        openAIMessages.push(assistantMessage);
      }
    }

    const result: OpenAIRequest = {
      model: anthropicReq.model,
      messages: openAIMessages,
      max_tokens: anthropicReq.max_tokens,
      stream: anthropicReq.stream,
    };

    // Convert tools
    if (anthropicReq.tools) {
      result.tools = anthropicReq.tools.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        },
      }));
    }

    // Convert tool_choice
    if (anthropicReq.tool_choice) {
      if (anthropicReq.tool_choice.type === "auto") {
        result.tool_choice = "auto";
      } else if (anthropicReq.tool_choice.type === "any") {
        result.tool_choice = "required";
      } else if (
        anthropicReq.tool_choice.type === "tool" &&
        anthropicReq.tool_choice.name
      ) {
        result.tool_choice = {
          type: "function",
          function: { name: anthropicReq.tool_choice.name },
        };
      }
    }

    if (anthropicReq.temperature !== undefined)
      result.temperature = anthropicReq.temperature;
    if (anthropicReq.top_p !== undefined) result.top_p = anthropicReq.top_p;
    if (anthropicReq.stop_sequences) result.stop = anthropicReq.stop_sequences;

    return result;
  }

  private static openAIToAnthropic(openAIReq: OpenAIRequest): AnthropicRequest {
    const anthropicMessages: AnthropicMessage[] = [];
    let systemPrompt: string | undefined;

    let i = 0;
    while (i < openAIReq.messages.length) {
      const message = openAIReq.messages[i];

      if (message.role === "system") {
        systemPrompt = message.content || "";
        i++;
      } else if (message.role === "user") {
        const content: any[] = [];

        // Add text content
        if (message.content) {
          content.push({
            type: "text",
            text: message.content,
          });
        }

        // Look ahead for tool messages that belong to this user turn
        let j = i + 1;
        while (
          j < openAIReq.messages.length &&
          openAIReq.messages[j].role === "tool"
        ) {
          const toolMsg = openAIReq.messages[j];
          content.push({
            type: "tool_result",
            tool_use_id: toolMsg.tool_call_id || "",
            content: toolMsg.content || "",
          });
          j++;
        }

        anthropicMessages.push({
          role: "user",
          content:
            content.length === 1 && content[0].type === "text"
              ? content[0].text
              : content,
        });

        i = j; // Skip processed tool messages
      } else if (message.role === "assistant") {
        const content: any[] = [];

        // Add text content
        if (message.content) {
          content.push({
            type: "text",
            text: message.content,
          });
        }

        // Add tool calls
        if (message.tool_calls) {
          for (const toolCall of message.tool_calls) {
            content.push({
              type: "tool_use",
              id: toolCall.id,
              name: toolCall.function.name,
              input: JSON.parse(toolCall.function.arguments || "{}"),
            });
          }
        }

        anthropicMessages.push({
          role: "assistant",
          content:
            content.length === 1 && content[0].type === "text"
              ? content[0].text
              : content,
        });

        i++;
      } else {
        i++; // Skip unknown roles
      }
    }

    const result: AnthropicRequest = {
      model: openAIReq.model,
      messages: anthropicMessages,
      max_tokens: openAIReq.max_tokens || 1024,
      stream: openAIReq.stream,
    };

    // Convert tools
    if (openAIReq.tools) {
      result.tools = openAIReq.tools.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters,
      }));
    }

    // Convert tool_choice
    if (openAIReq.tool_choice) {
      if (openAIReq.tool_choice === "auto") {
        result.tool_choice = { type: "auto" };
      } else if (openAIReq.tool_choice === "required") {
        result.tool_choice = { type: "any" };
      } else if (openAIReq.tool_choice === "none") {
        // Don't set tool_choice for 'none'
      } else if (typeof openAIReq.tool_choice === "object") {
        result.tool_choice = {
          type: "tool",
          name: openAIReq.tool_choice.function.name,
        };
      }
    }

    if (systemPrompt) result.system = systemPrompt;
    if (openAIReq.temperature !== undefined)
      result.temperature = openAIReq.temperature;
    if (openAIReq.top_p !== undefined) result.top_p = openAIReq.top_p;
    if (openAIReq.stop) {
      result.stop_sequences = Array.isArray(openAIReq.stop)
        ? openAIReq.stop
        : [openAIReq.stop];
    }

    return result;
  }

  private static anthropicResponseToOpenAI(
    anthropicResp: AnthropicResponse
  ): OpenAIResponse {
    let content = "";
    let toolCalls: any[] = [];

    for (const block of anthropicResp.content) {
      if (block.type === "text") {
        content += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          type: "function",
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input || {}),
          },
        });
      }
    }

    const choice: any = {
      index: 0,
      message: {
        role: "assistant",
        content: content || null,
      },
      finish_reason: anthropicResp.stop_reason,
    };

    if (toolCalls.length > 0) {
      choice.message.tool_calls = toolCalls;
    }

    return {
      id: anthropicResp.id,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: anthropicResp.model,
      choices: [choice],
      usage: {
        prompt_tokens: anthropicResp.usage.input_tokens,
        completion_tokens: anthropicResp.usage.output_tokens,
        total_tokens:
          anthropicResp.usage.input_tokens + anthropicResp.usage.output_tokens,
      },
    };
  }

  private static openAIResponseToAnthropic(
    openAIResp: OpenAIResponse
  ): AnthropicResponse {
    const choice = openAIResp.choices[0];
    const content: any[] = [];

    // Add text content
    if (choice.message.content) {
      content.push({
        type: "text",
        text: choice.message.content,
      });
    }

    // Add tool calls - now properly typed
    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: "tool_use",
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments || "{}"),
        });
      }
    }

    return {
      id: openAIResp.id,
      type: "message",
      role: "assistant",
      content: content,
      model: openAIResp.model,
      stop_reason: choice.finish_reason,
      stop_sequence: null,
      usage: {
        input_tokens: openAIResp.usage.prompt_tokens,
        output_tokens: openAIResp.usage.completion_tokens,
      },
    };
  }

  private static convertAnthropicStreamToOpenAI(data: any): any {
    if (data.type === "message_start") {
      return {
        id: data.message.id,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: data.message.model,
        choices: [
          { index: 0, delta: { role: "assistant" }, finish_reason: null },
        ],
      };
    }

    if (
      data.type === "content_block_delta" &&
      data.delta.type === "text_delta"
    ) {
      return {
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "unknown",
        choices: [
          {
            index: 0,
            delta: { content: data.delta.text },
            finish_reason: null,
          },
        ],
      };
    }

    if (data.type === "message_delta") {
      return {
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "unknown",
        choices: [
          { index: 0, delta: {}, finish_reason: data.delta.stop_reason },
        ],
        usage: data.usage
          ? {
              prompt_tokens: data.usage.input_tokens || 0,
              completion_tokens: data.usage.output_tokens || 0,
              total_tokens:
                (data.usage.input_tokens || 0) +
                (data.usage.output_tokens || 0),
            }
          : undefined,
      };
    }

    return data;
  }

  private static convertOpenAIStreamToAnthropic(data: any): any {
    if (data.object === "chat.completion.chunk") {
      const choice = data.choices?.[0];

      if (choice?.delta?.role) {
        return {
          type: "message_start",
          message: {
            id: data.id,
            type: "message",
            role: "assistant",
            content: [],
            model: data.model,
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 1 },
          },
        };
      }

      if (choice?.delta?.content) {
        return {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: choice.delta.content },
        };
      }

      if (choice?.finish_reason) {
        return {
          type: "message_delta",
          delta: { stop_reason: choice.finish_reason, stop_sequence: null },
          usage: data.usage
            ? {
                input_tokens: data.usage.prompt_tokens,
                output_tokens: data.usage.completion_tokens,
              }
            : undefined,
        };
      }
    }

    return data;
  }
}
