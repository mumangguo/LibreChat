import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@librechat/client';
import type { ThoughtChainItemType } from '@ant-design/x';
import { ThoughtChain, CodeHighlighter } from '@ant-design/x';
import { ConfigProvider } from 'antd';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';
import type { ThoughtChainData } from '~/utils/parseDatServerResponse';

// 扩展 ThoughtChainItemType 以支持 children
type ExtendedThoughtChainItemType = ThoughtChainItemType & {
  children?: React.ReactNode;
};

interface DatServerThoughtChainProps {
  data: ThoughtChainData;
  currentIndex?: number;
  totalCount?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
  onNext?: () => void;
  onPrevious?: () => void;
}

/**
 * 格式化 SQL 执行结果为表格或结构化显示
 */
function formatSqlExecuteResult(sqlExecute: string): JSX.Element {
  if (!sqlExecute || typeof sqlExecute !== 'string') {
    return (
      <div className="whitespace-pre-wrap break-words text-sm text-text-primary">
        {String(sqlExecute)}
      </div>
    );
  }

  let contentToParse = sqlExecute.trim();
  let parsed: any = null;

  // 步骤1: 如果内容被双引号包裹，先解析外层引号（这会自动处理转义字符）
  if (contentToParse.startsWith('"') && contentToParse.endsWith('"')) {
    try {
      // JSON.parse 会自动处理转义字符
      const unquoted = JSON.parse(contentToParse);
      if (typeof unquoted === 'string') {
        contentToParse = unquoted.trim();
      } else {
        // 如果解析后直接是对象，直接使用
        parsed = unquoted;
      }
    } catch (e) {
      // 如果 JSON.parse 失败，尝试手动处理转义字符
      try {
        // 去掉首尾引号
        let unescaped = contentToParse.slice(1, -1);
        // 手动处理转义字符（注意顺序：先处理 \\，再处理其他）
        unescaped = unescaped
          .replace(/\\\\/g, '\u0000') // 临时替换双反斜杠
          .replace(/\\"/g, '"') // 处理转义的引号
          .replace(/\\n/g, '\n') // 处理转义的换行
          .replace(/\\r/g, '\r') // 处理转义的回车
          .replace(/\\t/g, '\t') // 处理转义的制表符
          .replace(/\u0000/g, '\\'); // 恢复双反斜杠为单反斜杠
        // 尝试解析处理后的内容
        contentToParse = unescaped;
      } catch (e2) {
        // 手动处理也失败，保持原样
      }
    }
  }

  // 步骤2: 尝试解析为 JSON
  if (parsed === null) {
    // 如果已经是对象或数组，直接使用
    if (typeof contentToParse === 'object' && contentToParse !== null) {
      parsed = contentToParse;
    } else if (typeof contentToParse === 'string') {
      // 如果是字符串，先尝试直接解析
      try {
        parsed = JSON.parse(contentToParse);
      } catch (e) {
        // 如果直接解析失败，检查是否包含转义的引号
        if (contentToParse.includes('\\"')) {
          try {
            // 方法1: 只处理转义的引号，不处理其他转义字符（避免引入换行符等问题）
            let unescaped = contentToParse.replace(/\\"/g, '"');

            // 移除末尾可能存在的多余引号
            if (unescaped.endsWith('"') && !unescaped.startsWith('"')) {
              unescaped = unescaped.slice(0, -1);
            }

            // 移除所有实际的换行符和回车符（这些不应该在 JSON 字符串中）
            unescaped = unescaped.replace(/[\r\n]/g, '').trim();

            // 尝试解析
            parsed = JSON.parse(unescaped);
          } catch (e2) {
            // 方法2: 如果方法1失败，尝试更完整的转义处理
            try {
              // 先处理双反斜杠，再处理其他转义字符
              let unescaped = contentToParse
                .replace(/\\\\/g, '\u0000') // 临时替换双反斜杠
                .replace(/\\"/g, '"') // 处理转义的引号
                .replace(/\u0000/g, '\\'); // 恢复双反斜杠

              // 移除末尾可能存在的多余引号
              if (unescaped.endsWith('"') && !unescaped.startsWith('"')) {
                unescaped = unescaped.slice(0, -1);
              }

              // 移除所有换行符和回车符
              unescaped = unescaped.replace(/[\r\n]/g, '').trim();

              parsed = JSON.parse(unescaped);
            } catch (e3) {
              // 所有解析都失败，返回原始内容
              return (
                <div className="whitespace-pre-wrap break-words text-sm text-text-primary">
                  {sqlExecute}
                </div>
              );
            }
          }
        } else {
          // 不包含转义字符，但解析失败，返回原始内容
          return (
            <div className="whitespace-pre-wrap break-words text-sm text-text-primary">
              {sqlExecute}
            </div>
          );
        }
      }
    } else {
      parsed = contentToParse;
    }
  }

  // 步骤3: 根据解析结果渲染
  try {
    if (Array.isArray(parsed) && parsed.length > 0) {
      // 如果是数组，显示为表格
      const keys = Object.keys(parsed[0]);
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-border-light">
            <thead>
              <tr className="bg-surface-secondary">
                {keys.map((key) => (
                  <th
                    key={key}
                    className="border border-border-light px-3 py-2 text-left text-sm font-semibold text-text-primary"
                  >
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.map((row: any, index: number) => (
                <tr key={index} className="hover:bg-surface-secondary/50">
                  {keys.map((key) => (
                    <td
                      key={key}
                      className="border border-border-light px-3 py-2 text-sm text-text-primary"
                    >
                      {typeof row[key] === 'number'
                        ? row[key].toLocaleString('zh-CN', {
                            maximumFractionDigits: 2,
                          })
                        : String(row[key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } else if (typeof parsed === 'object' && parsed !== null) {
      // 如果是对象，显示为键值对
      return (
        <div className="space-y-2">
          {Object.entries(parsed).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <span className="font-semibold text-text-primary">{key}:</span>
              <span className="text-text-primary">
                {typeof value === 'number'
                  ? value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
                  : String(value ?? '')}
              </span>
            </div>
          ))}
        </div>
      );
    }
  } catch (e) {
    // 渲染失败，返回原始内容
    console.warn('Failed to render SQL execute result:', e);
  }

  // 如果解析失败或无法渲染，显示原始内容
  return (
    <div className="whitespace-pre-wrap break-words text-sm text-text-primary">
      {sqlExecute}
    </div>
  );
}

/**
 * 将 ThoughtChainData 转换为 ThoughtChain 组件需要的格式
 */
function convertToThoughtChainItems(data: ThoughtChainData): ExtendedThoughtChainItemType[] {
  const items: ExtendedThoughtChainItemType[] = [];

  // Intent Classification
  if (data.intentClassification) {
    const intent = data.intentClassification;
    const description = [
      intent.rephrased_question && `重述问题: ${intent.rephrased_question}`,
      intent.reasoning && `推理: ${intent.reasoning}`,
      intent.intent && `意图: ${intent.intent}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    items.push({
      title: '意图分类 (Intent Classification)',
      description,
      status: 'success',
    });
  }

  // SQL Generation Reasoning - 使用 Markdown 渲染
  if (data.sqlGenerationReasoning) {
    items.push({
      title: 'SQL 生成推理 (SQL Generation Reasoning)',
      status: 'success',
      children: (
        <div className="markdown prose prose-sm dark:prose-invert max-w-none text-text-primary">
          <MarkdownLite content={data.sqlGenerationReasoning} />
        </div>
      ),
    });
  }

  // SQL Generate - 使用代码高亮
  if (data.sqlGenerate) {
    items.push({
      title: 'SQL 生成 (SQL Generate)',
      status: 'success',
      children: (
        <CodeHighlighter lang="sql">{data.sqlGenerate}</CodeHighlighter>
      ),
    });
  }

  // Semantic to SQL - 使用代码高亮
  if (data.semanticToSql) {
    const semantic = data.semanticToSql;
    // semanticToSql 现在是字符串类型
    const isError = typeof semantic === 'string' && semantic.toLowerCase().includes('error');
    const sqlContent = typeof semantic === 'string' ? semantic : JSON.stringify(semantic, null, 2);
    items.push({
      title: '语义 SQL 转换 (Semantic to SQL)',
      status: isError ? 'error' : 'success',
      children: isError ? (
        <div className="text-sm text-text-primary">{sqlContent}</div>
      ) : (
        <CodeHighlighter lang="sql">{sqlContent}</CodeHighlighter>
      ),
    });
  }

  // SQL Execute - 格式化显示为表格
  if (data.sqlExecute) {
    items.push({
      title: 'SQL 执行 (SQL Execute)',
      status: 'success',
      children: (
        <div className="mt-2">
          {formatSqlExecuteResult(data.sqlExecute)}
        </div>
      ),
    });
  }

  // Exception
  if (data.exception) {
    const exception = data.exception;
    items.push({
      title: '异常信息 (Exception)',
      description: exception.message
        ? `错误消息: ${exception.message}`
        : JSON.stringify(exception, null, 2),
      status: 'error',
    });
  }

  return items;
}

export default function DatServerThoughtChain({
  data,
  currentIndex = 0,
  totalCount = 1,
  hasNext = false,
  hasPrevious = false,
  onNext,
  onPrevious,
}: DatServerThoughtChainProps) {
  const items = useMemo(() => convertToThoughtChainItems(data), [data]);

  if (items.length === 0) {
    return null;
  }

  const showPagination = totalCount > 1;

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
        <div className="flex items-center justify-between border-b border-border-light p-4">
          <div className="text-lg font-semibold text-text-primary">思维链分析</div>
          {showPagination && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onPrevious}
                disabled={!hasPrevious}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-text-secondary">
                {currentIndex + 1} / {totalCount}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onNext}
                disabled={!hasNext}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {items.map((item, index) => (
            <div key={index} className="mb-6 last:mb-0">
              <div className="mb-2">
                <ThoughtChain
                  items={[
                    {
                      title: item.title,
                      description: item.description,
                      status: item.status,
                    },
                  ]}
                />
              </div>
              {item.children && (
                <div className="ml-4 mt-3">{item.children}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </ConfigProvider>
  );
}
