# AI公文写作助手

这是一个基于 Next.js 和OpenAI API开发的智能公文写作助手，可以帮助用户快速生成各类专业公文。

## 功能特点

- 支持多种公文类型：通知、报告、请示、总结等
- 智能生成符合规范的公文内容
- 提供写作提示功能
- 响应式设计，支持各种设备
- 简洁直观的用户界面

## 技术栈

- Next.js 14
- TypeScript
- Tailwind CSS
- OpenAI API
- React

## 开始使用

1. 克隆项目
```bash
git clone [项目地址]
cd ai-document-writer
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
复制 `.env.local.example` 文件为 `.env.local`，并填入你的 OpenAI API 密钥：
```
OPENAI_API_KEY=your_openai_api_key_here
```

4. 启动开发服务器
```bash
npm run dev
```

5. 在浏览器中访问 `http://localhost:3000`

## 使用说明

1. 在首页选择"开始写作"或"查看模板"
2. 选择需要的公文类型
3. 可以输入写作提示来指导AI生成内容
4. 点击"生成文档"按钮
5. 等待AI生成内容
6. 复制生成的内容进行编辑和使用

## 注意事项

- 请确保有有效的 OpenAI API 密钥
- 生成的内容仅供参考，建议进行人工审核和修改
- 请遵守相关法律法规和公文写作规范

## 许可证

MIT
