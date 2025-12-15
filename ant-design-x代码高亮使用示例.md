# CodeHighlighter代码高亮

https://x.ant.design/components/code-highlighter-cn

用于高亮代码格式。

| 使用import { CodeHighlighter } from "@ant-design/x";         |
| ------------------------------------------------------------ |
| 源码[components/code-highlighter](https://github.com/ant-design/x/blob/main/components/code-highlighter) |
| 文档[编辑此页](https://github.com/ant-design/x/edit/main/components/code-highlighter/index.zh-CN.md) |
| 版本自 2.1.0 起支持                                          |

## 何时使用

CodeHighlighter 组件用于需要展示带有语法高亮的代码片段的场景。

- 用于展示带语法高亮的代码片段，并提供复制功能及头部语言信息。
- 与 XMarkdown 结合使用，可在 Markdown 内容中渲染代码块，并增强高亮显示和交互功能。

## 代码演示

```tsx
import React from 'react';
import CodeHighlighter from '../index';

const App: React.FC = () => {
  const code = `import React from 'react';
import { Button } from 'antd';

const App = () => (
  <div>
    <Button type="primary">Primary Button</Button>
  </div>
);

export default App;`;

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>JavaScript Code</h3>
      <CodeHighlighter lang="javascript">{code}</CodeHighlighter>

      <h3 style={{ margin: '8px 0' }}>CSS Code</h3>
      <CodeHighlighter lang="css">
        {`.container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}`}
      </CodeHighlighter>

      <h3 style={{ margin: '8px 0' }}>HTML Code</h3>
      <CodeHighlighter lang="html">
        {`<!DOCTYPE html>
<html>
<head>
  <title>My Page</title>
</head>
<body>
  <h1>Hello World</h1>
</body>
</html>`}
      </CodeHighlighter>
    </div>
  );
};

export default App;
```

[自定义 Header

[](https://x.ant.design/components/code-highlighter-cn#code-highlighter-demo-custom-header)

```tsx
import { CodeHighlighter } from '@ant-design/x';
import { Button, Space } from 'antd';
import React from 'react';

const App = () => {
  const code = `import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>当前计数：{count}</p>
      <button onClick={() => setCount(count + 1)}>增加</button>
    </div>
  );
}`;

  const customHeader = (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        background: '#f5f5f5',
      }}
    >
      <Space>
        <span style={{ fontWeight: 500 }}>React 计数器示例</span>
        <span
          style={{
            padding: '2px 8px',
            background: '#e6f7ff',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#1890ff',
          }}
        >
          JavaScript
        </span>
      </Space>
      <Space>
        <Button size="small" type="text">
          运行
        </Button>
        <Button size="small" type="text">
          分享
        </Button>
      </Space>
    </div>
  );

  return (
    <CodeHighlighter lang="javascript" header={customHeader}>
      {code}
    </CodeHighlighter>
  );
};

export default App;
```

[配合 XMarkdown](https://x.ant.design/components/code-highlighter-cn#code-highlighter-demo-with-xmarkdown)

```tsx
import { Bubble } from '@ant-design/x';
import XMarkdown, { type ComponentProps } from '@ant-design/x-markdown';
import { Button, Flex } from 'antd';
import React from 'react';
import CodeHighlighter from '../index';

const text = `
Here's a Python code block example that demonstrates how to calculate Fibonacci numbers:

\`\`\` python
def fibonacci(n):
    """
    Calculate the nth Fibonacci number
    :param n: The position in the Fibonacci sequence (must be a positive integer)
    :return: The value at position n
    """
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    else:
        a, b = 0, 1
        for _ in range(2, n+1):
            a, b = b, a + b
        return b

# Example usage
if __name__ == "__main__":
    num = 10
    print(f"The {num}th Fibonacci number is: {fibonacci(num)}")
    
    # Print the first 15 Fibonacci numbers
    print("First 15 Fibonacci numbers:")
    for i in range(1, 16):
        print(fibonacci(i), end=" ")
\`\`\`

This code includes:

1. A function to compute Fibonacci numbers
2. Docstring documentation
3. Example usage in the main block
4. A loop to print the first 15 numbers

You can modify the parameters or output format as needed. The Fibonacci sequence here starts with fib(1) = 1, fib(2) = 1.
`;

const Code: React.FC<ComponentProps> = (props) => {
  const { className, children } = props;
  const lang = className?.match(/language-(\w+)/)?.[1] || '';

  if (typeof children !== 'string') return null;
  return <CodeHighlighter lang={lang}>{children}</CodeHighlighter>;
};

const App = () => {
  const [index, setIndex] = React.useState(0);
  const timer = React.useRef<any>(-1);

  const renderStream = () => {
    if (index >= text.length) {
      clearTimeout(timer.current);
      return;
    }
    timer.current = setTimeout(() => {
      setIndex((prev) => prev + 5);
      renderStream();
    }, 20);
  };

  React.useEffect(() => {
    if (index === text.length) return;
    renderStream();
    return () => {
      clearTimeout(timer.current);
    };
  }, [index]);

  return (
    <Flex vertical gap="small">
      <Button style={{ alignSelf: 'flex-end' }} onClick={() => setIndex(0)}>
        Re-Render
      </Button>

      <Bubble
        content={text.slice(0, index)}
        contentRender={(content) => (
          <XMarkdown components={{ code: Code }} paragraphTag="div">
            {content}
          </XMarkdown>
        )}
        variant="outlined"
      />
    </Flex>
  );
};

export default App;
```

## API

通用属性参考：[通用属性](https://x.ant.design/docs/react/common-props-cn)。

### CodeHighlighterProps

| 属性           | 说明         | 类型                                                         | 默认值          |
| :------------- | :----------- | :----------------------------------------------------------- | :-------------- |
| lang           | 语言         | `string`                                                     | -               |
| children       | 代码内容     | `string`                                                     | -               |
| header         | 顶部         | `React.ReactNode | null`                                     | React.ReactNode |
| className      | 样式类名     | `string`                                                     |                 |
| classNames     | 样式类名     | `string`                                                     | -               |
| highlightProps | 代码高亮配置 | [`highlightProps`](https://github.com/react-syntax-highlighter/react-syntax-highlighter?tab=readme-ov-file#props) | -               |

### CodeHighlighterRef

| 属性          | 说明         | 类型        | 版本 |
| :------------ | :----------- | :---------- | :--- |
| nativeElement | 获取原生节点 | HTMLElement | -    |

## Semantic DOM

typescript

```typescript
import React from 'react';
import { XMarkdown } from '@ant-design/x-markdown';

const App = () => <XMarkdown content='Hello World' />;
export default App;
```

- ##### root

  根节点

- ##### header

  头部的容器

- ##### headerTitle

  标题

- ##### code

  代码容器

## 主题变量（Design Token）



组件 Token如何定制？

| Token 名称      | 描述           | 类型   | 默认值           |
| --------------- | -------------- | ------ | ---------------- |
| colorBgTitle    | 标题背景颜色   | string | rgba(0,0,0,0.06) |
| colorBorderCode | 代码块边框颜色 | string | #f0f0f0          |
| colorTextTitle  | 标题文本颜色   | string | rgba(0,0,0,0.88) |

全局 Token如何定制？

| Token 名称           | 描述                                                         | 类型   | 默认值                                                       |
| -------------------- | ------------------------------------------------------------ | ------ | ------------------------------------------------------------ |
| colorBgContainer     | 组件的容器背景色，例如：默认按钮、输入框等。务必不要将其与 `colorBgElevated` 混淆。 | string | #ffffff                                                      |
| colorBorderSecondary | 比默认使用的边框色要浅一级，此颜色和 colorSplit 的颜色一致。使用的是实色。 | string | #f0f0f0                                                      |
| colorFillContent     | 控制内容区域的背景色。                                       | string | rgba(0,0,0,0.06)                                             |
| colorText            | 最深的文本色。为了符合W3C标准，默认的文本颜色使用了该色，同时这个颜色也是最深的中性色。 | string | rgba(0,0,0,0.88)                                             |
| borderRadius         | 基础组件的圆角大小，例如按钮、输入框、卡片等                 | number | 6                                                            |
| fontFamilyCode       | 代码字体，用于 Typography 内的 code、pre 和 kbd 类型的元素   | string | 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace |
| fontSize             | 设计系统中使用最广泛的字体大小，文本梯度也将基于该字号进行派生。 | number | 14                                                           |
| fontWeightStrong     | 控制标题类组件（如 h1、h2、h3）或选中项的字体粗细。          | number | 600                                                          |
| paddingSM            | 控制元素的小内间距。                                         | number | 12                                                           |
