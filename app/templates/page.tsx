import Link from 'next/link'

const templates = [
  {
    id: 'notice',
    name: '通知模板',
    description: '用于发布重要事项或要求的通知模板',
    examples: ['会议通知', '活动通知', '工作安排通知'],
  },
  {
    id: 'report',
    name: '报告模板',
    description: '用于汇报工作或情况的报告模板',
    examples: ['工作总结报告', '项目进展报告', '调研报告'],
  },
  {
    id: 'request',
    name: '请示模板',
    description: '用于向上级请求指示或批准的请示模板',
    examples: ['项目审批请示', '经费申请请示', '人事变动请示'],
  },
  {
    id: 'summary',
    name: '总结模板',
    description: '用于总结工作或活动的总结模板',
    examples: ['年度工作总结', '项目总结', '活动总结'],
  },
]

export default function TemplatesPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">公文模板</h1>
          <p className="mt-2 text-gray-600">选择适合的模板，快速生成专业公文</p>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-2">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-lg shadow-lg overflow-hidden"
            >
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900">{template.name}</h3>
                <p className="mt-2 text-gray-500">{template.description}</p>
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-900">示例类型：</h4>
                  <ul className="mt-2 space-y-1">
                    {template.examples.map((example, index) => (
                      <li key={index} className="text-sm text-gray-500">
                        • {example}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-6">
                  <Link
                    href={`/write?type=${template.id}`}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    使用此模板
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 