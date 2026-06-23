// PDF导出工具 - 浏览器原生打印方案
// 核心思路：iframe + window.print() → 浏览器"另存为PDF"
// 优点：中文完美渲染、文字可搜索复制、排版所见即所得、零依赖
//
// A4尺寸对应：
//   像素（@96dpi）: 794 × 1122
//   毫米：210 × 297

import type { AnalysisResult } from '../types'
import html2canvas from 'html2canvas'

// ============ 常量 ============

/** A4 内容宽度（px @96dpi，减去边距） */
const PAD = 40

/** 中文标题映射 */
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
  // 第1步：截图图表
  const chartImages = await captureChartImages(chartElements || [])

  // 第2步：生成完整报告HTML（含打印CSS）
  const html = buildReportHTML(result, chartImages)

  // 第3步：创建隐藏 iframe 并写入内容
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:99999;'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow!.document
  doc.open()
  doc.write(html)
  doc.close()

  // 第4步：等待图片和样式加载完毕
  const imgs = doc.querySelectorAll('img')
  await Promise.all(Array.from(imgs).map(
    img => img.complete ? Promise.resolve() : new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r() })
  ))
  await new Promise(r => setTimeout(r, 300))

  // 第5步：触发打印
  iframe.contentWindow!.focus()
  iframe.contentWindow!.print()

  // 第6步：等待打印对话框关闭后清理
  // 通过监听 afterprint 事件清理
  const cleanup = () => {
    iframe.contentWindow!.removeEventListener('afterprint', cleanup)
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe)
    }
  }
  iframe.contentWindow!.addEventListener('afterprint', cleanup)

  // 兜底：10秒后强制清理（防止 afterprint 不触发）
  setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe)
    }
  }, 10000)
}

// ============ 图表截图 ============

async function captureChartImages(chartElements: HTMLDivElement[]): Promise<string[]> {
  const images: string[] = []
  for (const el of chartElements) {
    try {
      if (el.offsetWidth === 0) { images.push(''); continue }
      const cvs = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
      images.push(cvs.toDataURL('image/png', 0.9))
    } catch {
      images.push('')
    }
  }
  return images
}

// ============ HTML 报告生成 ============

function buildReportHTML(result: AnalysisResult, chartImages: string[]): string {
  const now = new Date().toLocaleString('zh-CN')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DataLens - 数据分析报告</title>
<style>
  @page {
    size: A4;
    margin: 0;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: -apple-system, 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', sans-serif;
    color: #1e293b;
    font-size: 14px;
    line-height: 1.7;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* 每页 210mm × 297mm */
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 15mm ${PAD / 96 * 25.4}mm;
    page-break-after: always;
    position: relative;
    overflow: hidden;
  }
  .page:last-child { page-break-after: auto; }

  .page-footer {
    position: absolute;
    bottom: 12mm;
    left: ${PAD / 96 * 25.4}mm;
    right: ${PAD / 96 * 25.4}mm;
    border-top: 1px solid #e2e8f0;
    padding-top: 6mm;
    text-align: center;
    font-size: 10px;
    color: #94a3b8;
  }

  /* ===== 封面 ===== */
  .cover {
    background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%);
    color: #fff;
    height: 297mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    position: relative;
    padding: 0 ${PAD / 96 * 25.4}mm;
  }
  .cover-accent {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 5px;
    background: #f59e0b;
  }
  .cover h1 {
    font-size: 48px;
    font-weight: 800;
    letter-spacing: 2px;
    margin-bottom: 16px;
  }
  .cover h2 {
    font-size: 22px;
    font-weight: 400;
    opacity: 0.9;
    margin-bottom: 60px;
  }
  .cover-meta {
    font-size: 15px;
    opacity: 0.85;
    line-height: 2.2;
  }
  .cover-meta span.ml { display: inline-block; width: 90px; opacity: 0.7; }
  .cover-bottom {
    position: absolute;
    bottom: 30mm;
    left: ${PAD / 96 * 25.4}mm;
    right: ${PAD / 96 * 25.4}mm;
    text-align: center;
    font-size: 12px;
    opacity: 0.5;
  }

  /* ===== 章节 ===== */
  .section { margin-bottom: 20mm; }
  .section-title {
    font-size: 22px;
    font-weight: 700;
    color: #2563eb;
    padding-left: 12px;
    border-left: 4px solid #2563eb;
    margin-bottom: 16px;
    line-height: 1.3;
  }

  /* ===== 卡片 ===== */
  .card-row {
    display: flex;
    gap: 14px;
    margin: 14px 0;
  }
  .card {
    flex: 1;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px 14px;
    text-align: center;
  }
  .card-value {
    font-size: 28px;
    font-weight: 700;
  }
  .card-label {
    font-size: 12px;
    color: #64748b;
    margin-top: 6px;
  }

  /* ===== 表格 ===== */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
  }
  th {
    background: #eff6ff;
    color: #1e40af;
    font-size: 13px;
    font-weight: 600;
    padding: 10px 12px;
    text-align: left;
    border-bottom: 2px solid #bfdbfe;
  }
  td {
    padding: 9px 12px;
    font-size: 13px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
  }
  tr:nth-child(even) td { background: #f8fafc; }
  td.type { color: #3b82f6; }

  /* ===== 图表 ===== */
  .chart-box { margin: 16px 0; }
  .chart-box h3 { font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
  .chart-box .desc { font-size: 12px; color: #64748b; margin-bottom: 10px; line-height: 1.6; }
  .chart-box img {
    width: 100%;
    max-width: 100%;
    border-radius: 6px;
    border: 1px solid #f1f5f9;
  }
  .chart-box .chart-empty {
    background: #f8fafc;
    border: 1px dashed #e2e8f0;
    border-radius: 6px;
    text-align: center;
    padding: 48px 0;
    color: #94a3b8;
    font-size: 13px;
  }

  /* ===== 洞察卡片 ===== */
  .insight-stats {
    background: #f8fafc;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
  }
  .insight-stats span { margin-right: 18px; font-size: 13px; font-weight: 600; }
  .insight-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    margin: 10px 0;
    overflow: hidden;
    display: flex;
  }
  .insight-bar { width: 5px; flex-shrink: 0; }
  .insight-body { flex: 1; padding: 14px 16px; }
  .insight-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
    margin-right: 6px;
  }
  .insight-title { font-size: 15px; font-weight: 700; display: inline; vertical-align: middle; }
  .insight-meta { display: flex; gap: 12px; align-items: center; margin: 6px 0; }
  .insight-badge {
    display: inline-block;
    padding: 1px 9px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    opacity: 0.9;
  }
  .insight-conf { font-size: 11px; color: #94a3b8; }
  .insight-content { font-size: 13px; color: #475569; line-height: 1.7; }

  /* ===== 声明 ===== */
  .disclaimer { font-size: 12px; color: #94a3b8; line-height: 2; margin-top: 20mm; }
  .disclaimer strong { color: #64748b; }
</style>
</head>
<body>
${buildCoverHTML(result, now)}
${buildContentHTML(result, chartImages, now)}
</body>
</html>`
}

// ==================== 封面 ====================

function buildCoverHTML(r: AnalysisResult, now: string): string {
  return `
<div class="cover page">
  <h1>DataLens</h1>
  <h2>智能数据分析报告</h2>
  <div class="cover-meta">
    <div><span class="ml">报告文件</span>${esc(r.fileName)}</div>
    <div><span class="ml">生成时间</span>${esc(formatDate(r.uploadTime))}</div>
    <div><span class="ml">数据规模</span>${r.overview.rowCount.toLocaleString()} 行 × ${r.overview.colCount} 列</div>
    <div><span class="ml">数据缺失率</span>${r.overview.missingPercent.toFixed(1)}%</div>
    <div><span class="ml">重复行数</span>${r.overview.duplicateRows} 行</div>
  </div>
  <div class="cover-bottom">本报告由 DataLens 智能数据分析平台自动生成 · ${now}</div>
  <div class="cover-accent"></div>
</div>`
}

// ==================== 内容区 ====================

function buildContentHTML(r: AnalysisResult, chartImages: string[], now: string): string {
  let html = ''

  // ===== 一、执行摘要 =====
  html += buildSummaryHTML(r)

  // ===== 二、数据概览 =====
  html += buildOverviewHTML(r)

  // ===== 三、可视化图表 =====
  if (r.charts.length > 0) {
    html += buildChartsHTML(r.charts, chartImages)
  }

  // ===== 四、字段详情 =====
  html += buildFieldsHTML(r.columns)

  // ===== 五、洞察与建议 =====
  if (r.insights.length > 0) {
    html += buildInsightsHTML(r.insights)
  }

  // ===== 声明 =====
  html += buildDisclaimerHTML(now)

  return html
}

// ==================== 摘要 ====================

function buildSummaryHTML(r: AnalysisResult): string {
  const cards = [
    { label: '总行数', value: r.overview.rowCount.toLocaleString(), color: '#2563eb' },
    { label: '总列数', value: String(r.overview.colCount), color: '#3b82f6' },
    { label: '缺失值', value: `${r.overview.missingCells.toLocaleString()} (${r.overview.missingPercent.toFixed(1)}%)`, color: '#f59e0b' },
    { label: '重复行', value: String(r.overview.duplicateRows), color: '#ef4444' },
  ]

  // 核心发现（最多6条）
  let insightHTML = ''
  const top = r.insights.slice(0, 6)
  if (top.length > 0) {
    insightHTML = `<h4 style="font-size:15px;font-weight:700;color:#1e293b;margin:20px 0 10px 0;">核心发现</h4>`
    for (const ins of top) {
      const c = INSIGHT_COLORS[ins.type] || '#3b82f6'
      const label = INSIGHT_LABELS[ins.type] || '信息'
      insightHTML += `
      <div style="display:flex;align-items:flex-start;gap:8px;margin:6px 0;font-size:13px;line-height:1.6;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0;margin-top:6px;"></span>
        <span style="display:inline-block;background:${c};color:#fff;font-size:10px;font-weight:600;padding:1px 8px;border-radius:9px;flex-shrink:0;margin-top:3px;">${esc(label)}</span>
        <span style="color:#475569;">${esc(ins.title)}</span>
      </div>`
    }
  }

  return `
<div class="page">
  <div class="section">
    <div class="section-title">一、执行摘要</div>
    <div class="card-row">
      ${cards.map(c => `
        <div class="card">
          <div class="card-value" style="color:${c.color}">${esc(c.value)}</div>
          <div class="card-label">${esc(c.label)}</div>
        </div>
      `).join('')}
    </div>
    ${insightHTML}
  </div>
</div>`
}

// ==================== 数据概览 ====================

function buildOverviewHTML(r: AnalysisResult): string {
  const desc = `本次分析对文件「${esc(r.fileName)}」进行了全面的数据解读。该数据集共包含 ${r.overview.rowCount.toLocaleString()} 行记录和 ${r.overview.colCount} 个字段。`

  const rows = [
    ['总记录数', `${r.overview.rowCount.toLocaleString()} 行`, r.overview.rowCount >= 100 ? '样本量充足' : '样本量偏少'],
    ['字段数量', `${r.overview.colCount} 列`, r.overview.colCount >= 5 ? '维度丰富' : '维度较少'],
    ['缺失单元格', `${r.overview.missingCells.toLocaleString()} 个`, r.overview.missingPercent <= 5 ? '质量良好' : '需关注'],
    ['缺失比例', `${r.overview.missingPercent.toFixed(2)}%`, r.overview.missingPercent < 3 ? '可接受' : '建议处理'],
    ['完全重复行', `${r.overview.duplicateRows} 行`, r.overview.duplicateRows === 0 ? '无重复' : '存在重复'],
  ]

  return `
<div class="page">
  <div class="section">
    <div class="section-title">二、数据概览</div>
    <p style="font-size:13px;color:#64748b;margin-bottom:14px;line-height:1.7;">${desc}</p>
    <table>
      <thead><tr><th>数据维度</th><th>数值</th><th>评估</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td style="color:#64748b;">${esc(r[2])}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>
</div>`
}

// ==================== 图表 ====================

function buildChartsHTML(
  charts: Array<{ id: string; title: string; type: string; description: string }>,
  chartImages: string[]
): string {
  let boxes = ''
  for (let i = 0; i < charts.length; i++) {
    const ch = charts[i]
    const img = chartImages[i] || ''
    let chHTML = `<h3>${esc(ch.title)}</h3>`
    if (ch.description) chHTML += `<div class="desc">${esc(ch.description)}</div>`
    if (img) {
      chHTML += `<img src="${img}" alt="${esc(ch.title)}" />`
    } else {
      chHTML += `<div class="chart-empty">[${ch.type.toUpperCase()}] ${esc(ch.title)}</div>`
    }
    boxes += `<div class="chart-box">${chHTML}</div>`
  }

  return `
<div class="page">
  <div class="section">
    <div class="section-title">三、可视化图表</div>
    ${boxes}
  </div>
</div>`
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
    const nm = col.name.length > 12 ? col.name.slice(0, 11) + '..' : col.name
    const isNum = col.type === 'number'
    rowsHTML += `<tr>
      <td style="font-weight:500;">${esc(nm)}</td>
      <td class="type">${esc(TYPE_LABELS[col.type] || col.type)}</td>
      <td>${col.uniqueCount}</td>
      <td>${col.missingPercent.toFixed(1)}%</td>
      <td>${isNum && col.min != null ? fmtN(col.min) : '-'}</td>
      <td>${isNum && col.max != null ? fmtN(col.max) : '-'}</td>
      <td>${isNum && col.mean != null ? fmtN(col.mean) : '-'}</td>
    </tr>`
  }

  const nc = cols.filter(c => c.type === 'number').length
  const st = cols.filter(c => c.type === 'string').length
  const dt = cols.filter(c => c.type === 'date').length

  return `
<div class="page">
  <div class="section">
    <div class="section-title">四、字段详情</div>
    <table>
      <thead><tr><th>字段名</th><th>类型</th><th>唯一值</th><th>缺失率</th><th>最小值</th><th>最大值</th><th>均值</th></tr></thead>
      <tbody>${rowsHTML}</tbody>
    </table>
    <p style="font-size:12px;color:#94a3b8;margin-top:8px;">字段构成：${nc}个数值型 · ${st}个文本型 · ${dt}个日期型 · 共${cols.length}个字段</p>
  </div>
</div>`
}

// ==================== 洞察 ====================

function buildInsightsHTML(
  ins: Array<{ type: string; title: string; content: string; confidence: string }>
): string {
  const counts: Record<string, number> = {}
  for (const i of ins) counts[i.type] = (counts[i.type] || 0) + 1

  let statsHTML = ''
  for (const [tp, cnt] of Object.entries(counts)) {
    const c = INSIGHT_COLORS[tp] || '#3b82f6'
    const label = INSIGHT_LABELS[tp] || '信息'
    statsHTML += `<span style="color:${c};">● ${label} ${cnt}</span>`
  }

  let cardsHTML = ''
  for (let i = 0; i < ins.length; i++) {
    const item = ins[i]
    const c = INSIGHT_COLORS[item.type] || '#3b82f6'
    const cl = item.confidence === 'high' ? '高置信度' : item.confidence === 'medium' ? '中等置信度' : '参考性质'
    const label = INSIGHT_LABELS[item.type] || '信息'
    const num = String(i + 1).padStart(2, '0')

    cardsHTML += `
    <div class="insight-card">
      <div class="insight-bar" style="background:${c};"></div>
      <div class="insight-body">
        <div style="display:flex;align-items:center;margin-bottom:6px;">
          <span class="insight-num" style="background:${c};">${num}</span>
          <span class="insight-title" style="color:${c};">${esc(item.title)}</span>
        </div>
        <div class="insight-meta">
          <span class="insight-badge" style="background:${c};">${esc(label)}</span>
          <span class="insight-conf">${esc(cl)}</span>
        </div>
        <div class="insight-content">${esc(item.content)}</div>
      </div>
    </div>`
  }

  return `
<div class="page">
  <div class="section">
    <div class="section-title">五、洞察与建议</div>
    <div class="insight-stats">
      ${statsHTML}
    </div>
    ${cardsHTML}
  </div>
</div>`
}

// ==================== 声明 ====================

function buildDisclaimerHTML(now: string): string {
  return `
<div class="page">
  <div class="disclaimer">
    <p><strong>报告声明：</strong>本报告由 DataLens 智能数据分析平台基于规则引擎自动生成，仅供参考。分析结果受数据质量和算法限制影响，不构成任何业务决策建议。</p>
    <p style="margin-top:8px;"><strong>数据处理：</strong>所有数据均在浏览器本地完成处理和分析，不会上传至任何外部服务器，确保数据安全与隐私。</p>
    <p style="margin-top:8px;"><strong>生成时间：</strong>${now}</p>
  </div>
</div>`
}

// ============ 工具函数 ============

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fmtN(n: number | undefined): string {
  if (n == null) return '-'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'K'
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
  document.querySelectorAll('.echarts-container').forEach(el => {
    if (el instanceof HTMLDivElement && el.offsetWidth > 0) els.push(el)
  })
  if (els.length === 0) {
    document.querySelectorAll('.echarts-for-react').forEach(el => {
      if (el instanceof HTMLDivElement && el.offsetWidth > 0) els.push(el)
    })
  }
  return els
}
