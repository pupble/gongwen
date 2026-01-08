import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
            <span className="block">AI公文写作助手</span>
            <span className="block text-blue-600 mt-3">智能生成专业公文</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            基于先进AI技术，快速生成各类公文，包括通知、报告、请示等，让公文写作更高效、更专业。
          </p>
          <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
            <div className="rounded-md shadow">
              <Link
                href="/write"
                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10"
              >
                开始写作
              </Link>
            </div>
            <div className="mt-3 sm:mt-0 sm:ml-3">
              <Link
                href="/templates"
                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 md:py-4 md:text-lg md:px-10"
              >
                查看模板
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-20">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="relative p-6 bg-white rounded-lg shadow-lg">
              <div className="text-lg font-medium text-gray-900">智能生成</div>
              <p className="mt-2 text-gray-500">
                根据您的需求，智能生成符合规范的公文内容
              </p>
            </div>
            <div className="relative p-6 bg-white rounded-lg shadow-lg">
              <div className="text-lg font-medium text-gray-900">多种模板</div>
              <p className="mt-2 text-gray-500">
                提供多种公文模板，满足不同场景需求
              </p>
            </div>
            <div className="relative p-6 bg-white rounded-lg shadow-lg">
              <div className="text-lg font-medium text-gray-900">格式规范</div>
              <p className="mt-2 text-gray-500">
                自动遵循公文写作规范，确保格式正确
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
} 