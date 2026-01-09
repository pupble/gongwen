'use client'
import { useState, useEffect, Suspense, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  AlignmentType,
  BorderStyle,
  Document as DocxDocument,
  DocumentGridType,
  Footer,
  LineRuleType,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from 'docx'

const documentTypes = [
  { id: 'notice', name: '通知', description: '用于发布重要事项或要求' },
  { id: 'report', name: '报告', description: '用于汇报工作或情况' },
  { id: 'request', name: '请示', description: '用于向上级请求指示或批准' },
  { id: 'summary', name: '总结', description: '用于总结工作或活动' },
]

const templateOptions = [
  {
    id: 'general-office',
    name: '校办通用模板',
    description: '适用于校办与综合协调类公文',
    promptPrefix:
      '模板：校办通用。要求：语气权威、部署清晰，强调“统筹协调、压实责任、时限明确、闭环落实”。',
  },
  {
    id: 'academic-affairs',
    name: '教务处模板',
    description: '教学安排、考试管理、教学质量等',
    promptPrefix:
      '模板：教务处。要求：教学环节完整，涉及课程/考试/质量要求要写清楚流程、材料、节点。',
  },
  {
    id: 'research-office',
    name: '科研处模板',
    description: '科研项目、成果管理、平台建设等',
    promptPrefix:
      '模板：科研处。要求：突出项目管理要点、申报条件、评审流程、成果归档与绩效要求。',
  },
  {
    id: 'student-affairs',
    name: '学工部模板',
    description: '学生管理、思政教育、奖惩评优等',
    promptPrefix:
      '模板：学工部。要求：强调教育引导、过程管理、责任分工与风险防控。',
  },
  {
    id: 'custom',
    name: '自定义模板',
    description: '输入学院/部门专用模板要求',
    promptPrefix: '',
  },
]

const paperTemplates = [
  {
    id: 'econ-standard',
    name: '经济研究标准风格',
    description: '注重因果识别、严谨表述与稳健性检验',
    promptPrefix:
      '论文风格：经济研究。要求：学术严谨、逻辑清晰、表述克制，强调识别策略、稳健性与机制分析。',
  },
  {
    id: 'policy-eval',
    name: '政策评估风格',
    description: '突出政策背景、识别设计与政策含义',
    promptPrefix:
      '论文风格：政策评估。要求：交代政策背景、样本构造、识别策略与政策含义，避免夸大结论。',
  },
  {
    id: 'custom',
    name: '自定义论文模板',
    description: '输入你偏好的论文写作要求',
    promptPrefix: '',
  },
]

export default function WritePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <WritePageContent />
    </Suspense>
  )
}

function WritePageContent() {
  const searchParams = useSearchParams()
  const [selectedType, setSelectedType] = useState('')
  const [content, setContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [govPrompt, setGovPrompt] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState(templateOptions[0].id)
  const [customTemplate, setCustomTemplate] = useState('')
  const [templateWarning, setTemplateWarning] = useState<string | null>(null)
  const [writingMode, setWritingMode] = useState<'gov' | 'paper'>('gov')
  const [selectedPaperTemplateId, setSelectedPaperTemplateId] = useState(
    paperTemplates[0].id,
  )
  const [customPaperTemplate, setCustomPaperTemplate] = useState('')
  const [paperFields, setPaperFields] = useState({
    title: '',
    abstract: '',
    keywords: '',
    introduction: '',
    literature: '',
    variables: '',
    model: '',
    design: '',
    results: '',
    robustness: '',
    conclusion: '',
  })
  const [paperExtraPrompt, setPaperExtraPrompt] = useState('')
  const [paperDraft, setPaperDraft] = useState('')
  const [paperSections, setPaperSections] = useState<string[]>([
    'title',
    'abstract',
    'keywords',
    'introduction',
    'literature',
    'variables',
    'model',
    'design',
    'results',
    'robustness',
    'conclusion',
  ])
  const samplePaperFields = {
    title: '数字化转型、融资约束与企业绿色创新',
    abstract:
      '基于2012—2022年中国A股制造业上市公司数据，本文从融资约束视角检验数字化转型对企业绿色创新的影响。采用双向固定效应模型，并结合工具变量与倾向得分匹配进行稳健性检验。结果表明，数字化转型显著促进企业绿色创新，融资约束在其中发挥部分中介作用，政策环境与行业竞争强化这一效应。研究为数字化与绿色转型协同推进提供经验证据。',
    keywords: '数字化转型；融资约束；绿色创新；双向固定效应；中介效应',
    introduction:
      '在“双碳”目标背景下，企业绿色创新成为高质量发展的关键路径。数字化转型通过信息透明与资源配置优化可能提升绿色创新，但其影响机制与边界条件仍需检验。本文从融资约束视角切入，构建理论框架并提供经验证据。',
    literature:
      '现有研究关注数字化转型对生产效率与创新的影响，也有文献讨论融资约束对创新的抑制作用，但二者结合的机制研究相对不足。本文补充数字化转型缓解融资约束进而促进绿色创新的证据。',
    variables:
      '被解释变量为绿色创新（绿色专利申请数）。核心解释变量为数字化转型指数（基于年报文本与IT投入）。控制变量包括企业规模、资产负债率、盈利能力、成长性与行业竞争度等。',
    model:
      '构建数字化转型影响绿色创新的理论路径：数字化提升信息披露与资源配置效率，缓解融资约束，进而提升绿色创新投入与产出。',
    design:
      '采用双向固定效应模型进行基准回归，进一步使用工具变量法缓解内生性；通过PSM-DID与替换指标进行稳健性检验。',
    results:
      '基准回归显示数字化转型对绿色创新具有显著正向影响。机制检验表明融资约束起部分中介作用。异质性分析发现在高竞争行业和政策支持地区效应更强。',
    robustness:
      '使用替代指标、滞后项、剔除极端值与不同样本窗口后结论稳健；安慰剂检验未发现虚假效应。',
    conclusion:
      '数字化转型可显著促进企业绿色创新，政策应鼓励数字化投入并完善绿色金融支持体系，以缓解融资约束。',
  }
  const [editPrompt, setEditPrompt] = useState('')
  const [isPolishing, setIsPolishing] = useState(false)
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const contentRef = useRef<HTMLTextAreaElement | null>(null)
  const [isMac, setIsMac] = useState(false)
  const [govContent, setGovContent] = useState('')
  const [paperContent, setPaperContent] = useState('')
  const [govHistory, setGovHistory] = useState<string[]>([])
  const [govHistoryIndex, setGovHistoryIndex] = useState(-1)
  const [paperHistory, setPaperHistory] = useState<string[]>([])
  const [paperHistoryIndex, setPaperHistoryIndex] = useState(-1)
  const [govVersions, setGovVersions] = useState<
    { id: string; label: string; content: string; time: string }[]
  >([])
  const [paperVersions, setPaperVersions] = useState<
    { id: string; label: string; content: string; time: string }[]
  >([])
  const [strictLayout, setStrictLayout] = useState(true)
  const [missingElements, setMissingElements] = useState<string[]>([])
  const [showPreflight, setShowPreflight] = useState(false)
  const [preflightItems, setPreflightItems] = useState<
    { id: string; label: string; position: number }[]
  >([])
  const [pendingExport, setPendingExport] = useState<'docx' | 'md' | null>(null)
  const lastHistoryTimeRef = useRef(0)

  const normalizeContent = (value: string) => {
    const withoutBold = value.replace(/\*\*(.*?)\*\*/g, '$1').replace(/__/g, '')
    return withoutBold.replace(/\r\n/g, '\n').trimEnd()
  }

  const applyDatePlaceholders = (value: string, userPrompt: string) => {
    const hasDate =
      /\d{4}年\d{1,2}月\d{1,2}日/.test(userPrompt) ||
      /\d{4}年/.test(userPrompt) ||
      /\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(userPrompt)
    if (hasDate) {
      return value
    }
    const lines = value.split('\n')
    const cleaned = lines.map((line) => {
      const trimmed = line.trim()
      if (/^\d{4}年\d{1,2}月\d{1,2}日$/.test(trimmed)) {
        return '〔占位：YYYY年MM月DD日〕'
      }
      if (/^\s*〔.*\d{4}.*〕\s*$/.test(trimmed)) {
        return trimmed.replace(/\d{4}/g, 'YYYY')
      }
      return line
    })
    return cleaned.join('\n')
  }

  const evaluateMissingElements = (value: string) => {
    const lines = value.split(/\r?\n/).map((line) => line.trim())
    const titleIndex = detectTitleIndex(lines)
    const hasTitle = titleIndex >= 0
    const hasAddressee = lines.some(
      (line) =>
        line.endsWith('：') &&
        !line.startsWith('附件') &&
        !line.startsWith('抄送') &&
        !line.startsWith('主送'),
    )
    const hasSignature = lines
      .slice(-6)
      .some((line) => /沈阳师范大学|学院|处室|〔占位/.test(line))
    const hasDate = lines.some(
      (line) =>
        /\d{4}年\d{1,2}月\d{1,2}日/.test(line) ||
        /〔占位：YYYY年MM月DD日〕/.test(line),
    )

    const missing: string[] = []
    if (!hasTitle) missing.push('标题')
    if (!hasAddressee) missing.push('主送')
    if (!hasSignature) missing.push('落款')
    if (!hasDate) missing.push('成文日期')
    setMissingElements(missing)
  }

  const checkTemplateCompleteness = (value: string) => {
    const normalized = value.trim()
    if (!normalized) {
      return ['请补充模板要求内容']
    }
    const missing: string[] = []
    const hasAddressee = /主送|各单位|各部门|各学院/.test(normalized)
    const hasSignature = /落款|署名|沈阳师范大学|某处室|某学院/.test(normalized)
    const hasDate = /成文日期|日期|YYYY年MM月DD日/.test(normalized)
    if (!hasAddressee) missing.push('主送要求')
    if (!hasSignature) missing.push('落款要求')
    if (!hasDate) missing.push('成文日期要求')
    return missing
  }

  const paperSectionSpecs = [
    { key: 'title', label: '题目', min: 18, max: 30 },
    { key: 'abstract', label: '摘要', min: 350, max: 500 },
    { key: 'keywords', label: '关键词', min: 12, max: 30 },
    { key: 'introduction', label: '引言', min: 3200, max: 3800 },
    { key: 'literature', label: '文献综述', min: 3600, max: 4400 },
    { key: 'variables', label: '变量选择与数据来源', min: 3000, max: 3400 },
    { key: 'model', label: '理论模型与研究假设', min: 2600, max: 3000 },
    { key: 'design', label: '研究设计与识别策略', min: 4000, max: 4500 },
    { key: 'results', label: '实证结果分析', min: 6200, max: 7000 },
    { key: 'robustness', label: '拓展分析/稳健性检验', min: 3200, max: 3800 },
    { key: 'conclusion', label: '结论与政策含义', min: 2000, max: 2400 },
  ]

  const buildPaperPrompt = () => {
    const templatePrefix =
      selectedPaperTemplateId === 'custom'
        ? customPaperTemplate
        : paperTemplates.find((item) => item.id === selectedPaperTemplateId)?.promptPrefix ?? ''

    const selectedSpecs = paperSectionSpecs.filter((item) => paperSections.includes(item.key))
    const sections = [
      ['题目', paperFields.title],
      ['摘要', paperFields.abstract],
      ['关键词', paperFields.keywords],
      ['引言', paperFields.introduction],
      ['文献综述', paperFields.literature],
      ['变量选择与数据来源', paperFields.variables],
      ['理论模型与研究假设', paperFields.model],
      ['研究设计与识别策略', paperFields.design],
      ['实证结果分析', paperFields.results],
      ['拓展分析/稳健性检验', paperFields.robustness],
      ['结论与政策含义', paperFields.conclusion],
    ]
      .filter(([label]) =>
        selectedSpecs.some((spec) => spec.label === label),
      )
      .filter(([, value]) => value.trim())
      .map(([label, value]) => `${label}：\n${value.trim()}`)
      .join('\n\n')

    return [
      '请根据以下材料生成经济研究风格论文草稿，要求结构完整、表述严谨。',
      `输出结构（仅限选定部分）：${selectedSpecs.map((item) => item.label).join('、')}`,
      `字数要求：${selectedSpecs
        .map((item) => `${item.label}${item.min}-${item.max}字`)
        .join('；')}。总字数目标约30000字。`,
      paperDraft ? `原始草稿材料：\n${paperDraft.trim()}` : '',
      templatePrefix,
      sections,
      paperExtraPrompt,
    ]
      .map((item) => item.trim())
      .filter(Boolean)
      .join('\n\n')
  }

  const buildPreflightItems = (value: string) => {
    if (writingMode === 'paper') {
      const items: { id: string; label: string; position: number }[] = []
      const normalized = value.replace(/\r\n/g, '\n')
      const headerPositions: Record<string, number> = {}
      paperSectionSpecs.forEach((spec) => {
        const index = normalized.indexOf(`${spec.label}\n`)
        if (index >= 0) {
          headerPositions[spec.key] = index
        }
      })
      paperSectionSpecs
        .filter((spec) => paperSections.includes(spec.key))
        .forEach((spec) => {
          if (!(spec.key in headerPositions)) {
            items.push({
              id: `missing-${spec.key}`,
              label: `缺失：${spec.label}`,
              position: 0,
            })
          }
        })
      const orderedSpecs = paperSectionSpecs.filter((spec) =>
        paperSections.includes(spec.key),
      )
      orderedSpecs.forEach((spec, idx) => {
        if (!(spec.key in headerPositions)) return
        const start = headerPositions[spec.key]
        const nextSpec = orderedSpecs.slice(idx + 1).find((s) => s.key in headerPositions)
        const end = nextSpec ? headerPositions[nextSpec.key] : normalized.length
        const body = normalized.slice(start, end).replace(`${spec.label}\n`, '')
        const count = body.replace(/\s/g, '').length
        if (count < spec.min || count > spec.max) {
          items.push({
            id: `len-${spec.key}`,
            label: `${spec.label}字数不符合（${count}字，要求${spec.min}-${spec.max}字）`,
            position: start,
          })
        }
      })
      const placeholderRegex = /〔[^〕]*占位[^〕]*〕/g
      let match: RegExpExecArray | null
      while ((match = placeholderRegex.exec(value)) !== null) {
        items.push({
          id: `placeholder-${match.index}`,
          label: `占位：${match[0]}`,
          position: match.index,
        })
      }
      return items
    }
    const lines = value.split(/\r?\n/)
    const items: { id: string; label: string; position: number }[] = []
    const titleIndex = detectTitleIndex(lines)
    if (titleIndex < 0) items.push({ id: 'title', label: '缺失：标题', position: 0 })
    const docNumberIndex = lines.findIndex((line) => /^\s*〔.*〕\s*$/.test(line.trim()))
    const addresseeIndex = lines.findIndex(
      (line) =>
        line.trim().endsWith('：') &&
        !line.trim().startsWith('附件') &&
        !line.trim().startsWith('抄送') &&
        !line.trim().startsWith('主送'),
    )
    if (addresseeIndex < 0) items.push({ id: 'addressee', label: '缺失：主送', position: 0 })
    const signatureIndex = lines.findIndex((line) =>
      /沈阳师范大学|学院|处室|〔占位/.test(line),
    )
    if (signatureIndex < 0)
      items.push({ id: 'signature', label: '缺失：落款', position: value.length })
    const dateIndex = lines.findIndex(
      (line) =>
        /\d{4}年\d{1,2}月\d{1,2}日/.test(line) ||
        /〔占位：YYYY年MM月DD日〕/.test(line),
    )
    if (dateIndex < 0) items.push({ id: 'date', label: '缺失：成文日期', position: value.length })

    if (docNumberIndex >= 0 && titleIndex >= 0 && docNumberIndex > titleIndex) {
      items.push({
        id: 'order-doc-title',
        label: '要素顺序：文号应在标题之前',
        position: value.length,
      })
    }
    if (titleIndex >= 0 && addresseeIndex >= 0 && titleIndex > addresseeIndex) {
      items.push({
        id: 'order-title-addressee',
        label: '要素顺序：标题应在主送之前',
        position: value.length,
      })
    }

    const placeholderRegex = /〔[^〕]*占位[^〕]*〕/g
    let match: RegExpExecArray | null
    while ((match = placeholderRegex.exec(value)) !== null) {
      const text = match[0]
      let kind = '占位'
      if (/文号|发文/.test(text)) kind = '文号'
      else if (/日期|YYYY/.test(text)) kind = '日期'
      else if (/主送/.test(text)) kind = '主送'
      else if (/落款|署名/.test(text)) kind = '落款'
      else if (/附件/.test(text)) kind = '附件'
      items.push({
        id: `placeholder-${match.index}`,
        label: `${kind}占位：${text}`,
        position: match.index,
      })
    }

    return items
  }

  const jumpToPosition = (position: number) => {
    if (!contentRef.current) return
    contentRef.current.focus()
    const safePos = Math.max(0, Math.min(position, content.length))
    contentRef.current.setSelectionRange(safePos, safePos)
  }

  const pushHistory = (next: string) => {
    const trimmed = next.trim()
    if (!trimmed) return
    const now = Date.now()
    const shouldAppend = now - lastHistoryTimeRef.current > 800
    lastHistoryTimeRef.current = now

    if (writingMode === 'gov') {
      setGovHistory((prev) => {
        const current = prev[govHistoryIndex] ?? ''
        if (current === next) return prev
        const base = prev.slice(0, govHistoryIndex + 1)
        const updated = shouldAppend ? [...base, next] : [...base.slice(0, -1), next]
        setGovHistoryIndex(updated.length - 1)
        return updated
      })
      return
    }

    setPaperHistory((prev) => {
      const current = prev[paperHistoryIndex] ?? ''
      if (current === next) return prev
      const base = prev.slice(0, paperHistoryIndex + 1)
      const updated = shouldAppend ? [...base, next] : [...base.slice(0, -1), next]
      setPaperHistoryIndex(updated.length - 1)
      return updated
    })
  }

  const handleUndo = () => {
    if (writingMode === 'gov') {
      setGovHistoryIndex((index) => {
        if (index <= 0) return index
        const nextIndex = index - 1
        setContent(govHistory[nextIndex])
        return nextIndex
      })
      return
    }
    setPaperHistoryIndex((index) => {
      if (index <= 0) return index
      const nextIndex = index - 1
      setContent(paperHistory[nextIndex])
      return nextIndex
    })
  }

  const handleRedo = () => {
    if (writingMode === 'gov') {
      setGovHistoryIndex((index) => {
        if (index >= govHistory.length - 1) return index
        const nextIndex = index + 1
        setContent(govHistory[nextIndex])
        return nextIndex
      })
      return
    }
    setPaperHistoryIndex((index) => {
      if (index >= paperHistory.length - 1) return index
      const nextIndex = index + 1
      setContent(paperHistory[nextIndex])
      return nextIndex
    })
  }

  const pushVersion = (nextContent: string) => {
    const now = new Date()
    const time = now.toLocaleString('zh-CN', { hour12: false })
    if (writingMode === 'gov') {
      setGovVersions((prev) => [
        {
          id: `gov-${now.getTime()}-${prev.length + 1}`,
          label: `版本 ${prev.length + 1}`,
          content: nextContent,
          time,
        },
        ...prev,
      ])
      return
    }
    setPaperVersions((prev) => [
      {
        id: `paper-${now.getTime()}-${prev.length + 1}`,
        label: `版本 ${prev.length + 1}`,
        content: nextContent,
        time,
      },
      ...prev,
    ])
  }

  const viewVersion = (versionContent: string) => {
    setContent(versionContent)
    pushHistory(versionContent)
  }

  const twipFromMm = (mm: number) => Math.round((mm / 25.4) * 1440)
  const twipFromPt = (pt: number) => Math.round(pt * 20)

  const baseFont = {
    ascii: 'Times New Roman',
    hAnsi: 'Times New Roman',
    eastAsia: 'FangSong',
  }
  const songFont = {
    ascii: 'Times New Roman',
    hAnsi: 'Times New Roman',
    eastAsia: 'SimSun',
  }
  const heiFont = {
    ascii: 'Times New Roman',
    hAnsi: 'Times New Roman',
    eastAsia: 'SimHei',
  }

  const detectTitleIndex = (lines: string[]) => {
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].trim()
      if (!line) continue
      if (/文件$/.test(line) && line.length <= 12) continue
      if (/^\s*〔.*〕\s*$/.test(line)) continue
      if (line.length <= 30 && /通知|报告|请示|总结/.test(line)) {
        return i
      }
    }
    return -1
  }

  const buildGovMarkdown = (text: string) => {
    const lines = text.split(/\r?\n/)
    const titleIndex = detectTitleIndex(lines)
    const nonEmpty = lines
      .map((line, index) => ({ line, index }))
      .filter((item) => item.line.trim() !== '')
    const lastIndex = nonEmpty.length ? nonEmpty[nonEmpty.length - 1].index : -1
    const secondLastIndex =
      nonEmpty.length > 1 ? nonEmpty[nonEmpty.length - 2].index : -1

    const mdLines: string[] = []

    lines.forEach((rawLine, index) => {
      const line = rawLine.trim()
      if (!line) {
        mdLines.push('')
        return
      }

      if (/文件$/.test(line) && line.length <= 12) {
        mdLines.push(`<doch>${line}</doch>`)
        return
      }

      if (/^\s*〔.*〕\s*$/.test(line)) {
        mdLines.push(`<docsh>${line}</docsh>`)
        return
      }

      if (index === titleIndex) {
        mdLines.push(`# ${line}`)
        return
      }

      if (index === lastIndex || index === secondLastIndex) {
        mdLines.push(`<sign>${line}</sign>`)
        return
      }

      if (line.startsWith('抄送') || line.startsWith('主送')) {
        mdLines.push(`<post>${line}</post>`)
        return
      }

      if (line.startsWith('印发') || line.endsWith('印发')) {
        mdLines.push(`<print>${line}</print>`)
        return
      }

      if (/^附件[:：]/.test(line)) {
        mdLines.push(`<attach>${line}</attach>`)
        return
      }

      if (line.endsWith('：')) {
        mdLines.push(`<apl>${line}</apl>`)
        return
      }

      if (/^[一二三四五六七八九十]+、/.test(line)) {
        mdLines.push(`<ih3>${line}</ih3>`)
        return
      }

      mdLines.push(line)
    })

    return mdLines.join('\n')
  }

  const splitNotes = (text: string) => {
    const parts: { text: string; isNote: boolean }[] = []
    const regex = /<note>(.*?)<\/note>/g
    let lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: text.slice(lastIndex, match.index), isNote: false })
      }
      parts.push({ text: match[1], isNote: true })
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex), isNote: false })
    }
    return parts
  }

  const createRunsWithPlaceholders = (
    text: string,
    font: { ascii: string; hAnsi: string; eastAsia: string },
    size: number,
    bold = false,
  ) => {
    const segments = text.split(/(〔.*?〕)/g).filter((segment) => segment !== '')
    return segments.map((segment) => {
      const isPlaceholder = /占位|YYYY|MM|DD/.test(segment)
      return new TextRun({
        text: segment,
        font,
        size,
        bold,
        highlight: isPlaceholder ? 'yellow' : undefined,
      })
    })
  }

  const buildDocxParagraphs = (markdown: string) => {
    const lines = markdown.split(/\r?\n/)
    const paragraphs: Paragraph[] = []
    let postSectionStarted = false

    const baseParagraphSpacing = {
      line: twipFromPt(29),
      lineRule: LineRuleType.EXACT,
      before: 0,
      after: 0,
    }

    const pushBlank = () => {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: '', font: baseFont, size: 32 })],
          spacing: baseParagraphSpacing,
        }),
      )
    }

    const lineParagraph = (size: number) =>
      new Paragraph({
        border: {
          bottom: { color: '000000', size, space: 1, style: BorderStyle.SINGLE },
        },
        spacing: { before: 0, after: 0, line: twipFromPt(5), lineRule: LineRuleType.EXACT },
      })

    lines.forEach((rawLine) => {
      const line = rawLine.trim()

      if (!line) {
        pushBlank()
        return
      }

      if (line.startsWith('<doch>') && line.endsWith('</doch>')) {
        const text = line.replace(/^<doch>/, '').replace(/<\/doch>$/, '')
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: baseParagraphSpacing,
            children: createRunsWithPlaceholders(text, songFont, 32, true),
          }),
        )
        return
      }

      if (line.startsWith('<docsh>') && line.endsWith('</docsh>')) {
        const text = line.replace(/^<docsh>/, '').replace(/<\/docsh>$/, '')
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: baseParagraphSpacing,
            children: createRunsWithPlaceholders(text, baseFont, 32),
          }),
        )
        paragraphs.push(
          new Paragraph({
            border: {
              bottom: { color: 'C00000', size: 12, space: 1, style: BorderStyle.SINGLE },
            },
            spacing: { before: twipFromPt(4), after: twipFromPt(6) },
          }),
        )
        return
      }

      if (line.startsWith('# ')) {
        const text = line.slice(2)
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { ...baseParagraphSpacing, before: twipFromPt(12), after: twipFromPt(8) },
            children: createRunsWithPlaceholders(text, songFont, 44, true),
          }),
        )
        return
      }

      if (line.startsWith('<apl>') && line.endsWith('</apl>')) {
        const text = line.replace(/^<apl>/, '').replace(/<\/apl>$/, '')
        paragraphs.push(
          new Paragraph({
            spacing: baseParagraphSpacing,
            children: createRunsWithPlaceholders(text, baseFont, 32),
          }),
        )
        return
      }

      if (line.startsWith('<ih3>') && line.endsWith('</ih3>')) {
        const text = line.replace(/^<ih3>/, '').replace(/<\/ih3>$/, '')
        paragraphs.push(
          new Paragraph({
            spacing: baseParagraphSpacing,
            indent: { firstLine: twipFromPt(32) },
            children: createRunsWithPlaceholders(text, heiFont, 32, true),
          }),
        )
        return
      }

      if (line.startsWith('<sign>') && line.endsWith('</sign>')) {
        const text = line.replace(/^<sign>/, '').replace(/<\/sign>$/, '')
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { ...baseParagraphSpacing, before: twipFromPt(6) },
            children: createRunsWithPlaceholders(text, baseFont, 32),
          }),
        )
        return
      }

      if (line.startsWith('<attach>') && line.endsWith('</attach>')) {
        const text = line.replace(/^<attach>/, '').replace(/<\/attach>$/, '')
        const isAttachment = text.startsWith('附件')
        paragraphs.push(
          new Paragraph({
            spacing: { ...baseParagraphSpacing, before: twipFromPt(6) },
            indent: { firstLine: twipFromPt(32) },
            children: createRunsWithPlaceholders(text, baseFont, 32, isAttachment),
          }),
        )
        return
      }

      if (line.startsWith('<post>') && line.endsWith('</post>')) {
        const text = line.replace(/^<post>/, '').replace(/<\/post>$/, '')
        if (!postSectionStarted) {
          paragraphs.push(lineParagraph(8))
          postSectionStarted = true
        }
        paragraphs.push(
          new Paragraph({
            spacing: baseParagraphSpacing,
            indent: { firstLine: twipFromPt(28) },
            children: createRunsWithPlaceholders(text, baseFont, 28),
          }),
        )
        return
      }

      if (line.startsWith('<print>') && line.endsWith('</print>')) {
        const text = line.replace(/^<print>/, '').replace(/<\/print>$/, '')
        if (!postSectionStarted) {
          paragraphs.push(lineParagraph(8))
          postSectionStarted = true
        } else {
          paragraphs.push(lineParagraph(4))
        }
        paragraphs.push(
          new Paragraph({
            spacing: baseParagraphSpacing,
            indent: { firstLine: twipFromPt(28) },
            children: createRunsWithPlaceholders(text, baseFont, 28),
          }),
        )
        paragraphs.push(lineParagraph(8))
        return
      }

      const parts = splitNotes(line)
      const runs = parts.flatMap((part) => {
        if (!part.text) return []
        return createRunsWithPlaceholders(
          part.text,
          baseFont,
          part.isNote ? 24 : 32,
        )
      })

      paragraphs.push(
        new Paragraph({
          spacing: baseParagraphSpacing,
          indent: { firstLine: twipFromPt(32) },
          children: runs,
        }),
      )
    })

    return paragraphs
  }

  const buildGovDocx = (text: string, strict: boolean) => {
    const markdown = buildGovMarkdown(text)
    const children = buildDocxParagraphs(markdown)

    const footerDefault = new Footer({
      children: [
        new Paragraph({
          alignment: strict ? AlignmentType.RIGHT : AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({ text: '—', font: songFont, size: 28 }),
            new TextRun({ children: [PageNumber.CURRENT], font: songFont, size: 28 }),
            new TextRun({ text: '—', font: songFont, size: 28 }),
          ],
        }),
      ],
    })
    const footerEven = new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({ text: '—', font: songFont, size: 28 }),
            new TextRun({ children: [PageNumber.CURRENT], font: songFont, size: 28 }),
            new TextRun({ text: '—', font: songFont, size: 28 }),
          ],
        }),
      ],
    })

    return new DocxDocument({
      evenAndOddHeaderAndFooters: strict,
      sections: [
        {
          properties: {
            page: {
              size: {
                width: twipFromMm(210),
                height: twipFromMm(297),
              },
              margin: {
                top: twipFromMm(37),
                left: twipFromMm(28),
                right: twipFromMm(26),
                bottom: twipFromMm(35),
                header: twipFromMm(15),
                footer: twipFromMm(15),
              },
            },
            grid: {
              type: DocumentGridType.LINES,
              linePitch: twipFromPt(29),
            },
          },
          footers: {
            default: footerDefault,
            even: strict ? footerEven : undefined,
          },
          children,
        },
      ],
    })
  }

  const doExportMarkdown = () => {
    if (!content.trim()) return
    const markdown = buildGovMarkdown(content)
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const textLines = content.split(/\r?\n/)
    const titleIndex = detectTitleIndex(textLines)
    const titleLine =
      (titleIndex >= 0 ? textLines[titleIndex].trim() : '') ||
      textLines.map((line) => line.trim()).find((line) => line.length > 0) ||
      '公文'
    const filename = `${titleLine.replace(/[\\/:*?"<>|]/g, '').slice(0, 40) || '公文'}.md`

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const doExportDocx = async () => {
    if (!content.trim()) return
    const doc = buildGovDocx(normalizeContent(content), strictLayout)
    const blob = await Packer.toBlob(doc)
    const url = URL.createObjectURL(blob)

    const textLines = content.split(/\r?\n/)
    const titleIndex = detectTitleIndex(textLines)
    const titleLine =
      (titleIndex >= 0 ? textLines[titleIndex].trim() : '') ||
      textLines.map((line) => line.trim()).find((line) => line.length > 0) ||
      '公文'
    const filename = `${titleLine.replace(/[\\/:*?"<>|]/g, '').slice(0, 40) || '公文'}.docx`

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const downloadMarkdown = () => {
    if (!content.trim()) return
    const issues = buildPreflightItems(content)
    if (issues.length > 0) {
      setPreflightItems(issues)
      setShowPreflight(true)
      setPendingExport('md')
      return
    }
    doExportMarkdown()
  }

  const downloadDocx = async () => {
    if (!content.trim()) return
    const issues = buildPreflightItems(content)
    if (issues.length > 0) {
      setPreflightItems(issues)
      setShowPreflight(true)
      setPendingExport('docx')
      return
    }
    await doExportDocx()
  }

  useEffect(() => {
    const type = searchParams.get('type')
    if (type) {
      setSelectedType(type)
    }
  }, [searchParams])

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsMac(/Mac|iPhone|iPad/.test(navigator.platform))
    }
  }, [])

  useEffect(() => {
    if (selectedTemplateId !== 'custom') {
      setTemplateWarning(null)
    }
  }, [selectedTemplateId])

  useEffect(() => {
    setTemplateWarning(null)
  }, [writingMode])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('customTemplate')
      if (stored) {
        setCustomTemplate(stored)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('customPaperTemplate')
      if (stored) {
        setCustomPaperTemplate(stored)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('customTemplate', customTemplate)
    }
  }, [customTemplate])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('customPaperTemplate', customPaperTemplate)
    }
  }, [customPaperTemplate])

  useEffect(() => {
    if (!content.trim()) return
    if (writingMode === 'gov' && govHistory.length === 0) {
      setGovHistory([content])
      setGovHistoryIndex(0)
    }
    if (writingMode === 'paper' && paperHistory.length === 0) {
      setPaperHistory([content])
      setPaperHistoryIndex(0)
    }
  }, [content, writingMode, govHistory.length, paperHistory.length])

  useEffect(() => {
    if (content.trim()) {
      evaluateMissingElements(content)
    } else {
      setMissingElements([])
    }
  }, [content])

  useEffect(() => {
    if (writingMode === 'gov') {
      setContent(govContent)
    } else {
      setContent(paperContent)
    }
    setSelection({ start: 0, end: 0 })
  }, [writingMode, govContent, paperContent])

  useEffect(() => {
    if (writingMode === 'gov') {
      setGovContent(content)
    } else {
      setPaperContent(content)
    }
  }, [content, writingMode])

  const generateDocument = async () => {
    if (writingMode === 'gov' && !selectedType) return

    setIsGenerating(true)
    try {
      if (writingMode === 'gov' && selectedTemplateId === 'custom') {
        const missing = checkTemplateCompleteness(customTemplate)
        if (missing.length > 0) {
          setTemplateWarning(`模板要求缺少：${missing.join('、')}`)
          setIsGenerating(false)
          return
        }
      }
      setTemplateWarning(null)
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: writingMode === 'paper' ? 'paper' : selectedType,
          prompt:
            writingMode === 'paper'
              ? buildPaperPrompt()
              : [
                  selectedTemplateId === 'custom' ? customTemplate : '',
                  templateOptions.find((item) => item.id === selectedTemplateId)?.promptPrefix ??
                    '',
                  govPrompt,
                ]
                  .map((item) => item.trim())
                  .filter(Boolean)
                  .join('\n'),
        }),
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }

      const normalized = normalizeContent(data.content)
      const withDates = applyDatePlaceholders(normalized, govPrompt)
      setContent(withDates)
      pushHistory(withDates)
      pushVersion(withDates)
      evaluateMissingElements(withDates)
    } catch (error) {
      console.error('Error generating document:', error)
      setContent('生成文档时发生错误，请稍后重试。')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSelect = () => {
    if (!contentRef.current) return
    const start = contentRef.current.selectionStart ?? 0
    const end = contentRef.current.selectionEnd ?? 0
    setSelection({ start, end })
  }

  const handlePolishShortcut = (event: ReactKeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      applySelectionEdit()
    }
  }

  const applySelectionEdit = async () => {
    if (!contentRef.current) return
    const { start, end } = selection
    if (start === end) return
    const selectedText = content.slice(start, end)
    if (!selectedText.trim() || !editPrompt.trim()) return

    setIsPolishing(true)
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: writingMode === 'paper' ? 'paper' : selectedType,
          prompt: `请仅对以下选中文本进行润色/替换，保持原有段落结构与格式，不要输出其他内容。\n修改要求：${editPrompt}\n\n选中文本：\n${selectedText}`,
        }),
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }

      const replacement = normalizeContent(String(data.content ?? '').trim())
      if (!replacement) return
      const next = `${content.slice(0, start)}${replacement}${content.slice(end)}`
      setContent(next)
      pushHistory(next)
      evaluateMissingElements(next)
    } catch (error) {
      console.error('Error polishing selection:', error)
    } finally {
      setIsPolishing(false)
    }
  }

  const preflightIssues = content.trim() ? buildPreflightItems(content) : []
  const handleContinueExport = async () => {
    if (pendingExport === 'md') {
      doExportMarkdown()
    }
    if (pendingExport === 'docx') {
      await doExportDocx()
    }
    setShowPreflight(false)
    setPendingExport(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50 to-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="inline-flex items-center rounded-full bg-white/70 px-4 py-1 text-sm text-blue-700 shadow-sm">
            沈阳师范大学公文写作助手
          </div>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">公文写作</h1>
          <p className="mt-2 text-gray-600">选择文档类型，AI将帮您生成专业公文</p>
        </div>

        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm">
            <div className="flex gap-2">
              {[
                { id: 'gov', label: '公文模式' },
                { id: 'paper', label: '论文模式' },
              ].map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setWritingMode(mode.id as 'gov' | 'paper')}
                  className={`rounded-full px-4 py-2 text-sm ${
                    writingMode === mode.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <div className="text-sm text-slate-500">
              {writingMode === 'gov'
                ? '适用于学校公文与通知类文稿'
                : '适用于经济研究风格论文写作'}
            </div>
          </div>
        </div>

        {writingMode === 'gov' && (
          <div className="mt-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {documentTypes.map((type) => (
                <div
                  key={type.id}
                  className={`relative rounded-xl border bg-white/80 p-6 shadow-sm cursor-pointer transition-colors ${
                    selectedType === type.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => setSelectedType(type.id)}
                >
                  <h3 className="mt-4 text-lg font-medium text-gray-900">{type.name}</h3>
                  <p className="mt-2 text-sm text-gray-500">{type.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          <div className="bg-white/90 shadow-lg rounded-2xl p-6 border border-slate-100">
            <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
              <div className="space-y-4">
                {writingMode === 'gov' && (
                  <>
                    <div>
                      <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">
                        写作提示（可选）
                      </label>
                      <textarea
                        id="prompt"
                        rows={6}
                        className="mt-1 block w-full rounded-lg border-gray-200 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="请输入写作提示，例如：关于召开年度总结会议的通知"
                        value={govPrompt}
                        onChange={(e) => setGovPrompt(e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700">模板与规范</div>
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="mt-2 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        {templateOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                      <div className="mt-2 text-xs text-slate-500">
                        {templateOptions.find((item) => item.id === selectedTemplateId)?.description}
                      </div>
                      {selectedTemplateId === 'custom' && (
                        <textarea
                          rows={5}
                          className="mt-3 block w-full rounded-lg border-gray-200 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          placeholder="输入学院/部门专用模板要求，例如：固定主送、固定落款、常用条款结构等"
                          value={customTemplate}
                          onChange={(e) => setCustomTemplate(e.target.value)}
                        />
                      )}
                    </div>
                    {templateWarning && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {templateWarning}
                      </div>
                    )}
                  </>
                )}
                {writingMode === 'paper' && (
                  <>
                    <div>
                      <label htmlFor="paperDraft" className="block text-sm font-medium text-gray-700">
                        草稿材料（可选）
                      </label>
                      <textarea
                        id="paperDraft"
                        rows={4}
                        className="mt-1 block w-full rounded-lg border-gray-200 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="粘贴你的原始草稿、变量描述、模型思路等材料"
                        value={paperDraft}
                        onChange={(e) => setPaperDraft(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="paperTitle" className="block text-sm font-medium text-gray-700">
                        论文题目
                      </label>
                      <input
                        id="paperTitle"
                        className="mt-1 block w-full rounded-lg border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="请输入论文题目或研究主题"
                        value={paperFields.title}
                        onChange={(e) =>
                          setPaperFields((prev) => ({ ...prev, title: e.target.value }))
                        }
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPaperFields(samplePaperFields)}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-blue-300 hover:text-blue-700"
                      >
                        填充示例
                      </button>
                      <span className="text-xs text-slate-500">
                        点击可查看完整论文结构示例
                      </span>
                    </div>
                    <div className="grid gap-3">
                      <div>
                        <label htmlFor="paperAbstract" className="block text-sm font-medium text-gray-700">
                          摘要材料
                        </label>
                        <textarea
                          id="paperAbstract"
                          rows={3}
                          className="mt-1 block w-full rounded-lg border-gray-200 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          placeholder="研究背景、核心问题、方法与结论"
                          value={paperFields.abstract}
                          onChange={(e) =>
                            setPaperFields((prev) => ({ ...prev, abstract: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <label htmlFor="paperKeywords" className="block text-sm font-medium text-gray-700">
                          关键词
                        </label>
                        <input
                          id="paperKeywords"
                          className="mt-1 block w-full rounded-lg border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          placeholder="如：政策评估、双重差分、产业升级"
                          value={paperFields.keywords}
                          onChange={(e) =>
                            setPaperFields((prev) => ({ ...prev, keywords: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700">论文模板</div>
                      <select
                        value={selectedPaperTemplateId}
                        onChange={(e) => setSelectedPaperTemplateId(e.target.value)}
                        className="mt-2 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        {paperTemplates.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                      <div className="mt-2 text-xs text-slate-500">
                        {paperTemplates.find((item) => item.id === selectedPaperTemplateId)
                          ?.description}
                      </div>
                      {selectedPaperTemplateId === 'custom' && (
                        <textarea
                          rows={4}
                          className="mt-3 block w-full rounded-lg border-gray-200 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          placeholder="输入你偏好的论文风格要求"
                          value={customPaperTemplate}
                          onChange={(e) => setCustomPaperTemplate(e.target.value)}
                        />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700">输出部分选择</div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {paperSectionSpecs.map((spec) => (
                          <label
                            key={spec.key}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                          >
                            <input
                              type="checkbox"
                              checked={paperSections.includes(spec.key)}
                              onChange={(e) => {
                                setPaperSections((prev) =>
                                  e.target.checked
                                    ? [...prev, spec.key]
                                    : prev.filter((item) => item !== spec.key),
                                )
                              }}
                            />
                            {spec.label}
                          </label>
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        未选择的部分不会生成；字数范围按经济研究期刊风格控制。
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[
                        { key: 'introduction', label: '引言材料' },
                        { key: 'literature', label: '文献综述要点' },
                        { key: 'variables', label: '变量选择与数据' },
                        { key: 'model', label: '理论模型与机制' },
                        { key: 'design', label: '研究设计与识别策略' },
                        { key: 'results', label: '实证结果分析' },
                        { key: 'robustness', label: '拓展与稳健性' },
                        { key: 'conclusion', label: '结论与政策含义' },
                      ].map((item) => (
                        <div key={item.key}>
                          <label className="block text-sm font-medium text-gray-700">
                            {item.label}
                          </label>
                          <textarea
                            rows={3}
                            className="mt-1 block w-full rounded-lg border-gray-200 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            placeholder={`输入${item.label}材料`}
                            value={paperFields[item.key as keyof typeof paperFields]}
                            onChange={(e) =>
                              setPaperFields((prev) => ({
                                ...prev,
                                [item.key]: e.target.value,
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <div>
                      <label htmlFor="paperExtraPrompt" className="block text-sm font-medium text-gray-700">
                        额外写作要求
                      </label>
                      <textarea
                        id="paperExtraPrompt"
                        rows={3}
                        className="mt-1 block w-full rounded-lg border-gray-200 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="例如：强调识别策略，避免夸大因果"
                        value={paperExtraPrompt}
                        onChange={(e) => setPaperExtraPrompt(e.target.value)}
                      />
                    </div>
                  </>
                )}
                <button
                  onClick={generateDocument}
                  disabled={(writingMode === 'gov' && !selectedType) || isGenerating}
                  className={`w-full px-4 py-2 rounded-md text-white ${
                    (writingMode === 'gov' && !selectedType) || isGenerating
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isGenerating ? '生成中...' : '生成文档'}
                </button>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs text-slate-600">
                  左侧填写提示词，右侧实时编辑输出内容。导出前会进行要素预检。
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-medium text-gray-900">文档内容</h2>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={downloadMarkdown}
                      disabled={!content.trim() || isGenerating}
                      className={`px-4 py-2 rounded-md text-white ${
                        !content.trim() || isGenerating
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-slate-600 hover:bg-slate-700'
                      }`}
                    >
                      下载Markdown
                    </button>
                    <button
                      onClick={downloadDocx}
                      disabled={!content.trim() || isGenerating}
                      className={`px-4 py-2 rounded-md text-white ${
                        !content.trim() || isGenerating
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      下载Word(.docx)
                    </button>
                    {preflightIssues.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPreflightItems(preflightIssues)
                          setShowPreflight(true)
                          setPendingExport(null)
                        }}
                        className="px-4 py-2 rounded-md border border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300"
                      >
                        预检 {preflightIssues.length} 项
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  ref={contentRef}
                  value={content}
                  onChange={(e) => {
                    const next = e.target.value
                    setContent(next)
                    pushHistory(next)
                    evaluateMissingElements(next)
                  }}
                  onSelect={handleSelect}
                  onKeyDown={handlePolishShortcut}
                  rows={16}
                  placeholder="选择文档类型后点击生成按钮开始写作"
                  className="w-full min-h-[360px] rounded-xl border border-slate-200 bg-slate-50/80 p-4 font-serif text-[15px] leading-7 text-slate-900 shadow-inner focus:border-blue-500 focus:ring-blue-500 whitespace-pre-wrap"
                />
                <div className="text-xs text-slate-500">
                  提示：先在正文中选中要修改的内容，再输入润色指令，按 Cmd/Ctrl + Enter 或点击按钮生效。
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white/70 px-3 py-2 text-sm text-slate-600">
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={strictLayout}
                        onChange={(e) => setStrictLayout(e.target.checked)}
                      />
                      严格页码对齐（奇偶页）
                    </label>
                    {missingElements.length > 0 && (
                      <span className="text-amber-700">
                        缺失要素：{missingElements.join('、')}
                      </span>
                    )}
                    {missingElements.length === 0 && content.trim() && (
                      <span className="text-emerald-700">要素完整</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={
                        writingMode === 'gov'
                          ? govHistoryIndex <= 0
                          : paperHistoryIndex <= 0
                      }
                      className={`rounded-md px-3 py-1 text-xs ${
                        (writingMode === 'gov'
                          ? govHistoryIndex <= 0
                          : paperHistoryIndex <= 0)
                          ? 'bg-gray-200 text-gray-500'
                          : 'bg-slate-800 text-white hover:bg-slate-900'
                      }`}
                    >
                      撤销
                    </button>
                    <button
                      type="button"
                      onClick={handleRedo}
                      disabled={
                        writingMode === 'gov'
                          ? govHistoryIndex >= govHistory.length - 1
                          : paperHistoryIndex >= paperHistory.length - 1
                      }
                      className={`rounded-md px-3 py-1 text-xs ${
                        (writingMode === 'gov'
                          ? govHistoryIndex >= govHistory.length - 1
                          : paperHistoryIndex >= paperHistory.length - 1)
                          ? 'bg-gray-200 text-gray-500'
                          : 'bg-slate-800 text-white hover:bg-slate-900'
                      }`}
                    >
                      还原
                    </button>
                  <button
                    type="button"
                    onClick={generateDocument}
                    disabled={(writingMode === 'gov' && !selectedType) || isGenerating}
                    className={`rounded-md px-3 py-1 text-xs ${
                      (writingMode === 'gov' && !selectedType) || isGenerating
                        ? 'bg-gray-200 text-gray-500'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    重新生成
                  </button>
                </div>
              </div>
              {(writingMode === 'gov' ? govVersions.length > 0 : paperVersions.length > 0) && (
                <div className="rounded-xl border border-slate-100 bg-white/80 p-3 text-xs text-slate-600">
                  <div className="mb-2 font-medium text-slate-700">版本历史</div>
                  <div className="flex flex-col gap-2">
                    {(writingMode === 'gov' ? govVersions : paperVersions)
                      .slice(0, 6)
                      .map((version) => (
                      <div
                        key={version.id}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span>
                          {version.label} · {version.time}
                        </span>
                        <button
                          type="button"
                          onClick={() => viewVersion(version.content)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:border-blue-300 hover:text-blue-700"
                        >
                          查看
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
                <div>
                  <label htmlFor="editPrompt" className="block text-sm font-medium text-gray-700">
                    选中内容润色/替换指令
                  </label>
                  <input
                    id="editPrompt"
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    onKeyDown={handlePolishShortcut}
                    placeholder="例如：更正式、更简洁，保留政策语气"
                    className="mt-1 block w-full rounded-lg border-gray-200 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      '改写为条款',
                      '拆分段落',
                      '补充要素（时间/地点/对象/责任）',
                      '更正式',
                      '更精简',
                      '改为执行性表述',
                    ].map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setEditPrompt(label)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-blue-300 hover:text-blue-700"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-end">
                  <div className="w-full space-y-2 text-right">
                    <button
                      onClick={applySelectionEdit}
                      disabled={
                        isPolishing ||
                        selection.start === selection.end ||
                        !editPrompt.trim() ||
                        !content.trim()
                      }
                      className={`w-full rounded-md px-4 py-2 text-white ${
                        isPolishing ||
                        selection.start === selection.end ||
                        !editPrompt.trim() ||
                        !content.trim()
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {isPolishing ? '润色中...' : '润色选中内容'}
                    </button>
                    <div className="text-xs text-slate-500">
                      快捷键：{isMac ? 'Command' : 'Ctrl'} + Enter
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
      {showPreflight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">导出前预检</div>
                <div className="text-xs text-slate-500">
                  发现以下问题，仍可继续导出并自行编辑
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPreflight(false)}
                className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-600 hover:border-slate-300"
              >
                关闭
              </button>
            </div>
            <div className="max-h-[55vh] space-y-2 overflow-auto px-5 py-4">
              {preflightItems.length === 0 && (
                <div className="text-sm text-slate-600">未发现问题。</div>
              )}
              {preflightItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                >
                  <span>{item.label}</span>
                  <button
                    type="button"
                    onClick={() => jumpToPosition(item.position)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-blue-300 hover:text-blue-700"
                  >
                    跳转定位
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={handleContinueExport}
                disabled={!pendingExport}
                className={`rounded-md border px-4 py-2 text-sm ${
                  !pendingExport
                    ? 'border-gray-200 bg-gray-100 text-gray-500'
                    : 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300'
                }`}
              >
                继续导出
              </button>
              <button
                type="button"
                onClick={() => setShowPreflight(false)}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
              >
                稍后处理
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 
