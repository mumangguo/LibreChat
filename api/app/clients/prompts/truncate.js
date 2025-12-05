const MAX_CHAR = 255;

/**
 * 将给定文本截断至指定最大长度，附加省略号和通知
 * 如果原文超过最大长度。
 *
 * @param {string} text - The text to be truncated.
 * @param {number} [maxLength=MAX_CHAR] - The maximum length of the text after truncation. Defaults to MAX_CHAR.
 * @returns {string} The truncated text if the original text length exceeds maxLength, otherwise returns the original text.
 */
function truncateText(text, maxLength = MAX_CHAR) {
  if (text.length > maxLength) {
    return `${text.slice(0, maxLength)}... [text truncated for brevity]`;
  }
  return text;
}

/**
 * 通过显示文本的前半部分和后半部分，将给定文本截断至指定的最大长度，
 * 用省略号分隔。该方法确保输出不超过最大长度，包括加法
 * 省略号，若原文超过最大长度则通知。
 *
 * @param {string} text - 被截断的文本
 * @param {number} [maxLength=MAX_CHAR] - 截断后输出文本的最大长度。默认是MAX_CHAR。
 * @returns {string} 截断文本显示前半部分和后半部分，或如果不超过最大长度则显示原始文本。
 */
function smartTruncateText(text, maxLength = MAX_CHAR) {
  const ellipsis = '...';
  const notification = ' [text truncated for brevity]';
  const halfMaxLength = Math.floor((maxLength - ellipsis.length - notification.length) / 2);

  if (text.length > maxLength) {
    const startLastHalf = text.length - halfMaxLength;
    return `${text.slice(0, halfMaxLength)}${ellipsis}${text.slice(startLastHalf)}${notification}`;
  }

  return text;
}

/**
 * 截断工具调用输出
 * @param {TMessage[]} _messages
 * @param {number} maxContextTokens
 * @param {function({role: string, content: TMessageContent[]}): number} getTokenCountForMessage
 *
 * @returns {{
 *  dbMessages: TMessage[],
 * editedIndices: number[]
 * }}
 */
function truncateToolCallOutputs(_messages, maxContextTokens, getTokenCountForMessage) {
  const THRESHOLD_PERCENTAGE = 0.5;
  const targetTokenLimit = maxContextTokens * THRESHOLD_PERCENTAGE;

  let currentTokenCount = 3;
  const messages = [..._messages];
  const processedMessages = [];
  let currentIndex = messages.length;
  const editedIndices = new Set();
  while (messages.length > 0) {
    currentIndex--;
    const message = messages.pop();
    currentTokenCount += message.tokenCount;
    if (currentTokenCount < targetTokenLimit) {
      processedMessages.push(message);
      continue;
    }

    if (!message.content || !Array.isArray(message.content)) {
      processedMessages.push(message);
      continue;
    }

    const toolCallIndices = message.content
      .map((item, index) => (item.type === 'tool_call' ? index : -1))
      .filter((index) => index !== -1)
      .reverse();

    if (toolCallIndices.length === 0) {
      processedMessages.push(message);
      continue;
    }

    const newContent = [...message.content];

    // Truncate all tool outputs since we're over threshold
    for (const index of toolCallIndices) {
      const toolCall = newContent[index].tool_call;
      if (!toolCall || !toolCall.output) {
        continue;
      }

      editedIndices.add(currentIndex);

      newContent[index] = {
        ...newContent[index],
        tool_call: {
          ...toolCall,
          output: '[OUTPUT_OMITTED_FOR_BREVITY]',
        },
      };
    }

    const truncatedMessage = {
      ...message,
      content: newContent,
      tokenCount: getTokenCountForMessage({ role: 'assistant', content: newContent }),
    };

    processedMessages.push(truncatedMessage);
  }

  return { dbMessages: processedMessages.reverse(), editedIndices: Array.from(editedIndices) };
}

module.exports = { truncateText, smartTruncateText, truncateToolCallOutputs };
