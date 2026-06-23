// PDF导出工具 - html2canvas onclone 方案
// 流程：ECharts截图 → 生成报告HTML → 隐藏DOM中渲染 → html2canvas onclone截图 → jsPDF拼页 → 自动下载PDF
// 优点：无弹窗、无新页签、中文原生渲染、输出真实PDF文件
//
// A4 尺寸：
//   210mm × 297mm
//   @96dpi ≈ 794px × 1122px
//   scale=2 → 1588px × 2244px/页

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import * as echarts from 'echarts'
import type { AnalysisResult } from '../types'

// ============ 常量 ============

const REPORT_WIDTH = 794 // A4宽度像素
const PAGE_HEIGHT = 1122 // A4高度像素
const SCALE = 2
const PAD_MM = 10 // 报告边距 mm

const TYPE_LABELS: Record<string, string> = {
  number: '数值型', string: '文本型', date: '日期型', boolean: '布尔型',
}
const INSIGHT_LABELS: Record<string, string> = {
  positive: '优势', negative: '风险', warning: '注意', info: '信息',
}
const INSIGHT_COLORS: Record<string, string> = {
  positive: '#16a34a', negative: '#ef4444', warning: '#f59e0b', info: '#3b82f6',
}

// ============ 主入口 ============

export async function exportToPDFReport(
  result: AnalysisResult,
  chartElements?: HTMLDivElement[]
): Promise<void> {
  // Step 1: 截图图表
  const chartImages = await captureChartImages(chartElements || [])

  // Step 2: 生成报告 HTML
  const html = buildReportHTML(result, chartImages)

  // Step 3: 创建隐藏容器（fixed定位+透明度，保持布局参与）
  const id = 'datalens-report-' + Date.now()
  const container = document.createElement('div')
  container.id = id
  container.innerHTML = html
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: -9999px;
    width: ${REPORT_WIDTH}px;
    height: auto;
    z-index: -1;
    pointer-events: none;
    opacity: 0;
    overflow: hidden;
  `
  document.body.appendChild(container)

  // 强制布局计算，确保子元素获得尺寸
  container.getBoundingClientRect()

  // Step 4: html2canvas 截图（在克隆文档中将容器移到可视区域）
  const fullCanvas = await html2canvas(container, {
    scale: SCALE,
    backgroundColor: '#ffffff',
    logging: false,
    useCORS: true,
    allowTaint: true,
    width: REPORT_WIDTH,
    windowWidth: REPORT_WIDTH,
    onclone: (clonedDoc) => {
      const el = clonedDoc.getElementById(id)
      if (el) {
        el.style.opacity = '1'
        el.style.position = 'relative'
        el.style.left = '0'
        el.style.top = '0'
        el.style.zIndex = 'auto'
      }
    },
  })

  // Step 5: 清理原始 DOM
  if (document.body.contains(container)) {
    document.body.removeChild(container)
  }

  if (fullCanvas.width === 0 || fullCanvas.height === 0) {
    throw new Error('报告渲染失败：截图宽度或高度为 0，请尝试刷新页面后重试。')
  }

  // Step 6: 按 A4 高度裁切成页
  const pageH = PAGE_HEIGHT * SCALE
  const totalPages = Math.max(1, Math.ceil(fullCanvas.height / pageH))
  const pdf = new jsPDF('p', 'mm', 'a4')

  for (let p = 0; p < totalPages; p++) {
    if (p > 0) pdf.addPage()

    const sy = p * pageH
    const sh = Math.min(pageH, fullCanvas.height - sy)

    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = fullCanvas.width
    pageCanvas.height = sh

    const ctx = pageCanvas.getContext('2d')
    if (!ctx) continue

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
    ctx.drawImage(fullCanvas, 0, sy, fullCanvas.width, sh, 0, 0, fullCanvas.width, sh)

    const dataUrl = pageCanvas.toDataURL('image/png', 0.95)
    const drawHeight = (sh / fullCanvas.width) * 210 // mm
    pdf.addImage(dataUrl, 'PNG', 0, 0, 210, drawHeight)
  }

  // Step 7: 下载 PDF
  const safeName = result.fileName.replace(/[^\w\u4e00-\u9fa5.-]/g, '_')
  pdf.save(`${safeName}_数据分析报告.pdf`)
}

// ============ 图表截图 ============

async function captureChartImages(chartElements: HTMLDivElement[]): Promise<string[]> {
  const images: string[] = []
  for (const el of chartElements) {
    try {
      // 检查容器本身尺寸
      if (el.offsetWidth === 0 || el.offsetHeight === 0) {
        images.push('')
        continue
      }

      // 检查内部 canvas 尺寸
      const innerCanvas = el.querySelector('canvas')
      if (innerCanvas && (innerCanvas.width === 0 || innerCanvas.height === 0)) {
        images.push('')
        continue
      }

      // 优先使用 ECharts 原生 getDataURL，清晰且稳定
      const chartInstance = echarts.getInstanceByDom(el)
      if (chartInstance) {
        try {
          const dataUrl = chartInstance.getDataURL({
            type: 'png',
            pixelRatio: 2,
            backgroundColor: '#ffffff',
          })
          images.push(dataUrl)
          continue
        } catch {
          // 回退到 html2canvas
        }
      }

      // 回退：html2canvas 直接截图容器
      const cvs = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      })
      if (cvs.width === 0 || cvs.height === 0) {
        images.push('')
        continue
      }
      images.push(cvs.toDataURL('image/png', 0.92))
    } catch (e) {
      // 单个图表失败不中断整体导出
      images.push('')
      console.warn('[PDF导出] 图表截图失败:', e)
    }
  }
  return images
}

// ============ 报告 HTML 生成 ============

function buildReportHTML(r: AnalysisResult, chartImages: string[]): string {
  const now = new Date().toLocaleString('zh-CN')
  const padCSS = `${PAD_MM}mm`

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DataLens 数据分析报告</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }

  body {
    font-family: -apple-system,'Microsoft YaHei','PingFang SC','Noto Sans SC',sans-serif;
    color: #1e293b; font-size: 13px; line-height: 1.75;
    -webkit-font-smoothing: antialiased;
  }

  .page {
    width: 210mm;
    min-height: 297mm;
    padding: ${padCSS};
    background: #fff;
    page-break-after: always;
    position: relative;
    overflow: hidden;
  }
  .page:last-child { page-break-after: auto; }

  /* 封面 */
  .cover {
    background: linear-gradient(145deg, #1d4ed8, #2563eb 50%, #3b82f6);
    color: #fff; min-height: 297mm;
    display: flex; flex-direction: column; justify-content: center;
    padding: 10vh ${padCSS};
    position: relative;
  }
  .cover-stripe {
    position: absolute; bottom: 0; left: 0; right: 0; height: 5px; background: #f59e0b;
  }
  .cover h1 { font-size: 52px; font-weight: 800; letter-spacing: 2px; margin-bottom: 12px; }
  .cover h2 { font-size: 22px; font-weight: 400; opacity: 0.88; margin-bottom: 56px; }
  .cover-meta { font-size: 15px; opacity: 0.82; line-height: 2.3; }
  .cover-meta em { font-style: normal; opacity: 0.6; display: inline-block; width: 80px; }
  .cover-bottom {
    position: absolute; bottom: 10vh; left: ${padCSS}; right: ${padCSS};
    text-align: center; font-size: 11px; opacity: 0.45;
  }

  .section-title {
    font-size: 20px; font-weight: 700; color: #2563eb; padding-left: 12px;
    border-left: 4px solid #2563eb; margin-bottom: 16px;
  }
  .desc { font-size: 13px; color: #64748b; margin-bottom: 14px; }

  .cards { display: flex; gap: 12px; margin: 12px 0 16px 0; }
  .card {
    flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
    padding: 18px 14px; text-align: center;
  }
  .card-val { font-size: 26px; font-weight: 700; }
  .card-lbl { font-size: 12px; color: #64748b; margin-top: 4px; }

  table { width: 100%; border-collapse: collapse; margin: 10px 0 16px 0; }
  th { background: #eff6ff; color: #1e40af; font-size: 12px; font-weight: 600;
       padding: 10px 12px; text-align: left; border-bottom: 2px solid #bfdbfe; }
  td { padding: 8px 12px; font-size: 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
  tr:nth-child(even) td { background: #f8fafc; }
  td.type { color: #3b82f6; }
  td.assess { color: #64748b; }

  .chart-box { margin: 16px 0; }
  .chart-box h3 { font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
  .chart-box .desc { font-size: 12px; color: #64748b; margin-bottom: 8px; }
  .chart-box img { width: 100%; border-radius: 6px; border: 1px solid #f1f5f9; }
  .chart-empty {
    background: #f8fafc; border: 1px dashed #e2e8f0; border-radius: 6px;
    text-align: center; padding: 44px 0; color: #94a3b8; font-size: 13px;
  }

  .insight-stats {
    background: #f8fafc; border-radius: 8px; padding: 10px 16px; margin-bottom: 14px;
  }
  .insight-stats span { margin-right: 16px; font-size: 12px; font-weight: 600; }
  .ins-card {
    background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
    margin: 8px 0; display: flex; overflow: hidden;
  }
  .ins-bar { width: 5px; flex-shrink: 0; }
  .ins-body { flex: 1; padding: 12px 14px; }
  .ins-hdr { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .ins-hdr .num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; border-radius: 50%; color: #fff; font-size: 11px;
    font-weight: 700; flex-shrink: 0;
  }
  .ins-hdr .title { font-size: 14px; font-weight: 700; }
  .ins-meta { display: flex; gap: 10px; align-items: center; margin: 4px 0; }
  .ins-meta .badge {
    display: inline-block; padding: 1px 8px; border-radius: 10px;
    font-size: 10px; font-weight: 600; color: #fff; opacity: 0.88;
  }
  .ins-meta .conf { font-size: 11px; color: #94a3b8; }
  .ins-body .body { font-size: 12px; color: #475569; line-height: 1.75; }

  .summary-block {
    background: linear-gradient(135deg, #eff6ff, #f0f9ff);
    border: 1px solid #bfdbfe; border-radius: 8px;
    padding: 14px 16px; margin: 16px 0; font-size: 13px; line-height: 1.85;
    color: #1e40af;
  }
  .summary-block strong { color: #1d4ed8; }

  .footer-section { margin-top: 30px; }
  .footer-section p { font-size: 12px; color: #94a3b8; line-height: 2; margin: 4px 0; }
  .footer-section strong { color: #64748b; }
</style>
</head>
<body>
  ${buildCoverHTML(r, now, padCSS)}
  ${buildReportBody(r, chartImages)}
</body>
</html>`
}

// ==================== 封面 ====================

function buildCoverHTML(r: AnalysisResult, now: string, padCSS: string): string {
  return `
<div class="page cover">
  <h1>DataLens</h1>
  <h2>智能数据分析报告</h2>
  <div class="cover-meta">
    <div><em>报告文件</em>${esc(r.fileName)}</div>
    <div><em>生成时间</em>${esc(formatDate(r.uploadTime))}</div>
    <div><em>数据规模</em>${r.overview.rowCount.toLocaleString()} 行 × ${r.overview.colCount} 列</div>
    <div><em>缺失率</em>${r.overview.missingPercent.toFixed(1)}%</div>
    <div><em>重复行</em>${r.overview.duplicateRows} 行</div>
  </div>
  <div class="cover-bottom">本报告由 DataLens 智能数据分析平台自动生成 · ${now}</div>
  <div class="cover-stripe"></div>
</div>`
}

// ==================== 报告正文 ====================

function buildReportBody(r: AnalysisResult, chartImages: string[]): string {
  const h = (title: string, content: string) => `
<div class="page">
  <div class="section-title">${title}</div>
  ${content}
</div>`

  let html = ''

  html += h('一、执行摘要', buildSummaryHTML(r))
  html += h('二、数据概览', buildOverviewHTML(r))
  if (r.charts.length > 0) html += h('三、可视化图表', buildChartsHTML(r.charts, chartImages))
  html += h('四、字段详情', buildFieldsHTML(r.columns))
  if (r.insights.length > 0) html += h('五、洞察与建议', buildInsightsHTML(r.insights, r))

  html += `
<div class="page">
  <div class="footer-section">
    <p><strong>报告声明</strong>：本报告由 DataLens 智能数据分析平台基于规则引擎自动生成，仅供决策参考。分析结果受数据质量和算法模型限制。</p>
    <p><strong>数据安全</strong>：所有数据均在浏览器本地完成处理和分析，不会上传至外部服务器。</p>
    <p><strong>生成时间</strong>：${new Date().toLocaleString('zh-CN')}</p>
  </div>
</div>`

  return html
}

// ==================== 摘要 ====================

function buildSummaryHTML(r: AnalysisResult): string {
  const cards: [string, string, string][] = [
    ['总行数', r.overview.rowCount.toLocaleString(), '#2563eb'],
    ['总列数', String(r.overview.colCount), '#3b82f6'],
    ['缺失值', `${r.overview.missingCells.toLocaleString()} (${r.overview.missingPercent.toFixed(1)}%)`, '#f59e0b'],
    ['重复行', String(r.overview.duplicateRows), '#ef4444'],
  ]

  let desc = `本次分析对文件「${esc(r.fileName)}」进行了解读。数据集包含 ${r.overview.rowCount.toLocaleString()} 行记录，${r.overview.colCount} 个字段。`
  desc += r.overview.missingPercent <= 3
    ? `数据质量良好，缺失率仅 ${r.overview.missingPercent.toFixed(1)}%。`
    : `数据存在一定缺失（${r.overview.missingPercent.toFixed(1)}%），建议关注数据质量。`
  if (r.overview.duplicateRows > 0) desc += `发现 ${r.overview.duplicateRows} 行重复记录。`
  const nc = r.columns.filter(c => c.type === 'number').length
  const sc = r.columns.filter(c => c.type === 'string').length
  const dc = r.columns.filter(c => c.type === 'date').length
  desc += `字段类型分布：${nc} 个数值型、${sc} 个文本型、${dc} 个日期型。`

  let conclusion = ''
  if (r.insights.length > 0) {
    const pos = r.insights.filter(i => i.type === 'positive').length
    const neg = r.insights.filter(i => i.type === 'negative').length
    const top = r.insights.slice(0, 2)
    const hint = top.map(t => t.title).join('、')
    conclusion = `<p style="margin-top:12px; padding:10px 14px; background:#f8fafc; border-radius:6px; color:#334155; font-size:12px; line-height:1.8;">`
    conclusion += `<strong>核心结论：</strong>本次分析共生成 ${r.insights.length} 条洞察`
    if (pos > 0 || neg > 0) conclusion += `（${pos > 0 ? `优势 ${pos} 条` : ''}${pos > 0 && neg > 0 ? '、' : ''}${neg > 0 ? `风险 ${neg} 条` : ''}）`
    conclusion += `。关键发现包括：${esc(hint)}。`
    if (neg > 0) conclusion += `建议优先关注风险项，结合业务背景排查。`
    else if (pos > 0) conclusion += `可围绕优势项制定业务优化策略。`
    conclusion += `</p>`
  } else {
    conclusion = `<p style="margin-top:12px; padding:10px 14px; background:#f8fafc; border-radius:6px; color:#334155; font-size:12px; line-height:1.8;">`
    conclusion += `<strong>核心结论：</strong>本次分析完成数据结构与质量评估，未生成深度洞察。建议上传更完整的数据或补充更多维度的字段。`
    conclusion += `</p>`
  }

  return `
<p class="desc">${desc}</p>
<div class="cards">
  ${cards.map(c => `
    <div class="card">
      <div class="card-val" style="color:${c[2]}">${esc(c[1])}</div>
      <div class="card-lbl">${esc(c[0])}</div>
    </div>
  `).join('')}
</div>
${conclusion}`
}

// ==================== 数据概览 ====================

function buildOverviewHTML(r: AnalysisResult): string {
  const rows: [string, string, string][] = [
    ['总记录数', `${r.overview.rowCount.toLocaleString()} 行`,
      r.overview.rowCount >= 100 ? '样本量充足，分析结果可信' : '样本量偏少，结论仅供参考'],
    ['字段数量', `${r.overview.colCount} 列`,
      r.overview.colCount >= 5 ? '维度丰富，支持多角度分析' : '维度较少，建议补充字段'],
    ['有效单元格', `${(r.overview.rowCount * r.overview.colCount - r.overview.missingCells).toLocaleString()} 个`,
      r.overview.missingPercent <= 3 ? '数据完整性良好' : '存在缺失，需关注'],
    ['缺失单元格', `${r.overview.missingCells.toLocaleString()} 个（${r.overview.missingPercent.toFixed(2)}%）`,
      r.overview.missingPercent <= 1 ? '可忽略' : r.overview.missingPercent <= 5 ? '可接受' : '建议优先处理缺失值'],
    ['完全重复行', `${r.overview.duplicateRows} 行`,
      r.overview.duplicateRows === 0 ? '无重复记录' : '存在重复，建议检查数据来源'],
  ]

  const nc = r.columns.filter(c => c.type === 'number').length
  const sc = r.columns.filter(c => c.type === 'string').length
  const dc = r.columns.filter(c => c.type === 'date').length

  return `
<p class="desc">以下是对数据集结构、完整性和字段分布的详细评估。</p>
<table>
  <thead><tr><th>数据维度</th><th>数值</th><th>分析与评估</th></tr></thead>
  <tbody>
    ${rows.map(r => `<tr><td><strong>${esc(r[0])}</strong></td><td>${esc(r[1])}</td><td class="assess">${esc(r[2])}</td></tr>`).join('')}
  </tbody>
</table>
<p class="desc">字段构成：${nc} 个数值型（适合统计指标）、${sc} 个文本型（适合分类汇总）、${dc} 个日期型（适合时间序列分析）。</p>`
}

// ==================== 图表 ====================

function buildChartsHTML(
  charts: Array<{ id: string; title: string; type: string; description: string }>,
  images: string[]
): string {
  let html = `<p class="desc">共生成 ${charts.length} 张可视化图表，帮助直观理解数据分布与趋势。</p>`
  for (let i = 0; i < charts.length; i++) {
    const ch = charts[i]
    const img = images[i]
    html += `<div class="chart-box">`
    html += `<h3>${esc(ch.title)}</h3>`
    if (ch.description) html += `<div class="desc">${esc(ch.description)}</div>`
    if (img) html += `<img src="${img}" alt="${esc(ch.title)}" />`
    else html += `<div class="chart-empty">[${ch.type.toUpperCase()}] ${esc(ch.title)} — 图表未捕获</div>`
    html += `</div>`
  }
  return html
}

// ==================== 字段详情 ====================

function buildFieldsHTML(
  cols: Array<{
    name: string; type: string; uniqueCount: number;
    missingCount: number; missingPercent: number;
    min?: number; max?: number; mean?: number; std?: number;
  }>
): string {
  let rowsHTML = ''
  for (const col of cols) {
    const nm = col.name.length > 14 ? col.name.slice(0, 13) + '…' : col.name
    const isNum = col.type === 'number'
    rowsHTML += `<tr>
  <td style="font-weight:500;">${esc(nm)}</td>
  <td class="type">${esc(TYPE_LABELS[col.type] || col.type)}</td>
  <td>${col.uniqueCount.toLocaleString()}</td>
  <td style="color:${col.missingPercent > 10 ? '#ef4444' : col.missingPercent > 5 ? '#f59e0b' : '#334155'}">${col.missingPercent.toFixed(1)}%</td>
  <td>${isNum && col.min != null ? fmtN(col.min) : '-'}</td>
  <td>${isNum && col.max != null ? fmtN(col.max) : '-'}</td>
  <td>${isNum && col.mean != null ? fmtN(col.mean) : '-'}</td>
  <td>${isNum && col.std != null ? fmtN(col.std) : '-'}</td>
</tr>`
  }

  const nc = cols.filter(c => c.type === 'number').length
  const sc = cols.filter(c => c.type === 'string').length
  const dc = cols.filter(c => c.type === 'date').length

  return `
<p class="desc">以下列出数据集中所有字段的基本统计信息。数值型字段包含最小值、最大值、均值、标准差；文本型字段显示唯一值数量。</p>
<table>
  <thead><tr><th>字段名</th><th>类型</th><th>唯一值</th><th>缺失率</th><th>最小值</th><th>最大值</th><th>均值</th><th>标准差</th></tr></thead>
  <tbody>${rowsHTML}</tbody>
</table>
<p style="font-size:12px;color:#94a3b8;margin-top:6px;">共 ${cols.length} 个字段：${nc} 数值型 · ${sc} 文本型 · ${dc} 日期型</p>`
}

// ==================== 洞察与建议 ====================

function buildInsightsHTML(
  ins: Array<{ type: string; title: string; content: string; confidence: string }>,
  r: AnalysisResult
): string {
  const counts: Record<string, number> = {}
  for (const i of ins) counts[i.type] = (counts[i.type] || 0) + 1

  let statsHTML = ''
  for (const [tp, cnt] of Object.entries(counts)) {
    const c = INSIGHT_COLORS[tp] || '#3b82f6'
    const label = INSIGHT_LABELS[tp] || '信息'
    statsHTML += `<span style="color:${c};">● ${label} ${cnt} 条</span>`
  }

  const high = ins.filter(i => i.type === 'negative' || i.confidence === 'high').length
  const pos = counts['positive'] || 0
  const neg = counts['negative'] || 0

  let summaryDesc = `本次分析共发现 ${ins.length} 条数据洞察。其中优势 ${pos} 条，风险 ${neg} 条，高优先级 ${high} 条。`
  if (neg > 0) summaryDesc += `建议优先关注风险项，结合业务背景进行深入排查。`
  if (pos > 0) summaryDesc += `优势项可作为业务优化的参考方向。`

  let cardsHTML = ''
  for (let i = 0; i < ins.length; i++) {
    const item = ins[i]
    const c = INSIGHT_COLORS[item.type] || '#3b82f6'
    const cl = item.confidence === 'high' ? '高置信度' : item.confidence === 'medium' ? '中等置信度' : '需验证'
    const label = INSIGHT_LABELS[item.type] || '信息'
    const num = String(i + 1).padStart(2, '0')
    const confColor = item.confidence === 'high' ? c : item.confidence === 'medium' ? '#f59e0b' : '#94a3b8'

    cardsHTML += `
<div class="ins-card">
  <div class="ins-bar" style="background:${c};"></div>
  <div class="ins-body">
    <div class="ins-hdr">
      <span class="num" style="background:${c};">${num}</span>
      <span class="title" style="color:${c};">${esc(item.title)}</span>
    </div>
    <div class="ins-meta">
      <span class="badge" style="background:${c};">${esc(label)}</span>
      <span class="conf" style="color:${confColor};">${esc(cl)}</span>
    </div>
    <div class="body">${esc(item.content)}</div>
  </div>
</div>`
  }

  return `
<p class="desc">${summaryDesc}</p>
<div class="insight-stats">${statsHTML}</div>
${cardsHTML}
<div class="summary-block">
  <strong>📊 综合建议：</strong>基于 ${r.overview.rowCount.toLocaleString()} 行数据的分析，${
    r.overview.missingPercent <= 3 ? '数据整体质量良好，分析结果具备较高参考价值。' : '建议优先处理数据缺失问题以提高分析准确性。'
  }${
    ins.length > 5 ? `共发现 ${ins.length} 条洞察，涵盖数据质量、趋势特征、异常检测等多个维度，建议逐条复核。` : '洞察数量有限，建议上传更全面的数据以获得更丰富的分析结论。'
  }
</div>`
}

// ============ 工具函数 ============

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fmtN(n: number | undefined): string {
  if (n == null) return '-'
  if (Math.abs(n) >= 1e7) return (n / 1e6).toFixed(1) + 'M'
  if (Math.abs(n) >= 10000) return (n / 1000).toFixed(1) + 'K'
  if (Math.abs(n) >= 1000) return n.toLocaleString()
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

function formatDate(ds: string): string {
  try {
    const d = new Date(ds)
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return ds }
}

// ============ 收集图表元素 ============

export function collectChartElements(): HTMLDivElement[] {
  const els: HTMLDivElement[] = []
  const selectors = ['.echarts-container', '.echarts-for-react']
  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach(el => {
      if (el instanceof HTMLDivElement && el.offsetWidth > 0 && el.offsetHeight > 0) {
        // 再检查内部 canvas 是否有效
        const canvas = el.querySelector('canvas')
        if (canvas && (canvas.width === 0 || canvas.height === 0)) return
        els.push(el)
      }
    })
  }
  return els
}
