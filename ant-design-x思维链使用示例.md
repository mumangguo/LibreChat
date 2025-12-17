# ThoughtChain思维链

https://x.ant.design/components/thought-chain-cn

思维链组件用于可视化和追踪 Agent 对 Actions 和 Tools 的调用链。

| 使用import { ThoughtChain } from "@ant-design/x";            |
| ------------------------------------------------------------ |
| 源码[components/thought-chain](https://github.com/ant-design/x/blob/main/components/thought-chain) |
| 文档[编辑此页](https://github.com/ant-design/x/edit/main/components/thought-chain/index.zh-CN.md)更新日志 |
| 版本自 2.0.0 起支持                                          |

## 何时使用

- 调试和跟踪复杂 Agent System 中的调用链
- 类似的链式场景中使用

##  代码演示

```tsx
import type { ThoughtChainProps } from '@ant-design/x';
import { ThoughtChain } from '@ant-design/x';
import { Card } from 'antd';
import React from 'react';

const items: ThoughtChainProps['items'] = [
  {
    title: 'Knowledge Query',
    description: 'Query knowledge base',
  },
  {
    title: 'Web Search Tool Invoked',
    description: 'Tool invocation',
  },
  {
    title: 'Model Invocation Complete',
    description: 'Invoke model for response',
  },

  {
    title: 'Response Complete',
    description: 'Task completed',
    blink: true,
  },
];

export default () => (
  <Card style={{ width: 500 }}>
    <ThoughtChain items={items} />
  </Card>
);
```

[节点状态](https://x.ant.design/components/thought-chain-cn#thought-chain-demo-status)

思维链节点支持配置 `status` 属性来明显的表明当前节点的执行状态

```tsx
import { CheckCircleOutlined, InfoCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import type { ThoughtChainItemType } from '@ant-design/x';
import { ThoughtChain } from '@ant-design/x';
import { Button, Card } from 'antd';
import React from 'react';

function getStatusIcon(status: ThoughtChainItemType['status']) {
  switch (status) {
    case 'success':
      return <CheckCircleOutlined />;
    case 'error':
      return <InfoCircleOutlined />;
    case 'loading':
      return <LoadingOutlined />;
    default:
      return undefined;
  }
}

const mockServerResponseData: ThoughtChainItemType[] = [
  {
    title: 'Thought Chain Item - 1',
    status: 'success',
    description: 'status: success',
    icon: getStatusIcon('success'),
  },
  {
    title: 'Thought Chain Item - 2',
    status: 'error',
    description: 'status: error',
    icon: getStatusIcon('error'),
  },
];

const delay = (ms: number) => {
  return new Promise<void>((resolve) => {
    const timer: NodeJS.Timeout = setTimeout(() => {
      clearTimeout(timer);
      resolve();
    }, ms);
  });
};

function addChainItem() {
  mockServerResponseData.push({
    title: `Thought Chain Item - ${mockServerResponseData.length + 1}`,
    status: 'loading',
    icon: getStatusIcon('loading'),
    description: 'status: loading',
  });
}

async function updateChainItem(status: ThoughtChainItemType['status']) {
  await delay(800);
  mockServerResponseData[mockServerResponseData.length - 1].status = status;
  mockServerResponseData[mockServerResponseData.length - 1].icon = getStatusIcon(status);
  mockServerResponseData[mockServerResponseData.length - 1].description = `status: ${status}`;
}

export default () => {
  const [items, setItems] = React.useState<ThoughtChainItemType[]>(mockServerResponseData);
  const [loading, setLoading] = React.useState<boolean>(false);

  const mockStatusChange = async () => {
    await updateChainItem('error');
    setItems([...mockServerResponseData]);
    await updateChainItem('loading');
    setItems([...mockServerResponseData]);
    await updateChainItem('success');
    setItems([...mockServerResponseData]);
  };

  const onClick = async () => {
    setLoading(true);
    addChainItem();
    setItems([...mockServerResponseData]);
    await mockStatusChange();
    setLoading(false);
  };

  return (
    <Card style={{ width: 500 }}>
      <Button onClick={onClick} style={{ marginBottom: 16 }} loading={loading}>
        {loading ? 'Running' : 'Run Next'}
      </Button>
      <ThoughtChain items={items} />
    </Card>
  );
};
```

[简洁思维链](https://x.ant.design/components/thought-chain-cn#thought-chain-demo-simple)

简洁思维链，提供不同的类型可供选择。

```tsx
import { EditOutlined, GlobalOutlined, SearchOutlined, SunOutlined } from '@ant-design/icons';
import { ThoughtChain } from '@ant-design/x';
import { Flex, Typography } from 'antd';
import React from 'react';

const { Text } = Typography;

const onClick = () => {
  console.log('Item Click');
};

export default () => (
  <Flex vertical gap="middle">
    <Flex gap="small" wrap align="center">
      <Text>loading status:</Text>
      <ThoughtChain.Item variant="solid" status="loading" title="Tool Calling" />
      <ThoughtChain.Item variant="outlined" status="loading" title="Tool Calling" />
      <ThoughtChain.Item variant="text" status="loading" title="Tool Calling" />
    </Flex>

    <Flex gap="small" wrap align="center">
      <Text>success status:</Text>
      <ThoughtChain.Item variant="solid" status="success" title="Tool Call Finished" />
      <ThoughtChain.Item variant="outlined" status="success" title="Tool Call Finished" />
      <ThoughtChain.Item variant="text" status="success" title="Tool Call Finished" />
    </Flex>

    <Flex gap="small" wrap align="center">
      <Text>error status:</Text>
      <ThoughtChain.Item variant="solid" status="error" title="Tool Call Error" />
      <ThoughtChain.Item variant="outlined" status="error" title="Tool Call Error" />
      <ThoughtChain.Item variant="text" status="error" title="Tool Call Error" />
    </Flex>

    <Flex gap="small" wrap align="center">
      <Text>abort status</Text>
      <ThoughtChain.Item variant="solid" status="abort" title="Agent Response Aborted" />
      <ThoughtChain.Item variant="outlined" status="abort" title="Agent Response Aborted" />
      <ThoughtChain.Item variant="text" status="abort" title="Agent Response Aborted" />
    </Flex>

    <Flex gap="small" wrap align="center">
      <Text>custom icon:</Text>
      <ThoughtChain.Item variant="solid" icon={<SunOutlined />} title="Task Completed" />
      <ThoughtChain.Item variant="outlined" icon={<SunOutlined />} title="Task Completed" />
      <ThoughtChain.Item variant="text" icon={<SunOutlined />} title="Task Completed" />
    </Flex>

    <Flex gap="small" wrap align="center">
      <Text>description & click:</Text>
      <ThoughtChain.Item
        variant="solid"
        onClick={onClick}
        icon={<GlobalOutlined />}
        title="Opening Webpage"
        description="https://x.ant.design/docs/playground/copilot"
      />
      <ThoughtChain.Item
        variant="outlined"
        onClick={onClick}
        icon={<EditOutlined />}
        title="Creating"
        description="todo.md"
      />
      <ThoughtChain.Item
        variant="text"
        onClick={onClick}
        icon={<SearchOutlined />}
        title="Searching"
        description="Route Information"
      />
    </Flex>
    <Flex gap="small" wrap align="center">
      <Text>blink:</Text>
      <ThoughtChain.Item blink variant="solid" icon={<SunOutlined />} title="Task Completed" />
      <ThoughtChain.Item blink variant="outlined" icon={<SunOutlined />} title="Task Completed" />
      <ThoughtChain.Item
        blink
        variant="text"
        icon={<SunOutlined />}
        title="Task Completed"
        description="Route Information"
      />
    </Flex>
  </Flex>
);
```

[可折叠的](https://x.ant.design/components/thought-chain-cn#thought-chain-demo-collapsible)

配置 `collapsible` 可开启对思维链节点内容区域的折叠功能

```tsx
import type { ThoughtChainProps } from '@ant-design/x';
import { ThoughtChain } from '@ant-design/x';
import { Flex, Typography } from 'antd';
import React from 'react';

const { Text } = Typography;

import { CodeOutlined, EditOutlined } from '@ant-design/icons';
import { Card } from 'antd';

const items: ThoughtChainProps['items'] = [
  {
    key: 'create_task',
    title: 'Create Task: Write New Component',
    description: 'Execute files needed for creating new component',
    collapsible: true,
    content: (
      <Flex gap="small" vertical>
        <Text type="secondary">Creating folder for new component</Text>
        <ThoughtChain.Item
          variant="solid"
          icon={<CodeOutlined />}
          title="Executing command"
          description="mkdir -p component"
        />
        <Text type="secondary">Creating files needed for new component</Text>
        <ThoughtChain.Item
          variant="solid"
          icon={<EditOutlined />}
          title="Creating file"
          description="component/index.tsx"
        />
        <Text type="secondary">Creating Chinese description file for new component</Text>
        <ThoughtChain.Item
          variant="solid"
          icon={<EditOutlined />}
          title="Creating file"
          description="component/index.zh-CN.md"
        />
        <Text type="secondary">Creating English description file for new component</Text>
        <ThoughtChain.Item
          variant="solid"
          icon={<EditOutlined />}
          title="Creating file"
          description="component/index.en-US.md"
        />
      </Flex>
    ),
    status: 'success',
  },
  {
    key: 'check_task',
    title: 'Checking Task Execution Steps',
    description: 'Verify overall task execution logic and feasibility',
    content: (
      <Flex gap="small" vertical>
        <ThoughtChain.Item
          variant="solid"
          status="success"
          title="Folder created"
          description="component"
        />
        <ThoughtChain.Item
          variant="solid"
          status="success"
          title="File created"
          description="component/index.tsx"
        />
        <ThoughtChain.Item
          variant="solid"
          status="success"
          title="File created"
          description="component/index.zh-CN.md"
        />
        <ThoughtChain.Item
          variant="solid"
          status="success"
          title="File created"
          description="component/index.en-US.md"
        />
      </Flex>
    ),
    status: 'loading',
  },
];

const App: React.FC = () => {
  return (
    <Card style={{ width: 500 }}>
      <ThoughtChain defaultExpandedKeys={['create_task']} items={items} />
    </Card>
  );
};

export default App;
```

[受控的折叠](https://x.ant.design/components/thought-chain-cn#thought-chain-demo-controlled-collapsible)

受控的思维链节点内容区域的折叠功能。

```tsx
import type { ThoughtChainProps } from '@ant-design/x';
import { ThoughtChain } from '@ant-design/x';
import { Button, Flex, Typography } from 'antd';
import React, { useState } from 'react';

const { Text } = Typography;

import { CodeOutlined, EditOutlined } from '@ant-design/icons';
import { Card } from 'antd';

const items: ThoughtChainProps['items'] = [
  {
    key: 'create_task',
    title: 'Create Task: Develop New Component',
    description: 'Execute files needed for new component creation',
    collapsible: true,
    content: (
      <Flex gap="small" vertical>
        <Text type="secondary">Creating folder for new component</Text>
        <ThoughtChain.Item
          variant="solid"
          icon={<CodeOutlined />}
          title="Executing command"
          description="mkdir -p component"
        />
        <Text type="secondary">Creating files needed for new component</Text>
        <ThoughtChain.Item
          variant="solid"
          icon={<EditOutlined />}
          title="Creating file"
          description="component/index.tsx"
        />
        <Text type="secondary">Creating Chinese documentation file</Text>
        <Text type="secondary">Creating English description file for new component</Text>
        <ThoughtChain.Item
          variant="solid"
          icon={<EditOutlined />}
          title="Continue creating file"
          description="component/index.en-US.md"
        />
      </Flex>
    ),
    status: 'success',
  },
  {
    key: 'check_task',
    title: 'Check Task Execution Steps Completion',
    collapsible: true,
    description: 'Verify the overall task execution logic and feasibility',
    content: (
      <Flex gap="small" vertical>
        <ThoughtChain.Item
          variant="solid"
          status="success"
          title="Folder created"
          description="component"
        />
        <ThoughtChain.Item
          variant="solid"
          status="success"
          title="File created"
          description="component/index.tsx"
        />
        <ThoughtChain.Item
          variant="solid"
          status="success"
          title="File created"
          description="component/index.zh-CN.md"
        />
        <ThoughtChain.Item
          variant="solid"
          status="success"
          title="File created"
          description="component/index.en-US.md"
        />
      </Flex>
    ),
    status: 'success',
  },
  {
    key: 'used_task',
    title: 'Using the New Component',
    description: 'Using the generated component to complete the task',
    content: (
      <Flex gap="small" vertical>
        <ThoughtChain.Item
          variant="solid"
          status="success"
          title="File created"
          description="component"
        />
      </Flex>
    ),
    status: 'loading',
  },
];

const App: React.FC = () => {
  const [expandedKeys, setExpandedKeys] = useState(['create_task']);
  return (
    <Card style={{ width: 500 }}>
      <Button
        style={{ marginBottom: 16 }}
        onClick={() => {
          setExpandedKeys(['check_task']);
        }}
      >
        Open "check_task" details
      </Button>
      <ThoughtChain items={items} expandedKeys={expandedKeys} onExpand={setExpandedKeys} />
    </Card>
  );
};

export default App;
```

[客制化](https://x.ant.design/components/thought-chain-cn#thought-chain-demo-customization)

`items` 属性支持灵活的客制化配置，详情参考 `ThoughtChainItemType` 定义

```tsx
import { CodeOutlined, EditOutlined, HeartTwoTone, SmileTwoTone } from '@ant-design/icons';
import type { ThoughtChainItemType } from '@ant-design/x';
import { Think, ThoughtChain } from '@ant-design/x';
import { Button, Card, Flex, Typography } from 'antd';
import React from 'react';

const { Text } = Typography;
const items: ThoughtChainItemType[] = [
  {
    title: 'Create Task',
    description: 'description',
    icon: <HeartTwoTone twoToneColor="#eb2f96" />,
    footer: <Button block>Thought Chain Item Footer</Button>,
    content: (
      <Flex gap="small" vertical>
        <Think title="Thinking Process">
          {`1. Analyze task, understand task workflow\n2. Task creation, files needed for task\n3. Task execution, using new component`}
        </Think>
        <Text type="secondary">Creating folder for new component</Text>
        <ThoughtChain.Item
          variant="solid"
          icon={<CodeOutlined />}
          title="Executing command"
          description="mkdir -p component"
        />
        <Text type="secondary">Creating files needed for new component</Text>
        <ThoughtChain.Item
          variant="solid"
          icon={<EditOutlined />}
          title="Creating file"
          description="component/index.tsx"
        />
        <Text type="secondary">Creating Chinese documentation file for new component</Text>
        <ThoughtChain.Item
          variant="solid"
          icon={<EditOutlined />}
          title="Continue creating file"
          description="component/index.zh-CN.md"
        />
        <Text type="secondary">Creating English description file for new component</Text>
        <ThoughtChain.Item
          variant="solid"
          icon={<EditOutlined />}
          title="Continue creating file"
          description="component/index.en-US.md"
        />
      </Flex>
    ),
  },
  {
    key: 'check_task',
    title: 'Check Task Execution Steps Completion',
    icon: <SmileTwoTone />,
    collapsible: true,
    description: 'Verify the overall task execution logic and feasibility',
    content: (
      <Flex gap="small" vertical>
        <ThoughtChain.Item
          variant="solid"
          status="success"
          title="Folder creation completed"
          description="component"
        />
        <ThoughtChain.Item
          variant="solid"
          status="success"
          title="File creation completed"
          description="component/index.tsx"
        />
        <ThoughtChain.Item
          variant="solid"
          status="success"
          title="File creation completed"
          description="component/index.zh-CN.md"
        />
        <ThoughtChain.Item
          variant="solid"
          status="success"
          title="File creation completed"
          description="component/index.en-US.md"
        />
      </Flex>
    ),
  },
  {
    key: 'used_task',
    title: 'Checking Task Execution Steps',
    description: 'Verify the overall task execution logic and feasibility',
    content: (
      <Flex gap="small" vertical>
        <ThoughtChain.Item
          variant="solid"
          status="success"
          title="Folder creation completed"
          description="component"
        />
        <ThoughtChain.Item
          variant="solid"
          status="success"
          title="File creation completed"
          description="component/index.tsx"
        />
        <ThoughtChain.Item
          variant="solid"
          status="success"
          title="File creation completed"
          description="component/index.zh-CN.md"
        />
        <ThoughtChain.Item
          variant="solid"
          status="success"
          title="File creation completed"
          description="component/index.en-US.md"
        />
      </Flex>
    ),
    status: 'error',
  },
];

const App: React.FC = () => {
  return (
    <Card style={{ width: 500 }}>
      <ThoughtChain items={items} line="dashed" />
    </Card>
  );
};

export default App;
```



## 主题变量（Design Token）

组件 Token如何定制？

| Token 名称            | 描述                                      | 类型   | 默认值           |
| --------------------- | ----------------------------------------- | ------ | ---------------- |
| colorTextBlink        | 打字动画颜色                              | string | #000             |
| colorTextBlinkDefault | 默认打字动画颜色                          | string | rgba(0,0,0,0.45) |
| iconSize              | 图标容器尺寸                              | number | 14               |
| itemBorderRadius      | ThoughtChain.Item 圆角                    | number | 6                |
| itemMotionDescription | 思维链节点描述文字的动画颜色              | string | #00000040        |
| itemOutlinedBg        | 边框模式的 ThoughtChain.Item 背景色       | string | #ffffff          |
| itemOutlinedHoverBg   | 边框模式的 ThoughtChain.Item 悬浮态背景色 | string | rgba(0,0,0,0.06) |
| itemSolidBg           | 实心的 ThoughtChain.Item 背景色           | string | rgba(0,0,0,0.04) |
| itemSolidHoverBg      | 实心的 ThoughtChain.Item 悬浮态背景色     | string | rgba(0,0,0,0.06) |



全局 Token如何定制？

| Token 名称              | 描述                                                         | 类型   | 默认值                               |
| ----------------------- | ------------------------------------------------------------ | ------ | ------------------------------------ |
| colorBorder             | 默认使用的边框颜色, 用于分割不同的元素，例如：表单的分割线、卡片的分割线等。 | string | #d9d9d9                              |
| colorError              | 用于表示操作失败的 Token 序列，如失败按钮、错误状态提示（Result）组件等。 | string | #ff4d4f                              |
| colorErrorBg            | 错误色的浅色背景颜色                                         | string | #fff2f0                              |
| colorErrorBgFilledHover | 错误色的浅色填充背景色悬浮态，目前只用在危险填充按钮的 hover 效果。 | string | #ffdfdc                              |
| colorErrorBorder        | 错误色的描边色                                               | string | #ffccc7                              |
| colorFillContent        | 控制内容区域的背景色。                                       | string | rgba(0,0,0,0.06)                     |
| colorPrimary            | 品牌色是体现产品特性和传播理念最直观的视觉元素之一。在你完成品牌主色的选取之后，我们会自动帮你生成一套完整的色板，并赋予它们有效的设计语义 | string | #1677ff                              |
| colorSuccess            | 用于表示操作成功的 Token 序列，如 Result、Progress 等组件会使用该组梯度变量。 | string | #52c41a                              |
| colorText               | 最深的文本色。为了符合W3C标准，默认的文本颜色使用了该色，同时这个颜色也是最深的中性色。 | string | rgba(0,0,0,0.88)                     |
| colorTextDescription    | 控制文本描述字体颜色。                                       | string | rgba(0,0,0,0.45)                     |
| colorTextSecondary      | 作为第二梯度的文本色，一般用在不那么需要强化文本颜色的场景，例如 Label 文本、Menu 的文本选中态等场景。 | string | rgba(0,0,0,0.65)                     |
| fontSize                | 设计系统中使用最广泛的字体大小，文本梯度也将基于该字号进行派生。 | number | 14                                   |
| fontSizeSM              | 小号字体大小                                                 | number | 12                                   |
| lineHeight              | 文本行高                                                     | number | 1.5714285714285714                   |
| lineType                | 用于控制组件边框、分割线等的样式，默认是实线                 | string | solid                                |
| lineWidth               | 用于控制组件边框、分割线等的宽度                             | number | 1                                    |
| margin                  | 控制元素外边距，中等尺寸。                                   | number | 16                                   |
| marginSM                | 控制元素外边距，中小尺寸。                                   | number | 12                                   |
| marginXS                | 控制元素外边距，小尺寸。                                     | number | 8                                    |
| marginXXS               | 控制元素外边距，最小尺寸。                                   | number | 4                                    |
| motionDurationMid       | 动效播放速度，中速。用于中型元素动画交互                     | string | 0.2s                                 |
| motionEaseInOut         | 预设动效曲率                                                 | string | cubic-bezier(0.645, 0.045, 0.355, 1) |
| padding                 | 控制元素的内间距。                                           | number | 16                                   |
| paddingSM               | 控制元素的小内间距。                                         | number | 12                                   |
| paddingXXS              | 控制元素的极小内间距。                                       | number | 4                                    |
