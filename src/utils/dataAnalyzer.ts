// 数据分析模块 - 自动分析数据并生成图表配置和洞察报告

import type {
  DataTable,
  ColumnAnalysis,
  ChartConfig,
  Insight,
  AnalysisResult,
} from '../types'

/**
 * 检测列的数据类型
 */
function detectColumnType(values: (string | number | null)[]): ColumnAnalysis['type'] {
  const nonNull = values.filter(v => v !== null && v !== '') as (string | number)[]
  if (nonNull.length === 0) return 'string'

  let numCount = 0
  let dateCount = 0
  let boolCount = 0

  for (const val of nonNull) {
    if (typeof val === 'number') {
      numCount++
    } else if (typeof val === 'string') {
      // 尝试解析为数字
      const num = Number(val)
      if (!isNaN(num) && val.trim() !== '') {
        numCount++
        continue
      }
      // 尝试解析为日期
      if (isDateString(val)) {
        dateCount++
        continue
      }
      // 布尔值
      if (val.toLowerCase() === 'true' || val.toLowerCase() === 'false' ||
          val === '是' || val === '否') {
        boolCount++
        continue
      }
    }
  }

  const total = nonNull.length
  if (numCount / total > 0.8) return 'number'
  if (dateCount / total > 0.8) return 'date'
  if (boolCount / total > 0.8) return 'boolean'
  return 'string'
}

/**
 * 判断字符串是否为日期格式
 */
function isDateString(val: string): boolean {
  // 常见日期格式: 2024-01-01, 2024/01/01, 2024年01月01日
  const datePatterns = [
    /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/,
    /^\d{4}年\d{1,2}月\d{1,2}日/,
    /^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/,
  ]
  return datePatterns.some(p => p.test(val.trim()))
}

/**
 * 将值转为数字
 */
function toNumber(val: string | number | null): number | null {
  if (val === null || val === '') return null
  if (typeof val === 'number') return val
  const num = Number(val)
  return isNaN(num) ? null : num
}

/**
 * 分析单列数据
 */
function analyzeColumn(name: string, values: (string | number | null)[]): ColumnAnalysis {
  const type = detectColumnType(values)
  const nonNull = values.filter(v => v !== null && v !== '') as (string | number)[]
  const uniqueValues = new Set(nonNull.map(v => String(v)))
  const missingCount = values.length - nonNull.length

  const result: ColumnAnalysis = {
    name,
    type,
    uniqueCount: uniqueValues.size,
    missingCount,
    missingPercent: values.length > 0 ? (missingCount / values.length) * 100 : 0,
  }

  if (type === 'number') {
    const numbers = nonNull.map(v => toNumber(v)).filter((v): v is number => v !== null)
    if (numbers.length > 0) {
      numbers.sort((a, b) => a - b)
      const sum = numbers.reduce((acc, n) => acc + n, 0)
      const mean = sum / numbers.length
      const median = numbers.length % 2 === 0
        ? (numbers[numbers.length / 2 - 1] + numbers[numbers.length / 2]) / 2
        : numbers[Math.floor(numbers.length / 2)]
      const variance = numbers.reduce((acc, n) => acc + Math.pow(n - mean, 2), 0) / numbers.length

      result.min = numbers[0]
      result.max = numbers[numbers.length - 1]
      result.mean = Math.round(mean * 100) / 100
      result.median = Math.round(median * 100) / 100
      result.sum = Math.round(sum * 100) / 100
      result.std = Math.round(Math.sqrt(variance) * 100) / 100
    }
  } else if (type === 'string' || type === 'boolean') {
    // 统计Top值
    const valueCounts = new Map<string, number>()
    nonNull.forEach(v => {
      const key = String(v)
      valueCounts.set(key, (valueCounts.get(key) || 0) + 1)
    })
    const sorted = Array.from(valueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([value, count]) => ({
        value,
        count,
        percent: Math.round((count / nonNull.length) * 1000) / 10,
      }))
    result.topValues = sorted
  }

  return result
}

/**
 * 生成图表配置
 */
function generateCharts(data: DataTable, columns: ColumnAnalysis[]): ChartConfig[] {
  const charts: ChartConfig[] = []
  const numericCols = columns.filter(c => c.type === 'number')
  const stringCols = columns.filter(c => c.type === 'string' || c.type === 'boolean')
  const dateCols = columns.filter(c => c.type === 'date')

  // 图表1: 数值列的统计概览（柱状图）
  if (numericCols.length > 0) {
    const colIndex = data.headers.indexOf(numericCols[0].name)
    const chartData = numericCols.slice(0, 6).map(col => {
      const idx = data.headers.indexOf(col.name)
      const sum = data.rows.reduce((acc, row) => acc + (toNumber(row[idx]) || 0), 0)
      return { name: col.name, value: Math.round(sum * 100) / 100 }
    })

    charts.push({
      id: 'numeric_overview',
      title: '数值字段汇总对比',
      type: 'bar',
      description: `各数值字段的总计对比（共${numericCols.length}个数值字段）`,
      option: {
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
          type: 'category',
          data: chartData.map(d => d.name),
          axisLabel: { rotate: chartData.length > 4 ? 30 : 0, fontSize: 11 },
        },
        yAxis: { type: 'value', axisLabel: { fontSize: 11 } },
        series: [{
          type: 'bar',
          data: chartData.map(d => ({
            value: d.value,
            itemStyle: { color: '#3b82f6' },
          })),
          barMaxWidth: 40,
          label: { show: true, position: 'top', fontSize: 10 },
        }],
      },
    })
  }

  // 图表2: 时间趋势（折线图）- 如果有日期列+数值列
  if (dateCols.length > 0 && numericCols.length > 0) {
    const dateCol = dateCols[0]
    const numCol = numericCols[0]
    const dateIdx = data.headers.indexOf(dateCol.name)
    const numIdx = data.headers.indexOf(numCol.name)

    // 按日期聚合
    const dateMap = new Map<string, number>()
    data.rows.forEach(row => {
      const date = String(row[dateIdx] || '')
      const val = toNumber(row[numIdx]) || 0
      dateMap.set(date, (dateMap.get(date) || 0) + val)
    })

    const sortedDates = Array.from(dateMap.keys()).sort()
    if (sortedDates.length > 1) {
      charts.push({
        id: 'time_trend',
        title: `${numCol.name} 时间趋势`,
        type: 'line',
        description: `按${dateCol.name}的${numCol.name}变化趋势`,
        option: {
          tooltip: { trigger: 'axis' },
          grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
          xAxis: {
            type: 'category',
            data: sortedDates,
            axisLabel: { fontSize: 10, rotate: sortedDates.length > 8 ? 30 : 0 },
          },
          yAxis: { type: 'value', axisLabel: { fontSize: 11 } },
          series: [{
            type: 'line',
            data: sortedDates.map(d => dateMap.get(d)),
            smooth: true,
            lineStyle: { width: 2, color: '#2563eb' },
            itemStyle: { color: '#2563eb' },
            areaStyle: {
              color: {
                type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(37,99,235,0.3)' },
                  { offset: 1, color: 'rgba(37,99,235,0.02)' },
                ],
              },
            },
          }],
        },
      })
    }
  }

  // 图表3: 分类占比（饼图）- 取第一个字符串列
  if (stringCols.length > 0 && numericCols.length > 0) {
    const catCol = stringCols[0]
    const numCol = numericCols[0]
    const catIdx = data.headers.indexOf(catCol.name)
    const numIdx = data.headers.indexOf(numCol.name)

    const catMap = new Map<string, number>()
    data.rows.forEach(row => {
      const cat = String(row[catIdx] || '未知')
      const val = toNumber(row[numIdx]) || 0
      catMap.set(cat, (catMap.get(cat) || 0) + val)
    })

    const sorted = Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8) // 最多8个分类

    if (sorted.length > 1) {
      charts.push({
        id: 'category_pie',
        title: `${catCol.name} 占比分析`,
        type: 'pie',
        description: `按${catCol.name}分组的${numCol.name}占比`,
        option: {
          tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
          legend: {
            orient: 'vertical',
            right: 10,
            top: 'center',
            textStyle: { fontSize: 11 },
          },
          series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['40%', '50%'],
            data: sorted.map(([name, value]) => ({ name, value })),
            label: { fontSize: 10 },
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0,0,0,0.3)',
              },
            },
          }],
        },
      })
    }
  }

  // 图表4: 数值列分布（柱状图直方图）
  if (numericCols.length > 0) {
    const col = numericCols[0]
    const idx = data.headers.indexOf(col.name)
    const numbers = data.rows
      .map(row => toNumber(row[idx]))
      .filter((v): v is number => v !== null)

    if (numbers.length > 5 && col.max !== undefined && col.min !== undefined) {
      const range = col.max - col.min
      if (range > 0) {
        const binCount = Math.min(10, Math.ceil(Math.sqrt(numbers.length)))
        const binSize = range / binCount
        const bins = new Array(binCount).fill(0)
        const labels: string[] = []

        for (let i = 0; i < binCount; i++) {
          const start = col.min + i * binSize
          const end = start + binSize
          labels.push(`${Math.round(start)}-${Math.round(end)}`)
        }

        numbers.forEach(n => {
          let binIndex = Math.floor((n - col.min!) / binSize)
          if (binIndex >= binCount) binIndex = binCount - 1
          bins[binIndex]++
        })

        charts.push({
          id: 'distribution',
          title: `${col.name} 分布直方图`,
          type: 'bar',
          description: `${col.name}的数据分布情况`,
          option: {
            tooltip: { trigger: 'axis' },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: {
              type: 'category',
              data: labels,
              axisLabel: { fontSize: 9, rotate: 30 },
            },
            yAxis: { type: 'value', name: '频次', axisLabel: { fontSize: 11 } },
            series: [{
              type: 'bar',
              data: bins,
              itemStyle: { color: '#6366f1' },
              barMaxWidth: 50,
            }],
          },
        })
      }
    }
  }

  // 图表5: 多数值列对比（多柱状图）
  if (numericCols.length >= 2 && stringCols.length > 0) {
    const catCol = stringCols[0]
    const catIdx = data.headers.indexOf(catCol.name)
    const numCols = numericCols.slice(0, 3)

    const catMap = new Map<string, number[]>()
    data.rows.forEach(row => {
      const cat = String(row[catIdx] || '未知')
      if (!catMap.has(cat)) catMap.set(cat, new Array(numCols.length).fill(0))
      const arr = catMap.get(cat)!
      numCols.forEach((col, i) => {
        const idx = data.headers.indexOf(col.name)
        arr[i] += toNumber(row[idx]) || 0
      })
    })

    const sorted = Array.from(catMap.entries())
      .sort((a, b) => b[1].reduce((s, v) => s + v, 0) - a[1].reduce((s, v) => s + v, 0))
      .slice(0, 10)

    charts.push({
      id: 'multi_compare',
      title: `${catCol.name} 多维度对比`,
      type: 'bar',
      description: `按${catCol.name}分组的多个数值字段对比`,
      option: {
        tooltip: { trigger: 'axis' },
        legend: { top: 0, textStyle: { fontSize: 11 } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
          type: 'category',
          data: sorted.map(([name]) => name),
          axisLabel: { fontSize: 10, rotate: sorted.length > 5 ? 30 : 0 },
        },
        yAxis: { type: 'value', axisLabel: { fontSize: 11 } },
        series: numCols.map((col, i) => ({
          name: col.name,
          type: 'bar',
          data: sorted.map(([, arr]) => Math.round(arr[i] * 100) / 100),
        })),
      },
    })
  }

  return charts
}

/**
 * 生成洞察报告
 */
function generateInsights(data: DataTable, columns: ColumnAnalysis[]): Insight[] {
  const insights: Insight[] = []
  const numericCols = columns.filter(c => c.type === 'number')
  const stringCols = columns.filter(c => c.type === 'string' || c.type === 'boolean')

  // 洞察1: 数据质量
  const totalCells = data.rowCount * data.colCount
  const missingCells = columns.reduce((acc, c) => acc + c.missingCount, 0)
  const missingPercent = totalCells > 0 ? (missingCells / totalCells) * 100 : 0

  if (missingPercent > 0) {
    const colsWithMissing = columns.filter(c => c.missingCount > 0)
    insights.push({
      type: missingPercent > 10 ? 'warning' : 'info',
      title: '数据完整性',
      content: `数据集共${data.rowCount}行${data.colCount}列，缺失值${missingCells}个（占比${missingPercent.toFixed(1)}%）。${colsWithMissing.length > 0 ? `缺失较多的字段：${colsWithMissing.slice(0, 3).map(c => `${c.name}(${c.missingPercent.toFixed(1)}%)`).join('、')}。` : ''}${missingPercent > 10 ? '建议关注数据采集质量，补全缺失值后再做深度分析。' : '数据完整性较好，可放心使用。'}`,
      confidence: 'high',
    })
  } else {
    insights.push({
      type: 'positive',
      title: '数据完整性',
      content: `数据集共${data.rowCount}行${data.colCount}列，无缺失值，数据完整性100%。`,
      confidence: 'high',
    })
  }

  // 洞察2: 数值列关键发现
  numericCols.forEach(col => {
    if (col.mean !== undefined && col.std !== undefined) {
      const cv = col.mean !== 0 ? (col.std / Math.abs(col.mean)) * 100 : 0
      if (cv > 50) {
        insights.push({
          type: 'info',
          title: `${col.name} 波动性分析`,
          content: `${col.name}平均值为${col.mean}，标准差为${col.std}，变异系数${cv.toFixed(1)}%，数据波动较大。最大值${col.max}，最小值${col.min}，极差${(col.max! - col.min!).toFixed(2)}。`,
          confidence: 'high',
        })
      }
    }
  })

  // 洞察3: 分类列分布
  stringCols.forEach(col => {
    if (col.topValues && col.topValues.length > 0) {
      const top = col.topValues[0]
      if (top.percent > 50) {
        insights.push({
          type: 'warning',
          title: `${col.name} 集中度风险`,
          content: `${col.name}中"${top.value}"占比高达${top.percent}%，分布高度集中。${col.topValues.length < 3 ? '分类过于集中可能导致分析偏差。' : `前${col.topValues.length}个类别合计占比${col.topValues.reduce((acc, v) => acc + v.percent, 0).toFixed(1)}%。`}`,
          confidence: 'high',
        })
      } else if (col.uniqueCount > data.rowCount * 0.9) {
        // 跳过ID类字段
      } else {
        insights.push({
          type: 'info',
          title: `${col.name} 分布概况`,
          content: `${col.name}共有${col.uniqueCount}个不同值，分布较为${col.uniqueCount > 10 ? '分散' : '集中'}。占比最高的是"${top.value}"（${top.percent}%）。`,
          confidence: 'medium',
        })
      }
    }
  })

  // 洞察4: 重复行检测
  const seen = new Set<string>()
  let duplicateCount = 0
  data.rows.forEach(row => {
    const key = JSON.stringify(row)
    if (seen.has(key)) {
      duplicateCount++
    } else {
      seen.add(key)
    }
  })

  if (duplicateCount > 0) {
    insights.push({
      type: 'warning',
      title: '重复数据',
      content: `检测到${duplicateCount}行完全重复的数据（占比${(duplicateCount / data.rowCount * 100).toFixed(1)}%），建议去重后再分析。`,
      confidence: 'high',
    })
  }

  // 洞察5: 数值列Top贡献
  if (numericCols.length > 0 && stringCols.length > 0) {
    const numCol = numericCols[0]
    const strCol = stringCols[0]
    const numIdx = data.headers.indexOf(numCol.name)
    const strIdx = data.headers.indexOf(strCol.name)

    const groupMap = new Map<string, number>()
    data.rows.forEach(row => {
      const cat = String(row[strIdx] || '未知')
      const val = toNumber(row[numIdx]) || 0
      groupMap.set(cat, (groupMap.get(cat) || 0) + val)
    })

    const sorted = Array.from(groupMap.entries()).sort((a, b) => b[1] - a[1])
    const total = sorted.reduce((acc, [, v]) => acc + v, 0)

    if (sorted.length > 0 && total > 0) {
      const top3 = sorted.slice(0, 3)
      const top3Percent = (top3.reduce((acc, [, v]) => acc + v, 0) / total * 100).toFixed(1)
      insights.push({
        type: 'positive',
        title: `${strCol.name} 贡献度分析`,
        content: `按${strCol.name}分组的${numCol.name}总计中，TOP3分别是：${top3.map(([name, val]) => `"${name}"(${val})`).join('、')}，合计贡献占比${top3Percent}%。${Number(top3Percent) > 70 ? '集中度较高，存在结构性依赖风险。' : '分布相对均衡。'}`,
        confidence: 'high',
      })
    }
  }

  // 洞察6: 数据规模评估
  if (data.rowCount > 10000) {
    insights.push({
      type: 'info',
      title: '数据规模',
      content: `数据集包含${data.rowCount.toLocaleString()}行数据，属于中大规模数据集。当前分析基于全量数据，统计结果具有较高可信度。`,
      confidence: 'high',
    })
  } else if (data.rowCount < 100) {
    insights.push({
      type: 'warning',
      title: '数据规模',
      content: `数据集仅包含${data.rowCount}行数据，样本量较小，分析结论的统计意义有限，建议谨慎参考。`,
      confidence: 'high',
    })
  }

  return insights.slice(0, 8) // 最多8条洞察
}

/**
 * 执行完整分析
 */
export function analyzeData(data: DataTable): AnalysisResult {
  // 分析各列
  const columns = data.headers.map((name, idx) => {
    const colValues = data.rows.map(row => row[idx] ?? null)
    return analyzeColumn(name, colValues)
  })

  // 生成图表
  const charts = generateCharts(data, columns)

  // 生成洞察
  const insights = generateInsights(data, columns)

  // 统计缺失
  const totalCells = data.rowCount * data.colCount
  const missingCells = columns.reduce((acc, c) => acc + c.missingCount, 0)

  // 重复行
  const seen = new Set<string>()
  let duplicateRows = 0
  data.rows.forEach(row => {
    const key = JSON.stringify(row)
    if (seen.has(key)) duplicateRows++
    else seen.add(key)
  })

  return {
    fileName: data.fileName,
    uploadTime: new Date().toISOString(),
    overview: {
      rowCount: data.rowCount,
      colCount: data.colCount,
      missingCells,
      missingPercent: totalCells > 0 ? (missingCells / totalCells) * 100 : 0,
      duplicateRows,
    },
    columns,
    charts,
    insights,
  }
}
