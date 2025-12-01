const { z } = require('zod');
const axios = require('axios');
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
  }

  load(artifact) {
    return this.artifacts.get(artifact) || '';
  }

  save(artifact, content) {
    this.artifacts.set(artifact, content);
    return content;
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

  async generateConstitution(mission) {
    const previousConstitution = this.load('constitution');
    const prompt = `Mission:
${mission}

Previous constitution (optional):
${previousConstitution}

Craft a refreshed Spec Kit constitution with sections:
## Project Principles
## Engineering Guardrails
## Delivery Rituals
Each section must contain numbered lists with actionable statements.`;

    const text = await this.llm.call(prompt);
    return this.save('constitution', text);
  }

  async generateSpec(mission, constitution) {
    const previousSpec = this.load('spec');
    const prompt = `Mission:
${mission}

Constitution:
${constitution}

Previous spec (optional):
${previousSpec}

Write a Spec Kit specification in Markdown with sections:
## Summary
## Personas & Jobs-to-be-Done
## User Stories
## Functional Requirements
## Non-Functional Requirements
## Acceptance Criteria
## Risks & Open Questions
Keep each section actionable and reference the constitution when reinforcing constraints.`;

    const text = await this.llm.call(prompt);
    return this.save('spec', text);
  }

  async generatePlan(mission, constitution, spec) {
    const previousPlan = this.load('plan');
    const prompt = `Mission:
${mission}

Constitution:
${constitution}

Specification:
${spec}

Previous plan (optional):
${previousPlan}

Create an implementation plan with sections:
## Architecture Overview
## Key Decisions
## Implementation Steps
## Testing Strategy
## Deployment & Operations
Anchor the plan in the constitution and spec, include explicit sequencing and checkpoints.`;

    const text = await this.llm.call(prompt);
    return this.save('plan', text);
  }

  async generateTasks(plan, spec, constitution) {
    const prompt = `Plan:
${plan}

Specification:
${spec}

Constitution:
${constitution}

Translate the plan into a Markdown table with columns: Story, Task, Definition of Done, Dependencies.
Group tasks per user story and ensure each task references guardrails.`;

    const text = await this.llm.call(prompt);
    return this.save('tasks', text);
  }

  async generateImplementation(plan, tasks, constitution) {
    const prompt = `Plan:
${plan}

Tasks:
${tasks}

Constitution:
${constitution}

Write an implementation brief with sections:
## Build Order
## Quality Gates
## Deployment Readiness Checklist
## Observability & Runbooks
Focus on how the team will execute the plan safely and measurably.`;

    const text = await this.llm.call(prompt);
    return this.save('implementation', text);
  }

  async generateAnalysis(constitution, spec, plan, tasks) {
    const prompt = `Constitution:
${constitution}

Spec:
${spec}

Plan:
${plan}

Tasks:
${tasks}

Provide a Spec Kit alignment report with sections:
## Critical Gaps
## Emerging Risks
## Recommended Follow-ups
Highlight contradictions or missing coverage. Keep the tone factual.`;

    const text = await this.llm.call(prompt);
    return this.save('analysis', text);
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
  speckit_constitution: {
    name: 'speckit_constitution',
    description:
      'Establish project principles, engineering guardrails, and delivery rituals. This is the foundation of Spec-Driven Development. Use this first to set up the project constitution.',
    schema: z.object({
      mission: z
        .string()
        .describe('High-level mission or problem statement to drive the workflow.'),
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
  speckit_specify: {
    name: 'speckit_specify',
    description:
      'Create a baseline specification with personas, user stories, functional/non-functional requirements, and acceptance criteria. Requires constitution to be generated first.',
    schema: z.object({
      mission: z.string().describe('High-level mission or problem statement.'),
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
  speckit_plan: {
    name: 'speckit_plan',
    description:
      'Create an implementation plan with architecture overview, key decisions, implementation steps, testing strategy, and deployment operations. Requires constitution and spec to be generated first.',
    schema: z.object({
      mission: z.string().describe('High-level mission or problem statement.'),
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
  speckit_tasks: {
    name: 'speckit_tasks',
    description:
      'Generate actionable tasks from the plan, organized by user story with definitions of done and dependencies. Requires plan, spec, and constitution to be generated first.',
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
  speckit_implement: {
    name: 'speckit_implement',
    description:
      'Generate implementation brief with build order, quality gates, deployment readiness checklist, and observability runbooks. Requires plan, tasks, and constitution to be generated first.',
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
  speckit_analyze: {
    name: 'speckit_analyze',
    description:
      'Generate a cross-artifact alignment report highlighting critical gaps, emerging risks, and recommended follow-ups. Requires constitution, spec, plan, and tasks to be generated first.',
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
  speckit_clarify: {
    name: 'speckit_clarify',
    description:
      'Ask structured questions to de-risk ambiguous areas before planning. Use this before speckit_plan if you need to clarify requirements.',
    schema: z.object({
      mission: z.string().describe('High-level mission or problem statement.'),
      questions: z
        .string()
        .optional()
        .describe(
          'Specific areas or topics to clarify. If not provided, the tool will generate relevant questions.',
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
  speckit_checklist: {
    name: 'speckit_checklist',
    description:
      'Generate quality checklists to validate requirements completeness, clarity, and consistency. Use this after speckit_plan to ensure quality.',
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
      'Answer questions based on previously generated artifacts (constitution, spec, plan, tasks, etc.). Use this to query the generated documentation.',
    schema: z.object({
      question: z.string().describe('The question to answer based on generated artifacts.'),
      artifacts: z
        .array(z.string())
        .optional()
        .describe(
          'Specific artifacts to use as context (e.g., ["constitution", "spec"]). If not provided, all artifacts will be used.',
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

  // Constitution tool
  tools.push(
    tool(async ({ mission, model, baseUrl, temperature, maxTokens }, runnableConfig) => {
      const agent = getAgent(userId, {
        ...llmOptions,
        model: model || llmOptions.model,
        baseUrl: baseUrl || llmOptions.baseUrl,
        temperature: temperature ?? llmOptions.temperature,
        maxTokens: maxTokens || llmOptions.maxTokens,
      });
      logger.info('1.开始创建项目宪法');
      try {
        const result = await agent.generateConstitution(mission);
        return result;
      } catch (error) {
        throw new Error(`Failed to generate constitution: ${error.message}`);
      }
    }, specKitToolkit.speckit_constitution),
  );

  // Specify tool
  tools.push(
    tool(async ({ mission, model, baseUrl, temperature, maxTokens }, runnableConfig) => {
      const agent = getAgent(userId, {
        ...llmOptions,
        model: model || llmOptions.model,
        baseUrl: baseUrl || llmOptions.baseUrl,
        temperature: temperature ?? llmOptions.temperature,
        maxTokens: maxTokens || llmOptions.maxTokens,
      });
      logger.info('2.开始创建项目规范说明书');
      try {
        const constitution = agent.load('constitution');
        if (!constitution) {
          throw new Error(
            'Constitution must be generated first. Use speckit_constitution before speckit_specify.',
          );
        }

        const result = await agent.generateSpec(mission, constitution);
        return result;
      } catch (error) {
        throw new Error(`Failed to generate spec: ${error.message}`);
      }
    }, specKitToolkit.speckit_specify),
  );

  // Plan tool
  tools.push(
    tool(async ({ mission, model, baseUrl, temperature, maxTokens }, runnableConfig) => {
      const agent = getAgent(userId, {
        ...llmOptions,
        model: model || llmOptions.model,
        baseUrl: baseUrl || llmOptions.baseUrl,
        temperature: temperature ?? llmOptions.temperature,
        maxTokens: maxTokens || llmOptions.maxTokens,
      });
      logger.info('3.开始创建项目实施计划');
      try {
        const constitution = agent.load('constitution');
        const spec = agent.load('spec');
        if (!constitution || !spec) {
          throw new Error(
            'Constitution and spec must be generated first. Use speckit_constitution and speckit_specify before speckit_plan.',
          );
        }

        const result = await agent.generatePlan(mission, constitution, spec);
        return result;
      } catch (error) {
        throw new Error(`Failed to generate plan: ${error.message}`);
      }
    }, specKitToolkit.speckit_plan),
  );

  // Tasks tool
  tools.push(
    tool(async ({ model, baseUrl, temperature, maxTokens }, runnableConfig) => {
      const agent = getAgent(userId, {
        ...llmOptions,
        model: model || llmOptions.model,
        baseUrl: baseUrl || llmOptions.baseUrl,
        temperature: temperature ?? llmOptions.temperature,
        maxTokens: maxTokens || llmOptions.maxTokens,
      });
      logger.info('4.开始创建项目任务清单');
      try {
        const plan = agent.load('plan');
        const spec = agent.load('spec');
        const constitution = agent.load('constitution');
        if (!plan || !spec || !constitution) {
          throw new Error(
            'Plan, spec, and constitution must be generated first. Use speckit_plan, speckit_specify, and speckit_constitution before speckit_tasks.',
          );
        }

        const result = await agent.generateTasks(plan, spec, constitution);
        return result;
      } catch (error) {
        throw new Error(`Failed to generate tasks: ${error.message}`);
      }
    }, specKitToolkit.speckit_tasks),
  );

  // Implementation tool
  tools.push(
    tool(async ({ model, baseUrl, temperature, maxTokens }, runnableConfig) => {
      const agent = getAgent(userId, {
        ...llmOptions,
        model: model || llmOptions.model,
        baseUrl: baseUrl || llmOptions.baseUrl,
        temperature: temperature ?? llmOptions.temperature,
        maxTokens: maxTokens || llmOptions.maxTokens,
      });
      logger.info('5.开始创建项目实施方案');
      try {
        const plan = agent.load('plan');
        const tasks = agent.load('tasks');
        const constitution = agent.load('constitution');
        if (!plan || !tasks || !constitution) {
          throw new Error(
            'Plan, tasks, and constitution must be generated first. Use speckit_plan, speckit_tasks, and speckit_constitution before speckit_implement.',
          );
        }

        const result = await agent.generateImplementation(plan, tasks, constitution);
        return result;
      } catch (error) {
        throw new Error(`Failed to generate implementation: ${error.message}`);
      }
    }, specKitToolkit.speckit_implement),
  );

  // Analysis tool
  tools.push(
    tool(async ({ model, baseUrl, temperature, maxTokens }, runnableConfig) => {
      const agent = getAgent(userId, {
        ...llmOptions,
        model: model || llmOptions.model,
        baseUrl: baseUrl || llmOptions.baseUrl,
        temperature: temperature ?? llmOptions.temperature,
        maxTokens: maxTokens || llmOptions.maxTokens,
      });

      try {
        const constitution = agent.load('constitution');
        const spec = agent.load('spec');
        const plan = agent.load('plan');
        const tasks = agent.load('tasks');
        if (!constitution || !spec || !plan || !tasks) {
          throw new Error(
            'Constitution, spec, plan, and tasks must be generated first. Use speckit_constitution, speckit_specify, speckit_plan, and speckit_tasks before speckit_analyze.',
          );
        }

        const result = await agent.generateAnalysis(constitution, spec, plan, tasks);
        return result;
      } catch (error) {
        throw new Error(`Failed to generate analysis: ${error.message}`);
      }
    }, specKitToolkit.speckit_analyze),
  );

  // Clarify tool
  tools.push(
    tool(async ({ mission, questions, model, baseUrl, temperature, maxTokens }, runnableConfig) => {
      const agent = getAgent(userId, {
        ...llmOptions,
        model: model || llmOptions.model,
        baseUrl: baseUrl || llmOptions.baseUrl,
        temperature: temperature ?? llmOptions.temperature,
        maxTokens: maxTokens || llmOptions.maxTokens,
      });

      try {
        const prompt = questions
          ? `Mission:
${mission}

Areas to clarify:
${questions}

Generate structured questions to de-risk ambiguous areas in the mission. Focus on:
- Requirements clarity
- Technical constraints
- User expectations
- Success criteria
- Potential risks

Provide questions in a clear, actionable format.`
          : `Mission:
${mission}

Generate structured questions to de-risk ambiguous areas before planning. Focus on:
- Requirements clarity
- Technical constraints
- User expectations
- Success criteria
- Potential risks

Provide questions in a clear, actionable format.`;

        const result = await agent.llm.call(prompt);
        return result;
      } catch (error) {
        throw new Error(`Failed to generate clarification questions: ${error.message}`);
      }
    }, specKitToolkit.speckit_clarify),
  );

  // Checklist tool
  tools.push(
    tool(async ({ model, baseUrl, temperature, maxTokens }, runnableConfig) => {
      const agent = getAgent(userId, {
        ...llmOptions,
        model: model || llmOptions.model,
        baseUrl: baseUrl || llmOptions.baseUrl,
        temperature: temperature ?? llmOptions.temperature,
        maxTokens: maxTokens || llmOptions.maxTokens,
      });

      try {
        const constitution = agent.load('constitution');
        const spec = agent.load('spec');
        const plan = agent.load('plan');
        if (!constitution || !spec || !plan) {
          throw new Error(
            'Constitution, spec, and plan must be generated first. Use speckit_constitution, speckit_specify, and speckit_plan before speckit_checklist.',
          );
        }

        const prompt = `Constitution:
${constitution}

Specification:
${spec}

Plan:
${plan}

Generate quality checklists to validate:
- Requirements completeness
- Requirements clarity
- Requirements consistency
- Alignment with constitution
- Plan feasibility

Provide checklists in a clear, actionable format with checkboxes.`;

        const result = await agent.llm.call(prompt);
        return result;
      } catch (error) {
        throw new Error(`Failed to generate checklist: ${error.message}`);
      }
    }, specKitToolkit.speckit_checklist),
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
