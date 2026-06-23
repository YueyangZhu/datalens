// 主应用组件

import { useState, useCallback } from 'react'
import FileUpload from './components/FileUpload'
import DataOverview from './components/DataOverview'
import ChartDisplay from './components/ChartDisplay'
import InsightReport from './components/InsightReport'
import ColumnDetails from './components/ColumnDetails'
import { analyzeData } from './utils/dataAnalyzer'
import { saveToHistory, getHistory, formatTime, clearHistory } from './utils/history'
import { exportToPDFReport, collectChartElements } from './utils/pdfExport'
import type { DataTable, AnalysisResult, HistoryRecord } from './types'

type View = 'home' | 'analyzing' | 'result' | 'history'

export default function App() {
  const [view, setView] = useState<View>('home')
  const [error, setError] = useState<string>('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [exporting, setExporting] = useState(false)

  // 处理文件上传完成
  const handleFileLoaded = useCallback((data: DataTable) => {
    setError('')
    setView('analyzing')
    // 异步执行分析，避免阻塞UI
    setTimeout(() => {
      try {
        const analysisResult = analyzeData(data)
        setResult(analysisResult)
        saveToHistory(analysisResult)
        setView('result')
      } catch (e) {
        setError(`分析失败：${e instanceof Error ? e.message : '未知错误'}`)
        setView('home')
      }
    }, 100)
  }, [])

  const handleError = useCallback((msg: string) => {
    setError(msg)
    setTimeout(() => setError(''), 5000)
  }, [])

  // 返回首页
  const handleBack = useCallback(() => {
    setView('home')
    setResult(null)
    setError('')
  }, [])

  // 查看历史记录
  const handleViewHistory = useCallback(() => {
    setHistory(getHistory())
    setView('history')
  }, [])

  // 清空历史
  const handleClearHistory = useCallback(() => {
    if (confirm('确定要清空所有历史记录吗？此操作不可恢复。')) {
      clearHistory()
      setHistory([])
    }
  }, [])

  // 导出PDF
  const handleExportPDF = useCallback(async () => {
    if (!result) return
    setExporting(true)
    try {
      // 收集所有ECharts图表DOM元素用于截图
      const chartElements = collectChartElements()
      // 调用专业报告生成函数
      await exportToPDFReport(result, chartElements)
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e)
      let msg = raw
      if (raw.includes('drawImage') || raw.includes('width or height') || raw.includes('截图')) {
        msg = '图表截图失败，请尝试放大浏览器窗口后重试。'
      } else if (raw.includes('报告渲染失败')) {
        msg = '报告渲染失败，请刷新页面后重试。'
      } else if (raw.includes('network') || raw.includes('fetch')) {
        msg = '资源加载失败，请检查网络后重试。'
      }
      setError(`导出失败：${msg}`)
      setTimeout(() => setError(''), 5000)
    } finally {
      setExporting(false)
    }
  }, [result])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 cursor-pointer" onClick={handleBack}>
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800">DataLens</h1>
                <p className="text-xs text-slate-400 -mt-0.5">智能数据分析平台</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {view !== 'home' && (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                  </svg>
                  上传新文件
                </button>
              )}
              <button
                onClick={handleViewHistory}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                历史记录
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 错误提示 */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 fade-in">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 首页 */}
        {view === 'home' && (
          <div className="fade-in">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-slate-800 mb-3">
                上传你的数据，AI 帮你发现洞察
              </h2>
              <p className="text-slate-500 max-w-2xl mx-auto">
                支持 Excel / CSV 文件上传，自动生成可视化图表和数据分析报告，无需写一行代码
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              <FileUpload onFileLoaded={handleFileLoaded} onError={handleError} />
            </div>

            {/* 功能特性 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-5xl mx-auto">
              <div className="text-center p-6">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-slate-700 mb-1">一键上传</h3>
                <p className="text-xs text-slate-500">拖拽 Excel/CSV 文件即可上传，自动解析数据结构</p>
              </div>
              <div className="text-center p-6">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-slate-700 mb-1">智能图表</h3>
                <p className="text-xs text-slate-500">自动识别数据类型，生成最适合的可视化图表</p>
              </div>
              <div className="text-center p-6">
                <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-slate-700 mb-1">AI 洞察</h3>
                <p className="text-xs text-slate-500">自动发现数据规律，生成可执行的业务洞察报告</p>
              </div>
            </div>
          </div>
        )}

        {/* 分析中 */}
        {view === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-6" />
            <h2 className="text-xl font-semibold text-slate-700 mb-2">正在分析数据...</h2>
            <p className="text-slate-500 text-sm">AI 正在解读你的数据，生成图表和洞察报告</p>
            <div className="flex gap-2 mt-6 text-xs text-slate-400">
              <span className="animate-pulse">解析数据结构</span>
              <span>·</span>
              <span className="animate-pulse" style={{ animationDelay: '0.3s' }}>计算统计指标</span>
              <span>·</span>
              <span className="animate-pulse" style={{ animationDelay: '0.6s' }}>生成图表</span>
              <span>·</span>
              <span className="animate-pulse" style={{ animationDelay: '0.9s' }}>发现洞察</span>
            </div>
          </div>
        )}

        {/* 分析结果 */}
        {view === 'result' && result && (
          <div className="space-y-8">
            {/* 文件信息 */}
            <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-6 py-4 fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{result.fileName}</p>
                  <p className="text-xs text-slate-400">分析时间：{formatTime(result.uploadTime)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPDF}
                  disabled={exporting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                      导出中...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      导出PDF
                    </>
                  )}
                </button>
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  分析新文件
                </button>
              </div>
            </div>

            {/* 各模块 */}
            <DataOverview result={result} />
            <ChartDisplay charts={result.charts} />
            <ColumnDetails columns={result.columns} />
            <InsightReport insights={result.insights} />
          </div>
        )}

        {/* 历史记录 */}
        {view === 'history' && (
          <div className="fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800">历史分析记录</h2>
              {history.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  清空记录
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-slate-500 mb-1">暂无历史记录</p>
                <p className="text-sm text-slate-400">上传文件进行分析后，记录会显示在这里</p>
                <button
                  onClick={handleBack}
                  className="mt-4 px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
                >
                  去上传文件
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((record) => (
                  <div key={record.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{record.fileName}</p>
                          <p className="text-xs text-slate-400">
                            {formatTime(record.uploadTime)} · {record.rowCount.toLocaleString()}行 · {record.colCount}列 · {record.insightCount}条洞察
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-slate-400 hidden sm:inline">{record.topInsight}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 底部 */}
      <footer className="border-t border-slate-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-slate-400">
            DataLens · 智能数据分析平台 · 数据在本地处理，不会上传到服务器
          </p>
        </div>
      </footer>
    </div>
  )
}
