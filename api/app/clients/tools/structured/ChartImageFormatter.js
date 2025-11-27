const { z } = require('zod');
const axios = require('axios');
const { v4 } = require('uuid');
const { tool } = require('@langchain/core/tools');
const { ContentTypes } = require('librechat-data-provider');

const chartFormatterToolkit = {
  chart_image_formatter: {
    name: 'chart_image_formatter',
    description:
      '将 mcp-server-chart 等返回的原始文本（包含图像 URL）转换为可以在对话中直接展示的图像 artifact。优先传入 chart_url；若只有 raw_output，工具会自动提取第一个链接。',
    schema: z
      .object({
        chart_url: z.string().url().optional().describe('mcp-server-chart 返回的图片直链。'),
        raw_output: z
          .string()
          .optional()
          .describe('包含图像链接的原始输出文本，例如 mcp-server-chart 的响应。'),
        title: z.string().optional().describe('生成图像的名称或标题。'),
        description: z.string().optional().describe('对图像的简要描述，将展示为文本响应。'),
      })
      .refine((value) => !!value.chart_url || !!value.raw_output, {
        message: 'chart_url 与 raw_output 至少需要提供一个。',
      }),
    responseFormat: 'content_and_artifact',
  },
};

const urlRegex = /(https?:\/\/[^\s"'<>]+)/i;

function extractUrl(text) {
  if (!text) {
    return null;
  }
  const match = text.match(urlRegex);
  return match ? match[0] : null;
}

function createChartImageFormatterTools() {
  const chartFormatterTool = tool(
    async ({ chart_url, raw_output, title, description }, runnableConfig) => {
      const imageUrl = chart_url || extractUrl(raw_output);
      if (!imageUrl) {
        throw new Error('未能在 raw_output 中找到图片链接，也未显式提供 chart_url。');
      }

      let contentType = 'image/png';
      let base64Image;
      try {
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          signal: runnableConfig?.signal,
        });
        contentType = response.headers['content-type'] || contentType;
        base64Image = Buffer.from(response.data).toString('base64');
      } catch (error) {
        throw new Error(`下载图像失败：${error.message}`);
      }

      const cleanedText = (raw_output || '').replace(imageUrl, '').trim();
      const file_ids = [v4()];
      const textResponse = [
        {
          type: ContentTypes.TEXT,
          text: description || cleanedText || '图像已生成，可直接查看。',
        },
      ];
      const content = [
        {
          type: ContentTypes.IMAGE_URL,
          image_url: {
            url: `data:${contentType};base64,${base64Image}`,
            detail: 'high',
          },
        },
      ];

      return [
        textResponse,
        {
          content,
          file_ids,
          name: title ?? 'chart-image',
        },
      ];
    },
    chartFormatterToolkit.chart_image_formatter,
  );

  return [chartFormatterTool];
}

createChartImageFormatterTools.chartFormatterToolkit = chartFormatterToolkit;

module.exports = createChartImageFormatterTools;



