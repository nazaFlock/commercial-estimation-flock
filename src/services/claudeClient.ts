import { query } from '@anthropic-ai/claude-agent-sdk';
import { logger } from '../utils/logger.js';

class ClaudeClient {
  private async executeQuery(prompt: string, systemPrompt: string): Promise<string> {
    logger.debug('Calling Claude via Agent SDK');
    const q = query({
      prompt,
      options: {
        systemPrompt,
        tools: [],
        allowedTools: [],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        settingSources: [],
      },
    });

    let finalText = '';
    for await (const message of q) {
      if (message.type === 'result') {
        if (message.subtype === 'success') {
          finalText = message.result;
        } else {
          throw new Error(
            `Query failed (${message.subtype}): ${message.errors?.join('; ') ?? 'unknown error'}`,
          );
        }
      }
    }
    return finalText;
  }

  async sendMessage(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      return await this.executeQuery(userPrompt, systemPrompt);
    } catch (error) {
      logger.error(`Claude API call failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async sendJsonRequest<T>(
    systemPrompt: string,
    userPrompt: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    schema: object,
  ): Promise<T> {
    try {
      logger.debug('Calling Claude with JSON request');
      const result = await this.executeQuery(userPrompt, systemPrompt);

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      return JSON.parse(jsonMatch[0]) as T;
    } catch (error) {
      logger.error(
        `Claude JSON request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}

export const claudeClient = new ClaudeClient();
