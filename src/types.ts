// 数据类型定义

// 原始数据表结构
export interface DataTable {
  headers: string[]        // 列名
  rows: (string | number | null)[][]  // 数据行
  fileName: string         // 文件名
  rowCount: number         // 行数
  colCount: number         // 列数
}

// 列分析结果
export interface ColumnAnalysis {
  name: string             // 列名
  type: 'number' | 'string' | 'date' | 'boolean'  // 数据类型
  uniqueCount: number      // 唯一值数量
  missingCount: number     // 缺失值数量
  missingPercent: number   // 缺失率
  // 数值型特有
  min?: number
  max?: number
  mean?: number
  median?: number
  sum?: number
  std?: number
  // 文本型特有
  topValues?: { value: string; count: number; percent: number }[]
}

// 图表配置
export interface ChartConfig {
  id: string
  title: string
  type: 'line' | 'bar' | 'pie' | 'scatter'
  description: string
  option: any  // ECharts配置
}

// 洞察报告
export interface Insight {
  type: 'positive' | 'negative' | 'warning' | 'info'
  title: string
  content: string
  confidence: 'high' | 'medium' | 'low'
}

// 完整分析结果
export interface AnalysisResult {
  fileName: string
  uploadTime: string
  overview: {
    rowCount: number
    colCount: number
    missingCells: number
    missingPercent: number
    duplicateRows: number
  }
  columns: ColumnAnalysis[]
  charts: ChartConfig[]
  insights: Insight[]
}

// 历史记录
export interface HistoryRecord {
  id: string
  fileName: string
  uploadTime: string
  rowCount: number
  colCount: number
  insightCount: number
  topInsight: string
}
