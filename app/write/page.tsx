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
  const [prompt, setPrompt] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const [isPolishing, setIsPolishing] = useState(false)
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const contentRef = useRef<HTMLTextAreaElement | null>(null)
  const [isMac, setIsMac] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [versions, setVersions] = useState<
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

  const buildPreflightItems = (value: string) => {
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
      items.push({
        id: `placeholder-${match.index}`,
        label: `占位：${match[0]}`,
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
    setHistory((prev) => {
      const trimmed = next.trim()
      if (!trimmed) return prev
      const current = prev[historyIndex] ?? ''
      if (current === next) return prev
      const now = Date.now()
      const shouldAppend = now - lastHistoryTimeRef.current > 800
      lastHistoryTimeRef.current = now
      const base = prev.slice(0, historyIndex + 1)
      const updated = shouldAppend ? [...base, next] : [...base.slice(0, -1), next]
      setHistoryIndex(updated.length - 1)
      return updated
    })
  }

  const handleUndo = () => {
    setHistoryIndex((index) => {
      if (index <= 0) return index
      const nextIndex = index - 1
      setContent(history[nextIndex])
      return nextIndex
    })
  }

  const handleRedo = () => {
    setHistoryIndex((index) => {
      if (index >= history.length - 1) return index
      const nextIndex = index + 1
      setContent(history[nextIndex])
      return nextIndex
    })
  }

  const pushVersion = (nextContent: string) => {
    const now = new Date()
    const time = now.toLocaleString('zh-CN', { hour12: false })
    setVersions((prev) => [
      {
        id: `${now.getTime()}-${prev.length + 1}`,
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
    if (content.trim() && history.length === 0) {
      setHistory([content])
      setHistoryIndex(0)
    }
  }, [content, history.length])

  useEffect(() => {
    if (content.trim()) {
      evaluateMissingElements(content)
    } else {
      setMissingElements([])
    }
  }, [content])

  const generateDocument = async () => {
    if (!selectedType) return

    setIsGenerating(true)
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: selectedType,
          prompt: prompt,
        }),
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }

      const normalized = normalizeContent(data.content)
      const withDates = applyDatePlaceholders(normalized, prompt)
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
          type: selectedType,
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

        <div className="mt-8">
          <div className="bg-white/90 shadow-lg rounded-2xl p-6 border border-slate-100">
            <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
              <div className="space-y-4">
                <div>
                  <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">
                    写作提示（可选）
                  </label>
                  <textarea
                    id="prompt"
                    rows={8}
                    className="mt-1 block w-full rounded-lg border-gray-200 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="请输入写作提示，例如：关于召开年度总结会议的通知"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                </div>
                <button
                  onClick={generateDocument}
                  disabled={!selectedType || isGenerating}
                  className={`w-full px-4 py-2 rounded-md text-white ${
                    !selectedType || isGenerating
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
                      disabled={historyIndex <= 0}
                      className={`rounded-md px-3 py-1 text-xs ${
                        historyIndex <= 0
                          ? 'bg-gray-200 text-gray-500'
                          : 'bg-slate-800 text-white hover:bg-slate-900'
                      }`}
                    >
                      撤销
                    </button>
                    <button
                      type="button"
                      onClick={handleRedo}
                      disabled={historyIndex >= history.length - 1}
                      className={`rounded-md px-3 py-1 text-xs ${
                        historyIndex >= history.length - 1
                          ? 'bg-gray-200 text-gray-500'
                          : 'bg-slate-800 text-white hover:bg-slate-900'
                      }`}
                    >
                      还原
                    </button>
                  <button
                    type="button"
                    onClick={generateDocument}
                    disabled={!selectedType || isGenerating}
                    className={`rounded-md px-3 py-1 text-xs ${
                      !selectedType || isGenerating
                        ? 'bg-gray-200 text-gray-500'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    重新生成
                  </button>
                </div>
              </div>
              {versions.length > 0 && (
                <div className="rounded-xl border border-slate-100 bg-white/80 p-3 text-xs text-slate-600">
                  <div className="mb-2 font-medium text-slate-700">版本历史</div>
                  <div className="flex flex-col gap-2">
                    {versions.slice(0, 6).map((version) => (
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
