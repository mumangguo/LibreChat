const axios = require('axios');
const { v4 } = require('uuid');
const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { logger } = require('@librechat/data-schemas');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { ContentTypes } = require('librechat-data-provider');

const displayMessage =
  "ModelScope Qwen-Image generated an image. All generated images are already plainly visible, so don't repeat the descriptions in detail. Do not list download links as they are available in the UI already. The user may download the images by clicking on them, but do not mention anything about downloading to the user.";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toolkit = {
  modelscope_qwen_image: {
    name: 'modelscope_qwen_image',
    description:
      'Generate high-quality, photorealistic images using the Qwen-Image model hosted on ModelScope.',
    schema: z.object({
      prompt: z
        .string()
        .max(32000)
        .describe(
          'Describe the desired scene in rich visual detail (subjects, lighting, composition, style, mood, background).',
        ),
      model: z
        .string()
        .optional()
        .describe('Optional ModelScope model identifier. Defaults to Qwen/Qwen-Image.'),
      parameters: z
        .record(z.union([z.string(), z.number(), z.boolean()]))
        .optional()
        .describe(
          'Optional raw ModelScope parameters (e.g., {"size":"1024x1024","negative_prompt":"text"}).',
        ),
    }),
    responseFormat: 'content_and_artifact',
  },
};

const getAxiosConfig = (signal, timeoutMs) => {
  const config = {
    timeout: timeoutMs,
    signal,
  };

  if (process.env.PROXY) {
    const agent = new HttpsProxyAgent(process.env.PROXY);
    config.httpsAgent = agent;
    config.proxy = false;
  }

  return config;
};

const resolveImageUrl = (entry) => {
  if (!entry) {
    return null;
  }
  if (typeof entry === 'string') {
    return entry;
  }
  if (typeof entry === 'object') {
    return entry.url || entry.href || entry.image_url || null;
  }
  return null;
};

async function fetchBase64(imageUrl, signal, timeoutMs) {
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    ...getAxiosConfig(signal, timeoutMs),
  });
  const contentType = response.headers['content-type'] || 'image/jpeg';
  const base64 = Buffer.from(response.data).toString('base64');
  return { contentType, base64 };
}

async function submitGeneration({ baseURL, apiKey, payload, timeoutMs, signal }) {
  const url = `${baseURL}/images/generations`;
  const { data } = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-ModelScope-Async-Mode': 'true',
    },
    ...getAxiosConfig(signal, timeoutMs),
  });
  return data;
}

async function pollForResult({ baseURL, apiKey, taskId, pollIntervalMs, maxPollAttempts, timeoutMs, signal }) {
  const taskUrl = `${baseURL}/tasks/${taskId}`;
  for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
    const { data } = await axios.get(taskUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-ModelScope-Task-Type': 'image_generation',
      },
      ...getAxiosConfig(signal, timeoutMs),
    });

    if (data?.task_status === 'SUCCEED') {
      return data;
    }
    if (data?.task_status === 'FAILED') {
      throw new Error(data.err_msg || data.error_msg || 'Image generation failed.');
    }
    await wait(pollIntervalMs);
  }
  throw new Error('Timed out waiting for ModelScope image generation to finish.');
}

function sanitizePayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null),
  );
}

function createModelScopeQwenImageTools(fields = {}) {
  const override = fields.override ?? false;
  if (!override && !fields.isAgent) {
    throw new Error('This tool is only available for agents.');
  }

  const apiKey = fields.MODELSCOPE_API_KEY || process.env.MODELSCOPE_API_KEY || '';
  if (!apiKey && !override) {
    throw new Error('Missing MODELSCOPE_API_KEY environment variable.');
  }

  const model =
    fields.MODELSCOPE_QWEN_IMAGE_MODEL || process.env.MODELSCOPE_QWEN_IMAGE_MODEL || 'Qwen/Qwen-Image';

  const baseURL =
    (fields.MODELSCOPE_BASE_URL || process.env.MODELSCOPE_BASE_URL || 'https://api-inference.modelscope.cn')
      .replace(/\/$/, '')
      + '/v1';

  const timeoutMs = Number(process.env.MODELSCOPE_TIMEOUT_MS || fields.timeoutMs) || 30000;
  const pollIntervalMs = Number(process.env.MODELSCOPE_POLL_INTERVAL_MS || fields.pollIntervalMs) || 5000;
  const maxPollAttempts =
    Number(process.env.MODELSCOPE_MAX_POLL_ATTEMPTS || fields.maxPollAttempts) || 60;

  const imageGenTool = tool(
    async ({ prompt, parameters = {}, model: overrideModel }, runnableConfig) => {
      if (!prompt || !prompt.trim()) {
        throw new Error('Missing required field: prompt');
      }

      const signal = runnableConfig?.signal;
      const payload = sanitizePayload({
        model: overrideModel || model,
        prompt: prompt.trim(),
        ...parameters,
      });

      let generationResponse;
      try {
        generationResponse = await submitGeneration({
          baseURL,
          apiKey,
          payload,
          timeoutMs,
          signal,
        });
      } catch (error) {
        logger.error('[ModelScopeQwenImage] Error submitting image task:', error?.response?.data ?? error.message);
        throw new Error(
          `Something went wrong when trying to start the image generation. Details: ${
            JSON.stringify(error?.response?.data ?? error.message) || 'Unknown error'
          }`,
        );
      }

      const taskId = generationResponse?.task_id;
      if (!taskId) {
        throw new Error('ModelScope did not return a task_id for the generation request. Please try again.');
      }

      let taskResult;
      try {
        taskResult = await pollForResult({
          baseURL,
          apiKey,
          taskId,
          pollIntervalMs,
          maxPollAttempts,
          timeoutMs,
          signal,
        });
      } catch (error) {
        throw new Error(`Qwen-Image task failed: ${error.message}`);
      }

      const outputImages = Array.isArray(taskResult?.output_images) ? taskResult.output_images : [];
      if (!outputImages.length) {
        throw new Error('ModelScope did not return any image URLs.');
      }

      const imageUrl = resolveImageUrl(outputImages[0]);
      if (!imageUrl) {
        throw new Error('Unable to determine the generated image URL.');
      }

      let base64Image;
      let contentType;
      try {
        ({ base64: base64Image, contentType } = await fetchBase64(imageUrl, signal, timeoutMs));
      } catch (error) {
        throw new Error(`Failed to retrieve generated image bytes: ${error.message}`);
      }

      const file_ids = [v4()];
      const content = [
        {
          type: ContentTypes.IMAGE_URL,
          image_url: {
            url: `data:${contentType};base64,${base64Image}`,
          },
        },
      ];
      const response = [
        {
          type: ContentTypes.TEXT,
          text: `${displayMessage}\n\ngenerated_image_id: "${file_ids[0]}"`,
        },
      ];
      return [response, { content, file_ids }];
    },
    toolkit.modelscope_qwen_image,
  );

  return [imageGenTool];
}

module.exports = createModelScopeQwenImageTools;

