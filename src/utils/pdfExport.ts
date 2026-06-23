// PDF导出工具 - html2canvas 完整渲染方案
// 核心思路：浏览器原生渲染中文 → html2canvas截图 → jsPDF拼页，彻底避免jsPDF字体问题
//
// A4尺寸对应：
//   像素（@96dpi）: 794 × 1122
//   毫米：210 × 297
//   html2canvas scale=2 → canvas: 1588 × 2244/页

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { AnalysisResult } from '../types'

// ============ 常量 ============

/** 报告内容宽度（px，对应A4 210mm - 左右边距） */
const RW = 760
/** A4 一页高度（px @96dpi） */
const PH_PX = 1122
/** html2canvas 缩放倍率 */
const SCALE = 2
/** 边距 */
const PAD = 32

/** 中文标题英文字体（DataLens品牌） */
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

  // 第2步：生成完整报告HTML
  const html = buildReportHTML(result, chartImages)

  // 第3步：挂载到隐藏容器，等图片加载完
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;z-index:99999;'
  container.innerHTML = html
  document.body.appendChild(container)

  // 等待图片加载
  const imgs = container.querySelectorAll('img')
  await Promise.all(Array.from(imgs).map(
    img => img.complete ? Promise.resolve() : new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r() })
  ))
  await new Promise(r => setTimeout(r, 200))

  // 第4步：html2canvas 整体截图
  const fullCanvas = await html2canvas(container, {
    scale: SCALE,
    backgroundColor: '#ffffff',
    logging: false,
    useCORS: true,
    allowTaint: true,
  })

  document.body.removeChild(container)

  // 第5步：按页裁切，逐页放入 jsPDF
  const pageH = PH_PX * SCALE // 2244
  const totalPages = Math.ceil(fullCanvas.height / pageH)

  const pdf = new jsPDF('p', 'mm', 'a4')

  for (let p = 0; p < totalPages; p++) {
    if (p > 0) pdf.addPage()

    const sy = p * pageH
    const sh = Math.min(pageH, fullCanvas.height - sy)

    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = fullCanvas.width
    pageCanvas.height = sh
    const ctx = pageCanvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
    ctx.drawImage(fullCanvas, 0, sy, fullCanvas.width, sh, 0, 0, fullCanvas.width, sh)

    pdf.addImage(pageCanvas.toDataURL('image/png', 0.95), 'PNG', 0, 0, 210, (sh / fullCanvas.width) * 210)
  }

  const safeName = result.fileName.replace(/[^\w\u4e00-\u9fa5.-]/g, '_')
  pdf.save(`${safeName}_数据分析报告.pdf`)
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
  const css = reportCSS()

  let html = `<div style="font-family:-apple-system,'Microsoft YaHei','PingFang SC','Noto Sans SC',sans-serif;color:#1e293b;background:#fff;width:794px;margin:0 auto;box-sizing:border-box;">`

  // ===== 封面 =====
  html += buildCoverHTML(result, now)

  // ===== 内容区（从新页开始） =====
  html += `<div class="page-start"></div>`

  // ===== 一、执行摘要 =====
  html += buildSummaryHTML(result)

  // ===== 二、数据概览 =====
  html += buildOverviewHTML(result)

  // ===== 三、可视化图表 =====
  if (result.charts.length > 0) {
    html += buildChartsHTML(result.charts, chartImages)
  }

  // ===== 四、字段详情 =====
  html += buildFieldsHTML(result.columns)

  // ===== 五、洞察与建议 =====
  if (result.insights.length > 0) {
    html += buildInsightsHTML(result.insights)
  }

  // ===== 尾部声明 =====
  html += buildDisclaimerHTML(now)

  html += `</div>${css}`
  return html
}

// ==================== 报告CSS ====================

function reportCSS(): string {
  return `
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  .page-start { page-break-before:always; break-before:page; height:1px; margin:0; }
  .page-footer { height:50px; border-top:1px solid #e2e8f0; text-align:center; padding-top:14px; font-size:12px; color:#94a3b8; }
  .section { padding:${PAD}px ${PAD}px 0 ${PAD}px; }
  .section-title { font-size:22px; font-weight:700; color:#2563eb; padding-left:14px; border-left:4px solid #2563eb; margin-bottom:18px; line-height:1.3; }
  .card-row { display:flex; gap:14px; margin:14px 0; }
  .card { flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px 12px; text-align:center; }
  .card-value { font-size:26px; font-weight:700; }
  .card-label { font-size:12px; color:#64748b; margin-top:4px; }
  table { width:100%; border-collapse:collapse; margin:12px 0; }
  th { background:#eff6ff; color:#1e40af; font-size:13px; font-weight:600; padding:10px 12px; text-align:left; border-bottom:2px solid #bfdbfe; }
  td { padding:9px 12px; font-size:12px; border-bottom:1px solid #f1f5f9; }
  tr:nth-child(even) td { background:#f8fafc; }
  .chart-box { margin:16px 0; }
  .chart-box h3 { font-size:15px; font-weight:700; color:#1e293b; margin-bottom:4px; }
  .chart-box p { font-size:12px; color:#64748b; margin-bottom:8px; line-height:1.5; }
  .chart-box img { width:100%; max-width:100%; border-radius:6px; border:1px solid #f1f5f9; }
  .insight-card { background:#fff; border:1px solid #e2e8f0; border-radius:8px; margin:10px 0; overflow:hidden; display:flex; }
  .insight-bar { width:5px; flex-shrink:0; }
  .insight-body { flex:1; padding:14px 16px; }
  .insight-title { font-size:14px; font-weight:700; margin-bottom:4px; }
  .insight-meta { display:flex; gap:16px; align-items:center; margin-bottom:6px; }
  .insight-badge { display:inline-block; padding:1px 8px; border-radius:10px; font-size:11px; font-weight:600; background:var(--bc); color:#fff; opacity:0.9; }
  .insight-confidence { font-size:11px; color:#94a3b8; }
  .insight-content { font-size:12px; color:#475569; line-height:1.6; }
  .disclaimer { font-size:12px; color:#94a3b8; line-height:1.8; padding:20px 0 0 0; }
  .disclaimer p { margin:4px 0; }
  .cover { background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 40%,#3b82f6 100%); color:#fff; padding:80px ${PAD}px 40px ${PAD}px; position:relative; min-height:500px; }
  .cover-accent { position:absolute; bottom:0; left:0; right:0; height:5px; background:#f59e0b; }
  .cover h1 { font-size:40px; font-weight:800; letter-spacing:1px; }
  .cover h2 { font-size:20px; font-weight:400; opacity:0.9; margin-top:12px; }
  .cover-meta { margin-top:60px; display:grid; grid-template-columns:80px 1fr; gap:10px 20px; font-size:14px; }
  .cover-meta-label { opacity:0.7; }
  .cover-bottom { font-size:11px; opacity:0.6; margin-top:80px; text-align:center; }
</style>`
}

// ==================== 封面 ====================

function buildCoverHTML(r: AnalysisResult, now: string): string {
  return `
<div class="cover">
  <h1>DataLens</h1>
  <h2>智能数据分析报告</h2>
  <div class="cover-meta">
    <span class="cover-meta-label">报告文件：</span><span>${esc(r.fileName)}</span>
    <span class="cover-meta-label">生成时间：</span><span>${esc(formatDate(r.uploadTime))}</span>
    <span class="cover-meta-label">数据规模：</span><span>${r.overview.rowCount.toLocaleString()} 行 × ${r.overview.colCount} 列</span>
    <span class="cover-meta-label">数据缺失率：</span><span>${r.overview.missingPercent.toFixed(1)}%</span>
    <span class="cover-meta-label">重复行数：</span><span>${r.overview.duplicateRows} 行</span>
  </div>
  <div class="cover-bottom">本报告由 DataLens 智能数据分析平台自动生成 · ${now}</div>
  <div class="cover-accent"></div>
</div>`
}

// ==================== 摘要 ====================

function buildSummaryHTML(r: AnalysisResult): string {
  const cards = [
    { label: '总行数', value: r.overview.rowCount.toLocaleString(), color: '#2563eb' },
    { label: '总列数', value: String(r.overview.colCount), color: '#3b82f6' },
    { label: '缺失值', value: `${r.overview.missingCells.toLocaleString()} (${r.overview.missingPercent.toFixed(1)}%)`, color: '#f59e0b' },
    { label: '重复行', value: String(r.overview.duplicateRows), color: '#ef4444' },
  ]

  const topInsights = r.insights.slice(0, 6)
  let insightHTML = ''
  if (topInsights.length > 0) {
    insightHTML = `<h3 style="font-size:15px;font-weight:700;color:#1e293b;margin:20px 0 10px 0;">核心发现</h3>`
    for (const ins of topInsights) {
      const c = INSIGHT_COLORS[ins.type] || '#3b82f6'
      const label = INSIGHT_LABELS[ins.type] || '信息'
      insightHTML += `
      <div style="display:flex;align-items:flex-start;gap:10px;margin:8px 0;font-size:13px;line-height:1.5;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0;margin-top:5px;"></span>
        <span style="display:inline-block;background:${c};color:#fff;font-size:10px;font-weight:600;padding:1px 7px;border-radius:9px;flex-shrink:0;margin-top:2px;">${esc(label)}</span>
        <span style="color:#475569;">${esc(ins.title)}</span>
      </div>`
    }
  }

  return `
  <div class="page-start"></div>
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
    <div class="page-footer"></div>
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
  <div class="page-start"></div>
  <div class="section">
    <div class="section-title">二、数据概览</div>
    <p style="font-size:13px;color:#64748b;margin-bottom:14px;line-height:1.6;">${desc}</p>
    <table>
      <thead><tr><th>数据维度</th><th>数值</th><th>评估</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td style="color:#64748b;">${esc(r[2])}</td></tr>`).join('')}
      </tbody>
    </table>
    <div class="page-footer"></div>
  </div>`
}

// ==================== 图表 ====================

function buildChartsHTML(
  charts: Array<{ id: string; title: string; type: string; description: string }>,
  chartImages: string[]
): string {
  let html = `<div class="page-start"></div><div class="section"><div class="section-title">三、可视化图表</div>`

  for (let i = 0; i < charts.length; i++) {
    const ch = charts[i]
    const img = chartImages[i] || ''
    html += `<div class="chart-box">`
    html += `<h3>${esc(ch.title)}</h3>`
    if (ch.description) html += `<p>${esc(ch.description)}</p>`
    if (img) {
      html += `<img src="${img}" alt="${esc(ch.title)}" style="display:block;" />`
    } else {
      html += `<div style="background:#f8fafc;border:1px dashed #e2e8f0;border-radius:6px;text-align:center;padding:40px 0;color:#94a3b8;font-size:13px;">[${ch.type.toUpperCase()}] ${esc(ch.title)}</div>`
    }
    html += `</div>`
  }

  html += `<div class="page-footer"></div></div>`
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
    const nm = col.name.length > 10 ? col.name.slice(0, 9) + '..' : col.name
    const isNum = col.type === 'number'
    rowsHTML += `<tr>
      <td style="font-weight:500;">${esc(nm)}</td>
      <td style="color:#3b82f6;">${esc(TYPE_LABELS[col.type] || col.type)}</td>
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
  <div class="page-start"></div>
  <div class="section">
    <div class="section-title">四、字段详情</div>
    <table>
      <thead><tr><th>字段名</th><th>类型</th><th>唯一值</th><th>缺失率</th><th>最小值</th><th>最大值</th><th>均值</th></tr></thead>
      <tbody>${rowsHTML}</tbody>
    </table>
    <p style="font-size:12px;color:#94a3b8;margin-top:8px;">字段构成：${nc}个数值型 · ${st}个文本型 · ${dt}个日期型 · 共${cols.length}个字段</p>
    <div class="page-footer"></div>
  </div>`
}

// ==================== 洞察 ====================

function buildInsightsHTML(
  ins: Array<{ type: string; title: string; content: string; confidence: string }>
): string {
  // 分类统计
  const counts: Record<string, number> = {}
  for (const i of ins) counts[i.type] = (counts[i.type] || 0) + 1

  let statsHTML = ''
  for (const [tp, cnt] of Object.entries(counts)) {
    const c = INSIGHT_COLORS[tp] || '#3b82f6'
    const label = INSIGHT_LABELS[tp] || '信息'
    statsHTML += `<span style="display:inline-block;margin-right:16px;color:${c};font-size:12px;font-weight:600;">● ${label} ${cnt}</span>`
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
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:${c};color:#fff;font-size:11px;font-weight:700;flex-shrink:0;">${num}</span>
          <span class="insight-title" style="color:${c};">${esc(item.title)}</span>
        </div>
        <div class="insight-meta">
          <span class="insight-badge" style="--bc:${c};">${esc(label)}</span>
          <span class="insight-confidence">${esc(cl)}</span>
        </div>
        <div class="insight-content">${esc(item.content)}</div>
      </div>
    </div>`
  }

  return `
  <div class="page-start"></div>
  <div class="section">
    <div class="section-title">五、洞察与建议</div>
    <div style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
      ${statsHTML}
    </div>
    ${cardsHTML}
    <div class="page-footer"></div>
  </div>`
}

// ==================== 声明 ====================

function buildDisclaimerHTML(now: string): string {
  return `
  <div class="page-start"></div>
  <div class="section" style="padding-bottom:40px;">
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
