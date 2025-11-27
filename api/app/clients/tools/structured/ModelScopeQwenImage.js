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

const modelScopeToolkit = {
  modelscope_qwen_image: {
    name: 'modelscope_qwen_image',
    description:
      'Generate a single high-quality, photorealistic image using the Qwen-Image model hosted on ModelScope. IMPORTANT: This tool generates ONE image per call. To generate multiple images (e.g., for WeChat Moments 9-grid layout), you must call this tool multiple times, each time with a different prompt describing the desired scene. When generating multiple images for a grid layout, ALWAYS use the SAME size parameter (e.g., "1024x1024" for 1:1 square ratio) for ALL images to ensure consistent dimensions. For WeChat Moments 9-grid (3x3), generate exactly 9 images, all with size "1024x1024" (1:1 square ratio).',
    schema: z.object({
      prompt: z
        .string()
        .max(32000)
        .describe(
          'Describe the desired scene in rich visual detail (subjects, lighting, composition, style, mood, background). This should describe a SINGLE scene for ONE image. If you need multiple images (e.g., for a 9-grid layout), call this tool multiple times with different prompts. When generating images for a grid layout, ensure each prompt describes a distinct but related scene.',
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

async function pollForResult({
  baseURL,
  apiKey,
  taskId,
  pollIntervalMs,
  maxPollAttempts,
  timeoutMs,
  signal,
}) {
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
  throw new Error('等待ModelScope映像生成完成时超时。');
}

function sanitizePayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null),
  );
}

function createModelScopeQwenImageTools(fields = {}) {
  const override = fields.override ?? false;
  if (!override && !fields.isAgent) {
    throw new Error('此工具仅适用于智能体');
  }

  const apiKey = fields.MODELSCOPE_API_KEY || process.env.MODELSCOPE_API_KEY || '';
  if (!apiKey && !override) {
    throw new Error('缺少MODERSCOPE_API_KEY');
  }

  const model = 'Qwen/Qwen-Image';
  const baseURL = 'https://api-inference.modelscope.cn/v1';
  const timeoutMs = 30000;
  const pollIntervalMs = 5000;
  const maxPollAttempts = 60;

  const imageGenTool = tool(
    async ({ prompt, parameters = {}, model: overrideModel }, runnableConfig) => {
      logger.info('===六、获取工具结果(ModelScopeQwenImageTools执行)===');
      if (!prompt || !prompt.trim()) {
        throw new Error('缺少prompt字段');
      }

      const signal = runnableConfig?.signal;
      const payload = sanitizePayload({
        model: overrideModel || model,
        prompt: prompt.trim(),
        ...parameters,
      });

      let generationResponse;
      try {
        logger.info('1. 提交生成任务');
        generationResponse = await submitGeneration({
          baseURL,
          apiKey,
          payload,
          timeoutMs,
          signal,
        });
      } catch (error) {
        logger.error(
          '[ModelScopeQwenImage]提交图像任务时出错：',
          error?.response?.data ?? error.message,
        );
        throw new Error(
          `尝试启动图像生成时出现了问题。细节： ${
            JSON.stringify(error?.response?.data ?? error.message) || 'Unknown error'
          }`,
        );
      }

      const taskId = generationResponse?.task_id;
      if (!taskId) {
        throw new Error('ModelScope没有为生成请求返回task_id。请重试。');
      }

      let taskResult;
      try {
        logger.info('2. 轮询任务状态');
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
        throw new Error('ModelScope未返回任何图像URL。');
      }

      logger.info('3. 获取图片 URL');
      const imageUrl = resolveImageUrl(outputImages[0]);
      if (!imageUrl) {
        throw new Error('无法确定生成的图像URL。');
      }

      let base64Image;
      let contentType;
      logger.info('4. 下载图片并转换为 base64');
      try {
        ({ base64: base64Image, contentType } = await fetchBase64(imageUrl, signal, timeoutMs));
      } catch (error) {
        throw new Error(`生成的图像字节失败： ${error.message}`);
      }

      logger.info('5. 返回 content_and_artifact 格式');
      const file_ids = [v4()];
      const content = [
        {
          type: ContentTypes.IMAGE_URL,
          image_url: {
            url: `data:${contentType};base64,${base64Image}`,
          },
        },
      ];
      const textResponse = [
        {
          type: ContentTypes.TEXT,
          text: displayMessage + `\n\ngenerated_image_id: "${file_ids[0]}"`,
        },
      ];
      return [textResponse, { content, file_ids }];
    },
    modelScopeToolkit.modelscope_qwen_image,
  );

  return [imageGenTool];
}

// 导出工具包以在loadAndFormatTools中使用
createModelScopeQwenImageTools.modelScopeToolkit = modelScopeToolkit;
module.exports = createModelScopeQwenImageTools;
