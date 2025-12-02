const { z } = require('zod');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { tool } = require('@langchain/core/tools');
const { getEnvironmentVariable } = require('@langchain/core/utils/env');
const { logger } = require('@librechat/data-schemas');

const DEFAULT_SYSTEM_PROMPT =
  'You are the Spec Kit DeepSeek agent. ' +
  'Apply Spec-Driven Development rigor: establish principles, capture specs, ' +
  'design plans, create tasks, and outline implementation guardrails. ' +
  'Always produce concise, actionable Markdown.';

/**
 * DeepSeek LLM client for Spec Kit workflows
 */
class DeepSeekLLM {
  constructor(options = {}) {
    // Support multiple ways to pass API key:
    // 1. Direct apiKey option
    // 2. From loadAuthValues (DEEPSEEK_API_KEY or DEEP_SEEK_API_KEY)
    // 3. From environment variables
    const apiKey =
      options.apiKey ||
      options.DEEPSEEK_API_KEY ||
      options.DEEP_SEEK_API_KEY ||
      getEnvironmentVariable('DEEPSEEK_API_KEY') ||
      getEnvironmentVariable('DEEP_SEEK_API_KEY');
    if (!apiKey) {
      throw new Error(
        'DEEPSEEK_API_KEY or DEEP_SEEK_API_KEY is required to use the Spec Kit tools.',
      );
    }

    this.apiKey = apiKey;
    this.model = options.model || 'deepseek-chat';
    this.baseUrl = (
      options.baseUrl ||
      process.env.DEEPSEEK_API_BASE ||
      'https://api.deepseek.com/v1'
    ).replace(/\/$/, '');
    this.systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    this.temperature = options.temperature || 0.2;
    this.maxTokens = options.maxTokens || 2048;
    this.timeout = options.timeout || 60000;
  }

  async call(prompt, stop = null) {
    const payload = {
      model: this.model,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: prompt },
      ],
    };

    if (stop) {
      payload.stop = stop;
    }

    const url = `${this.baseUrl}/chat/completions`;
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await axios.post(url, payload, {
        headers,
        timeout: this.timeout,
      });

      const data = response.data;
      const choices = data.choices || [];
      if (!choices.length) {
        throw new Error('DeepSeek response did not include any choices.');
      }

      const message = choices[0].message || {};
      const content = message.content || '';
      return content.trim();
    } catch (error) {
      if (error.response) {
        throw new Error(
          `DeepSeek API error: ${error.response.status} - ${error.response.data?.error?.message || error.message}`,
        );
      }
      throw new Error(`DeepSeek request failed: ${error.message}`);
    }
  }
}

/**
 * 用于生成开发工件的Spec Kit代理
 */
class SpecKitAgent {
  constructor(options = {}) {
    this.llm = new DeepSeekLLM(options);
    this.artifacts = new Map(); // In-memory artifact store (no file persistence)
    this.templateDir = path.join(__dirname, 'speckit-templates', 'prompts');
  }

  load(artifact) {
    return this.artifacts.get(artifact) || '';
  }

  save(artifact, content) {
    this.artifacts.set(artifact, content);
    return content;
  }

  readTemplate(templateName) {
    try {
      const templatePath = path.join(this.templateDir, `${templateName}.md`);
      return fs.readFileSync(templatePath, 'utf8');
    } catch (error) {
      logger.error(`Failed to read template ${templateName}: ${error.message}`);
      throw new Error(`Template ${templateName} not found.`);
    }
  }

  aggregate(artifacts = null) {
    const keys = artifacts || Array.from(this.artifacts.keys());
    const parts = [];
    for (const key of keys) {
      const text = this.load(key);
      if (text) {
        parts.push(`## ${key.charAt(0).toUpperCase() + key.slice(1)}\n${text}`);
      }
    }
    return parts.join('\n\n');
  }

  async generatePersona(mission) {
    const template = this.readTemplate('wechat_persona');
    const prompt = template.replace('$ARGUMENTS', mission);
    const text = await this.llm.call(prompt);
    return this.save('persona', text);
  }

  async generateContentSpec(mission, persona) {
    const template = this.readTemplate('wechat_content');
    const prompt = template
      .replace('$ARGUMENTS', mission)
      .replace('{{persona}}', persona);

    const text = await this.llm.call(prompt);
    return this.save('content', text);
  }

  async generateVisualPlan(mission, persona, content) {
    const template = this.readTemplate('wechat_visual');
    const prompt = template
      .replace('$ARGUMENTS', mission)
      .replace('{{persona}}', persona)
      .replace('{{content}}', content);

    const text = await this.llm.call(prompt);
    return this.save('visual', text);
  }

  async generateMoments(persona, content, visual) {
    const template = this.readTemplate('wechat_generate');
    const prompt = template
      .replace('{{persona}}', persona)
      .replace('{{content}}', content)
      .replace('{{visual}}', visual);

    const text = await this.llm.call(prompt);
    return this.save('moments', text);
  }

  async answerQuestion(question, artifacts = null) {
    const context = this.aggregate(artifacts);
    if (!context) {
      throw new Error(
        'No artifacts available for context. Generate documents before asking questions.',
      );
    }

    const prompt = `You are the Spec Kit DeepSeek agent. Ground every answer in the provided artifacts.

=== Context ===
${context}
=== End Context ===

Question: ${question}

Provide a concise yet complete answer, referencing the most relevant sections.`;

    return await this.llm.call(prompt);
  }
}

// Create a shared agent instance per user session
const agentStore = new Map();

function getAgent(userId, options = {}) {
  if (!agentStore.has(userId)) {
    agentStore.set(userId, new SpecKitAgent(options));
  }
  return agentStore.get(userId);
}

// Tool definitions
const specKitToolkit = {
  speckit_persona: {
    name: 'speckit_persona',
    description:
      'Define the target audience (Age groups) and Brand Voice for WeChat Moments. Use this first.',
    schema: z.object({
      mission: z
        .string()
        .describe('The product, service, or topic to promote.'),
      model: z.string().optional().describe('DeepSeek model identifier (default: deepseek-chat).'),
      baseUrl: z.string().url().optional().describe('Override DeepSeek API base URL.'),
      temperature: z
        .number()
        .min(0)
        .max(2)
        .optional()
        .describe('Sampling temperature (default: 0.2).'),
      maxTokens: z.number().optional().describe('Maximum tokens per request (default: 2048).'),
    }),
  },
  speckit_content: {
    name: 'speckit_content',
    description:
      'Create a content strategy (Angles, Key Messages, Emotional Hooks) based on the Persona. Requires persona to be generated first.',
    schema: z.object({
      mission: z.string().describe('The product, service, or topic to promote.'),
      model: z.string().optional().describe('DeepSeek model identifier (default: deepseek-chat).'),
      baseUrl: z.string().url().optional().describe('Override DeepSeek API base URL.'),
      temperature: z
        .number()
        .min(0)
        .max(2)
        .optional()
        .describe('Sampling temperature (default: 0.2).'),
      maxTokens: z.number().optional().describe('Maximum tokens per request (default: 2048).'),
    }),
  },
  speckit_visual: {
    name: 'speckit_visual',
    description:
      'Plan the visual strategy (Image Style, Layout - Single vs 9-Grid) for WeChat Moments. Requires persona and content to be generated first.',
    schema: z.object({
      mission: z.string().describe('The product, service, or topic to promote.'),
      model: z.string().optional().describe('DeepSeek model identifier (default: deepseek-chat).'),
      baseUrl: z.string().url().optional().describe('Override DeepSeek API base URL.'),
      temperature: z
        .number()
        .min(0)
        .max(2)
        .optional()
        .describe('Sampling temperature (default: 0.2).'),
      maxTokens: z.number().optional().describe('Maximum tokens per request (default: 2048).'),
    }),
  },
  speckit_generate: {
    name: 'speckit_generate',
    description:
      'Generate the final WeChat Moments Copy and Image Prompts. Requires persona, content, and visual plans to be generated first.',
    schema: z.object({
      model: z.string().optional().describe('DeepSeek model identifier (default: deepseek-chat).'),
      baseUrl: z.string().url().optional().describe('Override DeepSeek API base URL.'),
      temperature: z
        .number()
        .min(0)
        .max(2)
        .optional()
        .describe('Sampling temperature (default: 0.2).'),
      maxTokens: z.number().optional().describe('Maximum tokens per request (default: 2048).'),
    }),
  },
  speckit_answer: {
    name: 'speckit_answer',
    description:
      'Answer questions based on previously generated artifacts. Use this to query the generated documentation.',
    schema: z.object({
      question: z.string().describe('The question to answer based on generated artifacts.'),
      artifacts: z
        .array(z.string())
        .optional()
        .describe(
          'Specific artifacts to use as context (e.g., ["persona", "content"]). If not provided, all artifacts will be used.',
        ),
      model: z.string().optional().describe('DeepSeek model identifier (default: deepseek-chat).'),
      baseUrl: z.string().url().optional().describe('Override DeepSeek API base URL.'),
      temperature: z
        .number()
        .min(0)
        .max(2)
        .optional()
        .describe('Sampling temperature (default: 0.2).'),
      maxTokens: z.number().optional().describe('Maximum tokens per request (default: 2048).'),
    }),
  },
};

function createSpecKitTools(options = {}) {
  const userId = options.userId || 'default';
  const llmOptions = {
    apiKey: options.apiKey,
    model: options.model,
    baseUrl: options.baseUrl,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  };
  logger.info('===六、获取工具结果(SpecKitTools执行)===');

  const tools = [];

  // Persona tool
  tools.push(
    tool(async ({ mission, model, baseUrl, temperature, maxTokens }, runnableConfig) => {
      const agent = getAgent(userId, {
        ...llmOptions,
        model: model || llmOptions.model,
        baseUrl: baseUrl || llmOptions.baseUrl,
        temperature: temperature ?? llmOptions.temperature,
        maxTokens: maxTokens || llmOptions.maxTokens,
      });
      logger.info('1.开始创建用户画像 (Persona)');
      try {
        const result = await agent.generatePersona(mission);
        return result;
      } catch (error) {
        throw new Error(`Failed to generate persona: ${error.message}`);
      }
    }, specKitToolkit.speckit_persona),
  );

  // Content tool
  tools.push(
    tool(async ({ mission, model, baseUrl, temperature, maxTokens }, runnableConfig) => {
      const agent = getAgent(userId, {
        ...llmOptions,
        model: model || llmOptions.model,
        baseUrl: baseUrl || llmOptions.baseUrl,
        temperature: temperature ?? llmOptions.temperature,
        maxTokens: maxTokens || llmOptions.maxTokens,
      });
      logger.info('2.开始创建内容策略 (Content Strategy)');
      try {
        const persona = agent.load('persona');
        if (!persona) {
          throw new Error(
            'Persona must be generated first. Use speckit_persona before speckit_content.',
          );
        }

        const result = await agent.generateContentSpec(mission, persona);
        return result;
      } catch (error) {
        throw new Error(`Failed to generate content strategy: ${error.message}`);
      }
    }, specKitToolkit.speckit_content),
  );

  // Visual tool
  tools.push(
    tool(async ({ mission, model, baseUrl, temperature, maxTokens }, runnableConfig) => {
      const agent = getAgent(userId, {
        ...llmOptions,
        model: model || llmOptions.model,
        baseUrl: baseUrl || llmOptions.baseUrl,
        temperature: temperature ?? llmOptions.temperature,
        maxTokens: maxTokens || llmOptions.maxTokens,
      });
      logger.info('3.开始创建视觉策略 (Visual Strategy)');
      try {
        const persona = agent.load('persona');
        const content = agent.load('content');
        if (!persona || !content) {
          throw new Error(
            'Persona and Content Strategy must be generated first. Use speckit_persona and speckit_content before speckit_visual.',
          );
        }

        const result = await agent.generateVisualPlan(mission, persona, content);
        return result;
      } catch (error) {
        throw new Error(`Failed to generate visual strategy: ${error.message}`);
      }
    }, specKitToolkit.speckit_visual),
  );

  // Generate tool
  tools.push(
    tool(async ({ model, baseUrl, temperature, maxTokens }, runnableConfig) => {
      const agent = getAgent(userId, {
        ...llmOptions,
        model: model || llmOptions.model,
        baseUrl: baseUrl || llmOptions.baseUrl,
        temperature: temperature ?? llmOptions.temperature,
        maxTokens: maxTokens || llmOptions.maxTokens,
      });
      logger.info('4.开始生成朋友圈文案与图片提示词 (Generate Moments)');
      try {
        const persona = agent.load('persona');
        const content = agent.load('content');
        const visual = agent.load('visual');
        if (!persona || !content || !visual) {
          throw new Error(
            'Persona, Content, and Visual Strategy must be generated first. Use speckit_persona, speckit_content, and speckit_visual before speckit_generate.',
          );
        }

        const result = await agent.generateMoments(persona, content, visual);
        return result;
      } catch (error) {
        throw new Error(`Failed to generate moments: ${error.message}`);
      }
    }, specKitToolkit.speckit_generate),
  );

  // Answer tool
  tools.push(
    tool(
      async ({ question, artifacts, model, baseUrl, temperature, maxTokens }, runnableConfig) => {
        const agent = getAgent(userId, {
          ...llmOptions,
          model: model || llmOptions.model,
          baseUrl: baseUrl || llmOptions.baseUrl,
          temperature: temperature ?? llmOptions.temperature,
          maxTokens: maxTokens || llmOptions.maxTokens,
        });

        try {
          const result = await agent.answerQuestion(question, artifacts);
          return result;
        } catch (error) {
          throw new Error(`Failed to answer question: ${error.message}`);
        }
      },
      specKitToolkit.speckit_answer,
    ),
  );

  return tools;
}

createSpecKitTools.specKitToolkit = specKitToolkit;

module.exports = createSpecKitTools;
