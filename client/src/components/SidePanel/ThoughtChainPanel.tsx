import { useEffect, memo, useMemo, useState } from 'react';
import { ConfigProvider, Typography } from 'antd';
import type { ThoughtChainItemType } from '@ant-design/x';
import { ThoughtChain, CodeHighlighter } from '@ant-design/x';
import {
  CheckCircleOutlined,
  LoadingOutlined,
  CloseCircleOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { actionDelimiter, actionDomainSeparator, Constants } from 'librechat-data-provider';
import { useChatContext } from '~/Providers';
import type { MessageToolCalls, ThoughtChainData } from '~/utils/parseDatServerResponse';
import { mapAttachments } from '~/utils';
import { useLocalize } from '~/hooks';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';

const { Text } = Typography;

// 扩展 ThoughtChainItemType 以支持 children
type ExtendedThoughtChainItemType = ThoughtChainItemType & {
  children?: React.ReactNode;
};

interface ThoughtChainPanelProps {
  toolCallsByMessage: MessageToolCalls[];
  shouldRender: boolean;
  onRenderChange: (shouldRender: boolean) => void;
}

/**
 * Dat-Server 思维链内容组件 - 显示推理过程
 */
function DatServerThoughtChainContent({ data }: { data: ThoughtChainData }) {
  const items = useMemo(() => {
    const result: ExtendedThoughtChainItemType[] = [];

    // 1. 意图分类
    if (data.intentClassification) {
      const intent = data.intentClassification;
      result.push({
        key: 'intent',
        title: '意图分类',
        description: intent.intent || '',
        status: 'success',
        collapsible: true,
        content: (
          <div className="space-y-2 text-sm">
            {intent.rephrased_question && (
              <div>
                <span className="font-medium">重述问题:</span> {intent.rephrased_question}
              </div>
            )}
            {intent.reasoning && (
              <div>
                <span className="font-medium">推理:</span> {intent.reasoning}
              </div>
            )}
          </div>
        ),
      });
    }

    // 2. SQL 生成推理
    if (data.sqlGenerationReasoning) {
      result.push({
        key: 'reasoning',
        title: 'SQL 生成推理',
        status: 'success',
        collapsible: true,
        content: (
          <div className="markdown prose prose-sm dark:prose-invert max-w-none">
            <MarkdownLite content={data.sqlGenerationReasoning} />
          </div>
        ),
      });
    }

    // 3. SQL 生成
    if (data.sqlGenerate) {
      result.push({
        key: 'generate',
        title: 'SQL 生成',
        status: 'success',
        collapsible: true,
        content: <CodeHighlighter lang="sql">{data.sqlGenerate}</CodeHighlighter>,
      });
    }

    // 4. 语义 SQL 转换
    if (data.semanticToSql) {
      const isError =
        typeof data.semanticToSql === 'string' &&
        data.semanticToSql.toLowerCase().includes('error');
      result.push({
        key: 'semantic',
        title: '语义 SQL 转换',
        status: isError ? 'error' : 'success',
        collapsible: true,
        content: isError ? (
          <div className="text-sm text-red-500">{data.semanticToSql}</div>
        ) : (
          <CodeHighlighter lang="sql">{data.semanticToSql}</CodeHighlighter>
        ),
      });
    }

    // 5. SQL 执行结果
    if (data.sqlExecute) {
      result.push({
        key: 'execute',
        title: 'SQL 执行结果',
        status: 'success',
        collapsible: true,
        content: <SqlExecuteResult content={data.sqlExecute} />,
      });
    }

    // 6. 异常信息
    if (data.exception) {
      result.push({
        key: 'exception',
        title: '异常信息',
        description: data.exception.message || '',
        status: 'error',
      });
    }

    return result;
  }, [data]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 border-t border-border-light pt-2">
      <div className="mb-2 text-xs font-medium text-text-secondary">推理过程</div>
      <ThoughtChain items={items} defaultExpandedKeys={[]} />
    </div>
  );
}

/**
 * SQL 执行结果组件
 */
function SqlExecuteResult({ content }: { content: string }) {
  const parsed = useMemo(() => {
    try {
      let toParse = content.trim();
      if (toParse.startsWith('"') && toParse.endsWith('"')) {
        toParse = JSON.parse(toParse);
      }
      if (typeof toParse === 'string') {
        return JSON.parse(toParse);
      }
      return toParse;
    } catch {
      return null;
    }
  }, [content]);

  if (Array.isArray(parsed) && parsed.length > 0) {
    const keys = Object.keys(parsed[0]);
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-border-light text-sm">
          <thead>
            <tr className="bg-surface-secondary">
              {keys.map((key) => (
                <th
                  key={key}
                  className="border border-border-light px-2 py-1 text-left font-medium"
                >
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.slice(0, 20).map((row: any, idx: number) => (
              <tr key={idx} className="hover:bg-surface-tertiary">
                {keys.map((key) => (
                  <td key={key} className="border border-border-light px-2 py-1">
                    {typeof row[key] === 'number'
                      ? row[key].toLocaleString('zh-CN', { maximumFractionDigits: 2 })
                      : String(row[key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {parsed.length > 20 && (
          <div className="mt-1 text-xs text-text-secondary">
            显示前 20 条，共 {parsed.length} 条记录
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-h-40 overflow-auto rounded bg-surface-tertiary p-2 text-sm">
      <pre className="whitespace-pre-wrap break-words">{content}</pre>
    </div>
  );
}

/**
 * 代码块组件 - 用于展示工具调用的参数和输出
 * 修复溢出问题，确保内容在容器内正确显示
 */
function OptimizedCodeBlock({ text, maxHeight = 200 }: { text: string; maxHeight?: number }) {
  const formatText = (str: string) => {
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  };

  return (
    <div
      className="mt-1 w-full overflow-hidden rounded-md bg-surface-tertiary"
      style={{ maxWidth: '100%' }}
    >
      <div
        className="overflow-auto p-2 text-xs text-text-primary"
        style={{ maxHeight, maxWidth: '100%' }}
      >
        <pre
          className="m-0 whitespace-pre-wrap"
          style={{
            wordBreak: 'break-all',
            overflowWrap: 'break-word',
            maxWidth: '100%',
          }}
        >
          <code>{formatText(text)}</code>
        </pre>
      </div>
    </div>
  );
}

/**
 * 工具调用详情内容组件 - 用于在可折叠区域内展示
 */
function ToolCallDetailContent({
  args,
  output,
  domain,
  function_name,
  thoughtChain,
  localize,
}: {
  args: string;
  output?: string | null;
  domain: string | null;
  function_name: string;
  thoughtChain: ThoughtChainData | null;
  localize: (key: string, params?: Record<string, string>) => string;
}) {
  const hasOutput = output != null && output.length > 0;

  return (
    <div className="w-full space-y-3 overflow-hidden" style={{ maxWidth: '100%' }}>
      {/* 参数 */}
      {args && (
        <div className="w-full overflow-hidden" style={{ maxWidth: '100%' }}>
          <Text type="secondary" className="mb-1 block text-xs">
            {domain
              ? localize('com_assistants_domain_info', { 0: domain })
              : localize('com_assistants_function_use', { 0: function_name })}
          </Text>
          <OptimizedCodeBlock text={args} />
        </div>
      )}

      {/* 输出结果 */}
      {hasOutput && (
        <div className="w-full overflow-hidden" style={{ maxWidth: '100%' }}>
          <Text type="secondary" className="mb-1 block text-xs">
            {localize('com_ui_result')}
          </Text>
          <OptimizedCodeBlock text={output!} />
        </div>
      )}

      {/* dat-server 思维链内容 */}
      {thoughtChain && <DatServerThoughtChainContent data={thoughtChain} />}
    </div>
  );
}

/**
 * 单个工具调用项 - 使用 ant-design-x ThoughtChain 组件
 * 支持折叠功能，保持实时数据更新能力
 */
function SidePanelToolCallItem({
  toolCall,
  thoughtChain,
  isSubmitting,
  itemKey,
}: {
  toolCall: {
    name: string;
    args: string | Record<string, unknown>;
    output?: string | null;
    progress?: number;
    id?: string;
    auth?: string;
    expires_at?: number;
  };
  thoughtChain: ThoughtChainData | null;
  attachments?: any[];
  isSubmitting: boolean;
  itemKey: string;
}) {
  const localize = useLocalize();

  // 解析工具名称和域名 - 与原生 ToolCall 逻辑一致
  const { function_name, domain, isMCPToolCall } = useMemo(() => {
    const name = toolCall.name;
    if (typeof name !== 'string') {
      return { function_name: '', domain: null, isMCPToolCall: false };
    }
    if (name.includes(Constants.mcp_delimiter)) {
      const [func, server] = name.split(Constants.mcp_delimiter);
      return {
        function_name: func || '',
        domain: server && (server.replaceAll(actionDomainSeparator, '.') || null),
        isMCPToolCall: true,
      };
    }
    const [func, _domain] = name.includes(actionDelimiter)
      ? name.split(actionDelimiter)
      : [name, ''];
    return {
      function_name: func || '',
      domain: _domain && (_domain.replaceAll(actionDomainSeparator, '.') || null),
      isMCPToolCall: false,
    };
  }, [toolCall.name]);

  // 格式化参数
  const args = useMemo(() => {
    if (typeof toolCall.args === 'string') {
      return toolCall.args;
    }
    try {
      return JSON.stringify(toolCall.args, null, 2);
    } catch {
      return '';
    }
  }, [toolCall.args]);

  // 状态计算
  const hasOutput = toolCall.output != null && toolCall.output.length > 0;
  const error =
    typeof toolCall.output === 'string' &&
    toolCall.output.toLowerCase().includes('error processing tool');
  const isLoading = !hasOutput && isSubmitting;
  const cancelled = !isSubmitting && !hasOutput && !error;

  // 获取状态 - ThoughtChain 支持 'success' | 'error' | 'pending'
  const getStatus = (): 'success' | 'error' | 'pending' => {
    if (error) return 'error';
    if (cancelled) return 'error';
    if (hasOutput) return 'success';
    return 'pending';
  };

  // 获取图标
  const getIcon = () => {
    if (isLoading) return <LoadingOutlined spin />;
    if (error || cancelled) return <CloseCircleOutlined />;
    if (hasOutput) return <CheckCircleOutlined />;
    return <CodeOutlined />;
  };

  // 获取标题文本
  const getTitle = () => {
    if (isLoading) {
      return function_name
        ? localize('com_assistants_running_var', { 0: function_name })
        : localize('com_assistants_running_action');
    }
    if (cancelled) {
      return localize('com_ui_cancelled');
    }
    if (isMCPToolCall) {
      return localize('com_assistants_completed_function', { 0: function_name });
    }
    if (domain && domain.length !== Constants.ENCODED_DOMAIN_LENGTH) {
      return localize('com_assistants_completed_action', { 0: domain });
    }
    return localize('com_assistants_completed_function', { 0: function_name });
  };

  // 是否有详情内容
  const hasDetails = args || hasOutput || thoughtChain;

  // 构建 ThoughtChain 项目 - 显式指定类型避免类型错误
  const status = getStatus();
  const toolCallItems: ExtendedThoughtChainItemType[] = [
    {
      key: itemKey,
      title: getTitle(),
      description: domain || function_name,
      icon: getIcon(),
      status: status as 'success' | 'error' | 'pending',
      collapsible: hasDetails,
      content: hasDetails ? (
        <ToolCallDetailContent
          args={args}
          output={toolCall.output}
          domain={domain}
          function_name={function_name}
          thoughtChain={thoughtChain}
          localize={localize}
        />
      ) : undefined,
    },
  ];

  return (
    <div className="w-full overflow-hidden" style={{ maxWidth: '100%' }}>
      <ThoughtChain items={toolCallItems} size="small" />
    </div>
  );
}

/**
 * ThoughtChainPanel 组件 - 使用 ant-design-x ThoughtChain 组件展示思维链
 * 直接引用原生 ToolCall 组件实现实时展示
 */
const ThoughtChainPanel = memo(function ThoughtChainPanel({
  toolCallsByMessage,
  shouldRender,
  onRenderChange,
}: ThoughtChainPanelProps) {
  const { getMessages, isSubmitting } = useChatContext();
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  // 获取所有消息的附件
  const attachmentsMap = useMemo(() => {
    const messages = getMessages();
    if (!messages || messages.length === 0) {
      return {};
    }

    const allAttachments: any[] = [];
    messages.forEach((message: any) => {
      if (message.attachments && Array.isArray(message.attachments)) {
        allAttachments.push(...message.attachments);
      }
    });

    return mapAttachments(allAttachments);
  }, [getMessages]);

  // 通知父组件是否有数据需要渲染
  useEffect(() => {
    if (toolCallsByMessage.length > 0) {
      onRenderChange(true);
    }
  }, [toolCallsByMessage, onRenderChange]);

  // 自动展开最新的轮次
  useEffect(() => {
    if (toolCallsByMessage.length > 0) {
      const latestKey = `round-${toolCallsByMessage.length - 1}`;
      setExpandedKeys((prev) => {
        if (!prev.includes(latestKey)) {
          return [...prev, latestKey];
        }
        return prev;
      });
    }
  }, [toolCallsByMessage.length]);

  if (!shouldRender) {
    return null;
  }

  if (toolCallsByMessage.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-text-secondary">
          <p className="text-sm">暂无思维链数据</p>
        </div>
      </div>
    );
  }

  // 构建 ThoughtChain 项目 - 按对话轮次分组
  const chainItems: ExtendedThoughtChainItemType[] = toolCallsByMessage.map(
    (messageData, roundIdx) => {
      const roundKey = `round-${roundIdx}`;
      const toolCount = messageData.toolCalls.length;
      const isStreaming = messageData.isStreaming;

      const hasAnyLoading = messageData.toolCalls.some(
        (tc) => tc.toolCall.output == null || tc.toolCall.output.length === 0,
      );

      return {
        key: roundKey,
        title: `第 ${messageData.messageIndex} 轮对话`,
        description: `${toolCount} 个工具调用`,
        status: isStreaming || hasAnyLoading ? 'loading' : 'success',
        collapsible: true,
        content: (
          <div className="w-full space-y-2 overflow-hidden" style={{ maxWidth: '100%' }}>
            {messageData.toolCalls.map((tc, tcIdx) => {
              const tcKey = `${roundKey}-tc-${tcIdx}`;
              const tcAttachments = tc.toolCall.id ? attachmentsMap[tc.toolCall.id] : undefined;

              return (
                <SidePanelToolCallItem
                  key={tcKey}
                  itemKey={tcKey}
                  toolCall={tc.toolCall}
                  thoughtChain={tc.thoughtChain}
                  attachments={tcAttachments}
                  isSubmitting={isSubmitting}
                />
              );
            })}
          </div>
        ),
      };
    },
  );

  return (
    <ConfigProvider
      theme={{
        token: {
          colorBgContainer: 'var(--bg-surface-secondary)',
          colorText: 'var(--text-primary)',
          colorBorder: 'var(--border-light)',
          colorTextDescription: 'var(--text-secondary)',
        },
      }}
    >
      <div className="flex h-full flex-col overflow-hidden">
        {/* 标题 */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border-light bg-background px-4 py-3">
          <div className="text-base font-semibold text-text-primary">思维链</div>
          <div className="text-xs text-text-secondary">共 {toolCallsByMessage.length} 轮</div>
        </div>

        {/* 思维链内容 */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
          <ThoughtChain items={chainItems} expandedKeys={expandedKeys} onExpand={setExpandedKeys} />
        </div>
      </div>
    </ConfigProvider>
  );
});

ThoughtChainPanel.displayName = 'ThoughtChainPanel';

export default ThoughtChainPanel;
