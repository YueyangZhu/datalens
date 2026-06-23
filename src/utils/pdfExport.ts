// PDF导出工具 - 直接渲染方案
// 流程：ECharts截图 → 生成报告HTML → 可见容器渲染 → html2canvas截图 → jsPDF生成PDF → 自动下载

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import * as echarts from 'echarts'
import type { AnalysisResult } from '../types'

// ============ 常量 ============

const REPORT_WIDTH = 794
const PAGE_HEIGHT = 1122
const SCALE = 2
const PAD = '10mm'

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

  // Step 2: 构建报告HTML（内联style确保样式生效）
  const html = buildReportHTML(result, chartImages)

  // Step 3: 创建覆盖层容器（visible，让浏览器正常计算布局）
  const overlay = document.createElement('div')
  overlay.style.cssText = `
    position: fixed;
    z-index: 99999;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.6);
    overflow-y: auto;
    display: flex;
    justify-content: center;
    padding: 20px 0;
  `

  const container = document.createElement('div')
  container.style.cssText = `
    width: ${REPORT_WIDTH}px;
    background: #fff;
  `
  container.innerHTML = html
  overlay.appendChild(container)

  // 添加"正在生成报告..."提示
  const tip = document.createElement('div')
  tip.style.cssText = `
    position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
    background: #1d4ed8; color: white; padding: 8px 24px; border-radius: 20px;
    font-size: 14px; z-index: 100000; font-family: 'Microsoft YaHei',sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `
  tip.textContent = '正在生成PDF报告...'
  overlay.appendChild(tip)

  document.body.appendChild(overlay)

  // 等待浏览器完成布局计算
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => {
    void container.offsetHeight
    r()
  })))

  // Step 4: html2canvas 截图
  let fullCanvas: HTMLCanvasElement
  try {
    fullCanvas = await html2canvas(container, {
      scale: SCALE,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      allowTaint: true,
      width: REPORT_WIDTH,
    })
  } finally {
    // 移除覆盖层
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay)
    }
  }

  if (fullCanvas.width === 0 || fullCanvas.height === 0) {
    throw new Error('报告渲染失败，请刷新页面后重试')
  }

  // Step 5: 按 A4 高度裁切成页
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
    const drawH = (sh / fullCanvas.width) * 210
    pdf.addImage(dataUrl, 'PNG', 0, 0, 210, drawH)
  }

  // Step 6: 下载
  const safeName = result.fileName.replace(/[^\w\u4e00-\u9fa5.\-]/g, '_')
  pdf.save(`${safeName}_数据分析报告.pdf`)
}

// ============ 图表截图 ============

async function captureChartImages(chartElements: HTMLDivElement[]): Promise<string[]> {
  const images: string[] = []
  for (const el of chartElements) {
    try {
      if (el.offsetWidth === 0 || el.offsetHeight === 0) { images.push(''); continue }

      const inst = echarts.getInstanceByDom(el)
      if (inst) {
        try {
          const url = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })
          if (url && url.length > 100) { images.push(url); continue }
        } catch {}
      }

      const cvs = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#fff', logging: false })
      images.push(cvs.width > 0 && cvs.height > 0 ? cvs.toDataURL('image/png', 0.92) : '')
    } catch {
      images.push('')
    }
  }
  return images
}

// ============ 报告HTML生成 ============

function buildReportHTML(r: AnalysisResult, chartImages: string[]): string {
  const now = new Date().toLocaleString('zh-CN')
  return `<style>${getCSS()}</style>` + buildBodyHTML(r, now, chartImages)
}

function getCSS(): string {
  return `
*{margin:0;padding:0;box-sizing:border-box;}
body, .report-body{font-family:-apple-system,'Microsoft YaHei','PingFang SC',sans-serif;color:#1e293b;font-size:13px;line-height:1.75;}
.page{width:794px;min-height:1122px;padding:${PAD};background:#fff;position:relative;overflow:hidden;}
.cover{background:linear-gradient(145deg,#1d4ed8,#2563eb 50%,#3b82f6);color:#fff;min-height:1122px;display:flex;flex-direction:column;justify-content:center;padding:100px ${PAD};position:relative;}
.cover-stripe{position:absolute;bottom:0;left:0;right:0;height:5px;background:#f59e0b;}
.cover h1{font-size:52px;font-weight:800;letter-spacing:2px;margin-bottom:12px;}
.cover h2{font-size:22px;font-weight:400;opacity:.88;margin-bottom:56px;}
.cover-meta{font-size:15px;opacity:.82;line-height:2.3;}
.cover-meta em{font-style:normal;opacity:.6;display:inline-block;width:80px;}
.cover-bottom{position:absolute;bottom:10vh;left:${PAD};right:${PAD};text-align:center;font-size:11px;opacity:.45;}
.section-title{font-size:20px;font-weight:700;color:#2563eb;padding-left:12px;border-left:4px solid #2563eb;margin-bottom:16px;}
.desc{font-size:13px;color:#64748b;margin-bottom:14px;}
.cards{display:flex;gap:12px;margin:12px 0 16px 0;}
.card{flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:18px 14px;text-align:center;}
.card-val{font-size:26px;font-weight:700;}
.card-lbl{font-size:12px;color:#64748b;margin-top:4px;}
table{width:100%;border-collapse:collapse;margin:10px 0 16px 0;}
th{background:#eff6ff;color:#1e40af;font-size:12px;font-weight:600;padding:10px 12px;text-align:left;border-bottom:2px solid #bfdbfe;}
td{padding:8px 12px;font-size:12px;border-bottom:1px solid #f1f5f9;color:#334155;}
tr:nth-child(even) td{background:#f8fafc;}
td.type{color:#3b82f6;}
td.assess{color:#64748b;}
.chart-box{margin:16px 0;}
.chart-box h3{font-size:15px;font-weight:700;color:#1e293b;margin-bottom:4px;}
.chart-box .desc{font-size:12px;color:#64748b;margin-bottom:8px;}
.chart-box img{width:100%;border-radius:6px;border:1px solid #f1f5f9;}
.chart-empty{background:#f8fafc;border:1px dashed #e2e8f0;border-radius:6px;text-align:center;padding:44px 0;color:#94a3b8;font-size:13px;}
.insight-stats{background:#f8fafc;border-radius:8px;padding:10px 16px;margin-bottom:14px;}
.insight-stats span{margin-right:16px;font-size:12px;font-weight:600;}
.ins-card{background:#fff;border:1px solid #e2e8f0;border-radius:8px;margin:8px 0;display:flex;overflow:hidden;}
.ins-bar{width:5px;flex-shrink:0;}
.ins-body{flex:1;padding:12px 14px;}
.ins-hdr{display:flex;align-items:center;gap:8px;margin-bottom:4px;}
.ins-hdr .num{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;color:#fff;font-size:11px;font-weight:700;flex-shrink:0;}
.ins-hdr .title{font-size:14px;font-weight:700;}
.ins-meta{display:flex;gap:10px;align-items:center;margin:4px 0;}
.ins-meta .badge{display:inline-block;padding:1px 8px;border-radius:10px;font-size:10px;font-weight:600;color:#fff;opacity:.88;}
.ins-meta .conf{font-size:11px;color:#94a3b8;}
.ins-body .body{font-size:12px;color:#475569;line-height:1.75;}
.summary-block{background:linear-gradient(135deg,#eff6ff,#f0f9ff);border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;margin:16px 0;font-size:13px;line-height:1.85;color:#1e40af;}
.summary-block strong{color:#1d4ed8;}
.footer-section{margin-top:30px;}
.footer-section p{font-size:12px;color:#94a3b8;line-height:2;margin:4px 0;}
.footer-section strong{color:#64748b;}
`
}

function buildBodyHTML(r: AnalysisResult, now: string, chartImages: string[]): string {
  return `
<div class="report-body">
  ${page('cover', buildCover(r, now))}
  ${h('一、执行摘要', buildSummary(r))}
  ${h('二、数据概览', buildOverview(r))}
  ${r.charts.length > 0 ? h('三、可视化图表', buildCharts(r.charts, chartImages)) : ''}
  ${h('四、字段详情', buildFields(r.columns))}
  ${r.insights.length > 0 ? h('五、洞察与建议', buildInsights(r)) : ''}
  ${page('', buildFooter())}
</div>`
}

function page(cls: string, content: string): string {
  return `<div class="page ${cls}">${content}</div>`
}

function h(title: string, content: string): string {
  return page('', `<div class="section-title">${title}</div>${content}`)
}

function buildCover(r: AnalysisResult, now: string): string {
  return `<h1>DataLens</h1><h2>智能数据分析报告</h2>
<div class="cover-meta">
<div><em>报告文件</em>${e(r.fileName)}</div>
<div><em>生成时间</em>${e(fmtDate(r.uploadTime))}</div>
<div><em>数据规模</em>${r.overview.rowCount.toLocaleString()} 行 x ${r.overview.colCount} 列</div>
<div><em>缺失率</em>${r.overview.missingPercent.toFixed(1)}%</div>
<div><em>重复行</em>${r.overview.duplicateRows} 行</div>
</div>
<div class="cover-bottom">本报告由 DataLens 智能数据分析平台自动生成 · ${now}</div>
<div class="cover-stripe"></div>`
}

function buildSummary(r: AnalysisResult): string {
  const cards: [string, string, string][] = [
    ['总行数', r.overview.rowCount.toLocaleString(), '#2563eb'],
    ['总列数', String(r.overview.colCount), '#3b82f6'],
    ['缺失值', `${r.overview.missingCells.toLocaleString()} (${r.overview.missingPercent.toFixed(1)}%)`, '#f59e0b'],
    ['重复行', String(r.overview.duplicateRows), '#ef4444'],
  ]

  let desc = `本次分析对文件「${e(r.fileName)}」进行了解读。数据集包含 ${r.overview.rowCount.toLocaleString()} 行记录，${r.overview.colCount} 个字段。`
  desc += r.overview.missingPercent <= 3
    ? `数据质量良好，缺失率仅 ${r.overview.missingPercent.toFixed(1)}%。`
    : `数据存在一定缺失（${r.overview.missingPercent.toFixed(1)}%），建议关注数据质量。`
  if (r.overview.duplicateRows > 0) desc += `发现 ${r.overview.duplicateRows} 行重复记录。`
  const nc = r.columns.filter(c => c.type === 'number').length
  const sc = r.columns.filter(c => c.type === 'string').length
  const dc = r.columns.filter(c => c.type === 'date').length
  desc += `字段类型分布：${nc} 个数值型、${sc} 个文本型、${dc} 个日期型。`

  let conc = ''
  if (r.insights.length > 0) {
    const pos = r.insights.filter(i => i.type === 'positive').length
    const neg = r.insights.filter(i => i.type === 'negative').length
    const top = r.insights.slice(0, 2)
    conc = `<p style="margin-top:12px;padding:10px 14px;background:#f8fafc;border-radius:6px;color:#334155;font-size:12px;line-height:1.8;">
<strong>核心结论：</strong>本次分析共生成 ${r.insights.length} 条洞察`
    if (pos > 0 || neg > 0) conc += `（${pos > 0 ? `优势 ${pos} 条` : ''}${pos > 0 && neg > 0 ? '、' : ''}${neg > 0 ? `风险 ${neg} 条` : ''}）`
    conc += `。关键发现包括：${e(top.map(t => t.title).join('、'))}。`
    if (neg > 0) conc += `建议优先关注风险项，结合业务背景排查。`
    else if (pos > 0) conc += `可围绕优势项制定业务优化策略。`
    conc += `</p>`
  } else {
    conc = `<p style="margin-top:12px;padding:10px 14px;background:#f8fafc;border-radius:6px;color:#334155;font-size:12px;line-height:1.8;">
<strong>核心结论：</strong>本次分析完成数据结构与质量评估，未生成深度洞察。建议上传更完整的数据或补充更多维度的字段。</p>`
  }

  return `<p class="desc">${desc}</p>
<div class="cards">
${cards.map(c => `<div class="card"><div class="card-val" style="color:${c[2]}">${e(c[1])}</div><div class="card-lbl">${e(c[0])}</div></div>`).join('')}
</div>${conc}`
}

function buildOverview(r: AnalysisResult): string {
  const nc = r.columns.filter(c => c.type === 'number').length
  const sc = r.columns.filter(c => c.type === 'string').length
  const dc = r.columns.filter(c => c.type === 'date').length

  const rows: [string, string, string][] = [
    ['总记录数', `${r.overview.rowCount.toLocaleString()} 行`, r.overview.rowCount >= 100 ? '样本量充足，可信度高' : '样本量偏少，仅供参考'],
    ['字段数量', `${r.overview.colCount} 列`, r.overview.colCount >= 5 ? '维度丰富' : '维度较少'],
    ['有效单元格', `${(r.overview.rowCount * r.overview.colCount - r.overview.missingCells).toLocaleString()} 个`, r.overview.missingPercent <= 3 ? '数据完整' : '存在缺失'],
    ['缺失值', `${r.overview.missingCells.toLocaleString()} 个 (${r.overview.missingPercent.toFixed(2)}%)`, r.overview.missingPercent <= 1 ? '可忽略' : r.overview.missingPercent <= 5 ? '可接受' : '需处理'],
    ['重复行', `${r.overview.duplicateRows} 行`, r.overview.duplicateRows === 0 ? '无重复' : '需检查'],
  ]

  return `<p class="desc">以下是对数据集结构、完整性和字段分布的详细评估。</p>
<table><thead><tr><th>数据维度</th><th>数值</th><th>分析</th></tr></thead><tbody>
${rows.map(x => `<tr><td><strong>${e(x[0])}</strong></td><td>${e(x[1])}</td><td class="assess">${e(x[2])}</td></tr>`).join('')}
</tbody></table>
<p class="desc">字段构成：${nc} 个数值型（适合统计指标）、${sc} 个文本型（适合分类汇总）、${dc} 个日期型（适合时间序列分析）。</p>`
}

function buildCharts(charts: Array<{ id: string; title: string; type: string; description: string }>, images: string[]): string {
  let s = `<p class="desc">共生成 ${charts.length} 张可视化图表。</p>`
  for (let i = 0; i < charts.length; i++) {
    const ch = charts[i], img = images[i]
    s += `<div class="chart-box"><h3>${e(ch.title)}</h3>`
    if (ch.description) s += `<div class="desc">${e(ch.description)}</div>`
    s += img ? `<img src="${img}" alt="${e(ch.title)}"/>` : `<div class="chart-empty">[${ch.type.toUpperCase()}] ${e(ch.title)} — 图表未捕获</div>`
    s += `</div>`
  }
  return s
}

function buildFields(cols: Array<{ name: string; type: string; uniqueCount: number; missingCount: number; missingPercent: number; min?: number; max?: number; mean?: number; std?: number }>): string {
  let rows = ''
  const nc = cols.filter(c => c.type === 'number').length
  const sc = cols.filter(c => c.type === 'string').length
  const dc = cols.filter(c => c.type === 'date').length
  for (const c of cols) {
    const nm = c.name.length > 14 ? c.name.slice(0, 13) + '…' : c.name
    const isN = c.type === 'number'
    rows += `<tr>
<td style="font-weight:500">${e(nm)}</td>
<td class="type">${e(TYPE_LABELS[c.type] || c.type)}</td>
<td>${c.uniqueCount.toLocaleString()}</td>
<td style="color:${c.missingPercent > 10 ? '#ef4444' : c.missingPercent > 5 ? '#f59e0b' : '#334155'}">${c.missingPercent.toFixed(1)}%</td>
<td>${isN && c.min != null ? n(c.min) : '-'}</td>
<td>${isN && c.max != null ? n(c.max) : '-'}</td>
<td>${isN && c.mean != null ? n(c.mean) : '-'}</td>
<td>${isN && c.std != null ? n(c.std) : '-'}</td>
</tr>`
  }
  return `<p class="desc">以下列出数据集中所有字段的基本统计信息。</p>
<table><thead><tr><th>字段名</th><th>类型</th><th>唯一值</th><th>缺失率</th><th>最小值</th><th>最大值</th><th>均值</th><th>标准差</th></tr></thead><tbody>${rows}</tbody></table>
<p style="font-size:12px;color:#94a3b8;margin-top:6px;">共 ${cols.length} 个字段：${nc} 数值型 · ${sc} 文本型 · ${dc} 日期型</p>`
}

function buildInsights(r: AnalysisResult): string {
  const ins = r.insights
  const counts: Record<string, number> = {}
  for (const i of ins) counts[i.type] = (counts[i.type] || 0) + 1

  let statsHTML = ''
  for (const [tp, cnt] of Object.entries(counts)) {
    const c = INSIGHT_COLORS[tp] || '#3b82f6'
    statsHTML += `<span style="color:${c};">● ${INSIGHT_LABELS[tp] || '信息'} ${cnt} 条</span>`
  }

  const pos = counts['positive'] || 0
  const neg = counts['negative'] || 0
  let desc = `本次分析共发现 ${ins.length} 条洞察。其中优势 ${pos} 条，风险 ${neg} 条。`
  if (neg > 0) desc += `建议优先关注风险项。`

  let cards = ''
  for (let i = 0; i < ins.length; i++) {
    const item = ins[i]
    const c = INSIGHT_COLORS[item.type] || '#3b82f6'
    const lb = INSIGHT_LABELS[item.type] || '信息'
    const cl = item.confidence === 'high' ? '高置信度' : item.confidence === 'medium' ? '中等置信度' : '需验证'
    const cConf = item.confidence === 'high' ? c : item.confidence === 'medium' ? '#f59e0b' : '#94a3b8'
    cards += `<div class="ins-card"><div class="ins-bar" style="background:${c};"></div><div class="ins-body">
<div class="ins-hdr"><span class="num" style="background:${c};">${String(i + 1).padStart(2, '0')}</span><span class="title" style="color:${c};">${e(item.title)}</span></div>
<div class="ins-meta"><span class="badge" style="background:${c};">${e(lb)}</span><span class="conf" style="color:${cConf};">${e(cl)}</span></div>
<div class="body">${e(item.content)}</div></div></div>`
  }

  return `<p class="desc">${desc}</p><div class="insight-stats">${statsHTML}</div>${cards}
<div class="summary-block"><strong>📊 综合建议：</strong>基于 ${r.overview.rowCount.toLocaleString()} 行数据的分析，${r.overview.missingPercent <= 3 ? '数据整体质量良好。' : '建议优先处理数据缺失问题。'}${ins.length > 5 ? `共发现 ${ins.length} 条洞察，建议逐条复核。` : '洞察数量有限，建议上传更全面的数据。'}</div>`
}

function buildFooter(): string {
  return `<div class="footer-section">
<p><strong>报告声明</strong>：本报告由 DataLens 智能数据分析平台基于规则引擎自动生成，仅供决策参考。</p>
<p><strong>数据安全</strong>：所有数据均在浏览器本地完成处理和分析，不会上传至外部服务器。</p>
<p><strong>生成时间</strong>：${new Date().toLocaleString('zh-CN')}</p>
</div>`
}

// ============ 工具函数 ============

function e(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function n(v: number | undefined): string {
  if (v == null) return '-'
  if (Math.abs(v) >= 1e7) return (v / 1e6).toFixed(1) + 'M'
  if (Math.abs(v) >= 10000) return (v / 1000).toFixed(1) + 'K'
  if (Math.abs(v) >= 1000) return v.toLocaleString()
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

function fmtDate(ds: string): string {
  try { return new Date(ds).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return ds }
}

// ============ 收集图表元素 ============

export function collectChartElements(): HTMLDivElement[] {
  const els: HTMLDivElement[] = []
  document.querySelectorAll('.echarts-for-react').forEach(el => {
    if (el instanceof HTMLDivElement && el.offsetWidth > 0 && el.offsetHeight > 0) {
      const cv = el.querySelector('canvas')
      if (cv && (cv.width === 0 || cv.height === 0)) return
      els.push(el)
    }
  })
  if (els.length === 0) {
    document.querySelectorAll('.echarts-container').forEach(p => {
      const c = p.querySelector('.echarts-for-react')
      if (c instanceof HTMLDivElement && c.offsetWidth > 0 && c.offsetHeight > 0) {
        const cv = c.querySelector('canvas')
        if (cv && (cv.width === 0 || cv.height === 0)) return
        els.push(c)
      }
    })
  }
  return els
}
