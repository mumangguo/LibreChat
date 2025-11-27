const { z } = require('zod');
const { Tool } = require('@langchain/core/tools');
const { getEnvironmentVariable } = require('@langchain/core/utils/env');

/**
 * Baidu Search API Tool using SearchAPI.io
 *
 * This tool uses SearchAPI.io to access Baidu search results.
 * Documentation: https://www.searchapi.io/docs/baidu
 */
class BaiduSearchResults extends Tool {
  static lc_name() {
    return 'baidu_search';
  }

  constructor(fields = {}) {
    super(fields);
    this.name = 'baidu_search';
    this.envVarApiKey = 'SEARCHAPI_API_KEY';
    this.override = fields.override ?? false;
    this.apiKey = fields[this.envVarApiKey] ?? getEnvironmentVariable(this.envVarApiKey);

    if (!this.override && !this.apiKey) {
      throw new Error(
        `Missing ${this.envVarApiKey} environment variable. Get your API key from https://www.searchapi.io/`,
      );
    }

    this.kwargs = fields?.kwargs ?? {};
    this.name = 'baidu_search';
    this.description =
      'A search engine optimized for Chinese content using Baidu. Useful for searching information in Chinese, including current events, news, and general web content. Baidu is the leading search engine in China.';

    this.schema = z.object({
      query: z
        .string()
        .min(1)
        .describe(
          'The search query string. Can include operators like "machine learning models", site:, intitle:, or filetype:.',
        ),
      num: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe('The number of results to return per page. Maximum is 50. Defaults to 10.'),
      page: z
        .number()
        .min(1)
        .optional()
        .describe('The page number of results to return. Defaults to 1.'),
      ct: z
        .enum(['0', '1', '2'])
        .optional()
        .describe(
          'Language control: 0 = Simplified and Traditional Chinese (default), 1 = Simplified Chinese, 2 = Traditional Chinese.',
        ),
      gpc: z
        .string()
        .optional()
        .describe('Time filter using Unix timestamps. Format: stf=START_TIME,END_TIME|stftype=1'),
    });
  }

  async _call(input) {
    const validationResult = this.schema.safeParse(input);
    if (!validationResult.success) {
      throw new Error(`Validation failed: ${JSON.stringify(validationResult.error.issues)}`);
    }

    const { query, num = 10, page = 1, ct, gpc } = validationResult.data;

    // Build the API URL
    const baseUrl = 'https://www.searchapi.io/api/v1/search';
    const params = new URLSearchParams({
      engine: 'baidu',
      q: query,
      api_key: this.apiKey,
    });

    // Add optional parameters
    if (num) {
      params.append('num', num.toString());
    }
    if (page) {
      params.append('page', page.toString());
    }
    if (ct) {
      params.append('ct', ct);
    }
    if (gpc) {
      params.append('gpc', gpc);
    }

    const url = `${baseUrl}?${params.toString()}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const json = await response.json();

      if (!response.ok) {
        const errorMessage =
          json.error?.message || json.message || `Request failed with status ${response.status}`;
        throw new Error(`Baidu Search API error: ${errorMessage}`);
      }

      // Format the response for better readability
      const formattedResult = this.formatSearchResults(json);

      return formattedResult;
    } catch (error) {
      if (error.message.includes('Baidu Search API error')) {
        throw error;
      }
      throw new Error(`Failed to fetch Baidu search results: ${error.message}`);
    }
  }

  /**
   * Format search results for better readability
   * @param {Object} json - The raw API response
   * @returns {string} Formatted search results
   */
  formatSearchResults(json) {
    const results = [];

    // Add organic results
    if (json.organic_results && json.organic_results.length > 0) {
      results.push('## 搜索结果 (Search Results):\n');
      json.organic_results.forEach((result, index) => {
        results.push(`${index + 1}. **${result.title || 'No title'}**`);
        if (result.link) {
          results.push(`   URL: ${result.link}`);
        }
        if (result.snippet) {
          results.push(`   摘要: ${result.snippet}`);
        }
        if (result.source) {
          results.push(`   来源: ${result.source}`);
        }
        results.push('');
      });
    }

    // Add knowledge graph if available
    if (json.knowledge_graph) {
      results.push('## 知识图谱 (Knowledge Graph):\n');
      const kg = json.knowledge_graph;
      if (kg.title) {
        results.push(`**${kg.title}**`);
      }
      if (kg.description) {
        results.push(kg.description);
      }
      if (kg.source) {
        results.push(`来源: ${kg.source?.name || kg.source}`);
      }
      results.push('');
    }

    // Add inline shopping results if available
    if (json.inline_shopping && json.inline_shopping.length > 0) {
      results.push('## 购物结果 (Shopping Results):\n');
      json.inline_shopping.forEach((item, index) => {
        results.push(`${index + 1}. **${item.title || 'No title'}**`);
        if (item.price) {
          results.push(`   价格: ${item.price}`);
        }
        if (item.seller) {
          results.push(`   商家: ${item.seller}`);
        }
        if (item.link) {
          results.push(`   URL: ${item.link}`);
        }
        results.push('');
      });
    }

    // Add inline images if available
    if (json.inline_images && json.inline_images.images && json.inline_images.images.length > 0) {
      results.push(`## 相关图片 (Related Images): ${json.inline_images.total_images || 0} 张\n`);
      json.inline_images.images.slice(0, 5).forEach((image, index) => {
        if (image.title) {
          results.push(`${index + 1}. ${image.title}`);
        }
        if (image.original?.link) {
          results.push(`   图片: ${image.original.link}`);
        }
        results.push('');
      });
    }

    // Add related searches if available
    if (json.related_searches && json.related_searches.length > 0) {
      results.push('## 相关搜索 (Related Searches):\n');
      json.related_searches.slice(0, 5).forEach((search, index) => {
        results.push(`${index + 1}. ${search.query || search}`);
      });
      results.push('');
    }

    // If no formatted results, return raw JSON
    if (results.length === 0) {
      return JSON.stringify(json, null, 2);
    }

    return results.join('\n');
  }
}

module.exports = BaiduSearchResults;





