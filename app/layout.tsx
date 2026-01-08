import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../src/app/globals.css'
import Navbar from './components/Navbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI公文写作助手',
  description: '智能生成专业公文，提高写作效率',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body className={inter.className}>
        <Navbar />
        {children}
      </body>
    </html>
  )
} 