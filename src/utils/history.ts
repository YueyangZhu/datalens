// 历史记录管理 - 使用localStorage存储

import type { AnalysisResult, HistoryRecord } from '../types'

const STORAGE_KEY = 'datalens_history'
const MAX_RECORDS = 50

/**
 * 获取所有历史记录
 */
export function getHistory(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as HistoryRecord[]
  } catch {
    return []
  }
}

/**
 * 保存分析结果到历史记录
 */
export function saveToHistory(result: AnalysisResult): void {
  try {
    const history = getHistory()
    const record: HistoryRecord = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fileName: result.fileName,
      uploadTime: result.uploadTime,
      rowCount: result.overview.rowCount,
      colCount: result.overview.colCount,
      insightCount: result.insights.length,
      topInsight: result.insights[0]?.title || '无洞察',
    }
    history.unshift(record)
    // 限制记录数量
    if (history.length > MAX_RECORDS) {
      history.splice(MAX_RECORDS)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))

    // 同时保存完整分析结果（单独存储，key为record id）
    localStorage.setItem(`${STORAGE_KEY}_${record.id}`, JSON.stringify(result))
  } catch (e) {
    console.error('保存历史记录失败:', e)
  }
}

/**
 * 获取某条历史记录的完整分析结果
 */
export function getHistoryDetail(id: string): AnalysisResult | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${id}`)
    if (!raw) return null
    return JSON.parse(raw) as AnalysisResult
  } catch {
    return null
  }
}

/**
 * 删除历史记录
 */
export function deleteHistory(id: string): void {
  try {
    const history = getHistory().filter(r => r.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    localStorage.removeItem(`${STORAGE_KEY}_${id}`)
  } catch (e) {
    console.error('删除历史记录失败:', e)
  }
}

/**
 * 清空所有历史记录
 */
export function clearHistory(): void {
  try {
    const history = getHistory()
    history.forEach(r => localStorage.removeItem(`${STORAGE_KEY}_${r.id}`))
    localStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    console.error('清空历史记录失败:', e)
  }
}

/**
 * 格式化时间为友好显示
 */
export function formatTime(isoTime: string): string {
  const date = new Date(isoTime)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
