import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export const runtime = 'nodejs'

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
})

const MAX_PDF_SIZE = 10 * 1024 * 1024

export async function POST(request: Request) {
  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: '缺少环境变量 DEEPSEEK_API_KEY' }, { status: 500 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: '未找到 PDF 文件' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: '仅支持 PDF 文件' }, { status: 400 })
    }

    if (file.size > MAX_PDF_SIZE) {
      return NextResponse.json({ error: 'PDF 文件过大（最大 10MB）' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: Buffer.from(arrayBuffer) })
    const data = await parser.getText()
    const rawText = String(data.text || '').replace(/\s+/g, ' ').trim()
    const truncated = rawText.slice(0, 12000)

    if (!truncated) {
      return NextResponse.json({ error: 'PDF 未提取到有效文本' }, { status: 400 })
    }

    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: buildPaperIdeaSystemPrompt() },
        { role: 'user', content: `请基于以下论文文本撰写研究思路：\n${truncated}` },
      ],
      temperature: 0.6,
      max_tokens: 2400,
    })

    return NextResponse.json({
      content: completion.choices?.[0]?.message?.content ?? '',
    })
  } catch (error) {
    console.error('Error generating paper idea:', error)
    const message =
      error instanceof Error ? error.message : '未知错误，请查看服务端日志'
    return NextResponse.json({ error: `生成研究思路时发生错误：${message}` }, { status: 500 })
  }
}

function buildPaperIdeaSystemPrompt() {
  return `你是“经济研究期刊论文研究思路生成助手”。
请基于给定论文内容，生成约2000字的研究思路，中文学术写作风格，面向中国情境。

必须覆盖以下要点：
1) 研究问题与背景（中国情境）
2) 核心变量与数据来源（清楚列出变量构造与可获得的数据）
3) 识别策略/研究设计（强调可行的因果识别或稳健性）
4) 机制与故事线（理论机制与现实故事）
5) 创新点与边际贡献（至少2点）

约束：
- 不编造具体数据或政策细节；不足处用〔占位〕标注
- 不使用Markdown，不要列表符号之外的花哨符号
- 输出为一篇连续的研究思路文本，不解释写作过程`
}
