// PDF导出工具 - 浏览器原生打印方案
// 最可靠：生成HTML → 新窗口 → 自动打印 → 自动关闭，浏览器原生渲染中文

import * as echarts from 'echarts'
import type { AnalysisResult } from '../types'

const PAD = '10mm'
const MISSING_THRESHOLD = 10

const TYPE_CN: Record<string, string> = {
  number: '数值型', string: '文本型', date: '日期型', boolean: '布尔型',
}
const INSIGHT_CN: Record<string, string> = {
  positive: '优势', negative: '风险', warning: '注意', info: '信息',
}
const INSIGHT_COLORS: Record<string, string> = {
  positive: '#16a34a', negative: '#ef4444', warning: '#f59e0b', info: '#3b82f6',
}

export async function exportToPDFReport(
  result: AnalysisResult,
  chartElements?: HTMLDivElement[]
): Promise<void> {
  // 截图图表
  const chartImages: string[] = []
  if (chartElements) {
    for (const el of chartElements) {
      try {
        if (el.offsetWidth === 0 || el.offsetHeight === 0) { chartImages.push(''); continue }
        const inst = echarts.getInstanceByDom(el)
        if (inst) {
          const url = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })
          if (url && url.length > 100) { chartImages.push(url); continue }
        }
        chartImages.push('')
      } catch { chartImages.push('') }
    }
  }

  const html = buildFullHTML(result, chartImages)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank')
  if (!w) {
    // 如果弹窗被拦截，使用下载HTML方式
    const a = document.createElement('a')
    a.href = url
    a.download = `${result.fileName.replace(/[^\w\u4e00-\u9fa5.-]/g, '_')}_报告.html`
    a.click()
    URL.revokeObjectURL(url)
    throw new Error('弹窗被拦截，已将报告下载为HTML文件，可手动打印为PDF')
  }
  
  w.onload = () => {
    // 等待渲染完成
    setTimeout(() => {
      w.print()
      // 打印对话框关闭后自动关闭窗口
      w.addEventListener('afterprint', () => w.close())
      // 备选：一定时间后关闭
      setTimeout(() => {
        try { w.close() } catch {}
      }, 60000)
    }, 1000)
  }
  
  // 清理 blob URL
  setTimeout(() => URL.revokeObjectURL(url), 120000)
}

function buildFullHTML(r: AnalysisResult, chartImages: string[]): string {
  const now = new Date().toLocaleString('zh-CN')
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>DataLens 数据分析报告 - ${esc(r.fileName)}</title>
<style>
@page { size: A4; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', -apple-system, sans-serif; color: #1e293b; font-size: 12px; line-height: 1.6; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

.page { width: 210mm; min-height: 297mm; padding: ${PAD}; background: #fff; page-break-after: always; position: relative; overflow: hidden; }
.page:last-child { page-break-after: auto; }

.cover { background: linear-gradient(145deg, #1d4ed8, #2563eb 50%, #3b82f6); color: #fff; min-height: 297mm; display: flex; flex-direction: column; justify-content: center; padding: 15vh ${PAD}; position: relative; }
.cover-stripe { position: absolute; bottom: 0; left: 0; right: 0; height: 5px; background: #f59e0b; }
.cover h1 { font-size: 48px; font-weight: 800; letter-spacing: 3px; margin-bottom: 10px; }
.cover h2 { font-size: 20px; font-weight: 400; opacity: 0.88; margin-bottom: 50px; }
.cover-meta { font-size: 14px; opacity: 0.85; line-height: 2.2; }
.cover-meta em { font-style: normal; opacity: 0.6; display: inline-block; width: 70px; }
.cover-bottom { position: absolute; bottom: 10vh; left: ${PAD}; right: ${PAD}; text-align: center; font-size: 11px; opacity: 0.45; }

.section-title { font-size: 18px; font-weight: 700; color: #2563eb; padding-left: 10px; border-left: 4px solid #2563eb; margin-bottom: 14px; }
.desc { font-size: 12px; color: #64748b; margin-bottom: 12px; }

.cards { display: flex; gap: 10px; margin: 10px 0 14px 0; }
.card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 12px; text-align: center; }
.card-val { font-size: 24px; font-weight: 700; }
.card-lbl { font-size: 11px; color: #64748b; margin-top: 3px; }

table { width: 100%; border-collapse: collapse; margin: 8px 0 14px 0; }
th { background: #eff6ff; color: #1e40af; font-size: 11px; font-weight: 600; padding: 8px 10px; text-align: left; border-bottom: 2px solid #bfdbfe; }
td { padding: 7px 10px; font-size: 11px; border-bottom: 1px solid #f1f5f9; color: #334155; }
tr:nth-child(even) td { background: #f8fafc; }

.chart-box { margin: 14px 0; }
.chart-box h3 { font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
.chart-box .desc { font-size: 11px; margin-bottom: 6px; }
.chart-box img { width: 100%; border-radius: 4px; border: 1px solid #f1f5f9; }
.chart-empty { background: #f8fafc; border: 1px dashed #e2e8f0; border-radius: 4px; text-align: center; padding: 40px 0; color: #94a3b8; font-size: 12px; }

.insight-stats { background: #f8fafc; border-radius: 6px; padding: 8px 14px; margin-bottom: 12px; }
.insight-stats span { margin-right: 14px; font-size: 11px; font-weight: 600; }
.ins-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; margin: 6px 0; display: flex; overflow: hidden; }
.ins-bar { width: 4px; flex-shrink: 0; }
.ins-body { flex: 1; padding: 10px 12px; }
.ins-hdr { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
.ins-hdr .num { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; color: #fff; font-size: 11px; font-weight: 700; flex-shrink: 0; }
.ins-hdr .title { font-size: 13px; font-weight: 700; }
.ins-meta { display: flex; gap: 8px; align-items: center; margin: 3px 0; }
.ins-meta .badge { display: inline-block; padding: 1px 7px; border-radius: 8px; font-size: 10px; font-weight: 600; color: #fff; opacity: 0.88; }
.ins-meta .conf { font-size: 10px; color: #94a3b8; }
.ins-body .body { font-size: 11px; color: #475569; line-height: 1.7; }

.summary-block { background: linear-gradient(135deg, #eff6ff, #f0f9ff); border: 1px solid #bfdbfe; border-radius: 6px; padding: 12px 14px; margin: 14px 0; font-size: 12px; line-height: 1.8; color: #1e40af; }
.summary-block strong { color: #1d4ed8; }
.footer-section { margin-top: 30px; }
.footer-section p { font-size: 11px; color: #94a3b8; line-height: 1.8; margin: 3px 0; }
.footer-section strong { color: #64748b; }

.print-btn { position: fixed; top: 10px; right: 10px; z-index: 9999; background: #2563eb; color: white; border: none; border-radius: 6px; padding: 8px 20px; font-size: 14px; cursor: pointer; font-family: 'Microsoft YaHei', sans-serif; }
.print-btn:hover { background: #1d4ed8; }
@media print { .print-btn { display: none; } }
</style></head>
<body>
<button class="print-btn" onclick="window.print()">保存为 PDF</button>
${buildCover(r, now)}
${buildBody(r, chartImages)}
</body></html>`
}

function page(cls: string, content: string): string {
  return `<div class="page ${cls}">${content}</div>`
}
function section(title: string, content: string): string {
  return page('', `<div class="section-title">${title}</div>${content}`)
}

function buildCover(r: AnalysisResult, now: string): string {
  return page('cover', `<h1>DataLens</h1><h2>智能数据分析报告</h2>
<div class="cover-meta">
<div><em>报告文件</em>${esc(r.fileName)}</div>
<div><em>生成时间</em>${esc(fmtDate(r.uploadTime))}</div>
<div><em>数据规模</em>${r.overview.rowCount.toLocaleString()} 行 × ${r.overview.colCount} 列</div>
<div><em>缺失率</em>${r.overview.missingPercent.toFixed(1)}%</div>
<div><em>重复行</em>${r.overview.duplicateRows} 行</div>
</div>
<div class="cover-bottom">本报告由 DataLens 智能数据分析平台自动生成 · ${now}</div>
<div class="cover-stripe"></div>`)
}

function buildBody(r: AnalysisResult, imgs: string[]): string {
  let s = ''
  s += section('一、执行摘要', buildSummary(r))
  s += section('二、数据概览', buildOverview(r))
  if (r.charts.length > 0) s += section('三、可视化图表', buildCharts(r.charts, imgs))
  s += section('四、字段详情', buildFields(r.columns))
  if (r.insights.length > 0) s += section('五、洞察与建议', buildInsights(r))
  s += page('', buildFooter())
  return s
}

function buildSummary(r: AnalysisResult): string {
  const cards: [string, string, string][] = [
    ['总行数', r.overview.rowCount.toLocaleString(), '#2563eb'],
    ['总列数', String(r.overview.colCount), '#3b82f6'],
    ['缺失值', `${r.overview.missingCells.toLocaleString()} (${r.overview.missingPercent.toFixed(1)}%)`, '#f59e0b'],
    ['重复行', String(r.overview.duplicateRows), '#ef4444'],
  ]
  let desc = `本次分析对文件「${esc(r.fileName)}」进行了解读。数据集包含 ${r.overview.rowCount.toLocaleString()} 行记录，${r.overview.colCount} 个字段。`
  desc += r.overview.missingPercent <= 3 ? `数据质量良好，缺失率仅 ${r.overview.missingPercent.toFixed(1)}%。` : `数据存在一定缺失（${r.overview.missingPercent.toFixed(1)}%），建议关注数据质量。`
  if (r.overview.duplicateRows > 0) desc += `发现 ${r.overview.duplicateRows} 行重复记录。`
  const nc = r.columns.filter(c => c.type === 'number').length
  const sc = r.columns.filter(c => c.type === 'string').length
  const dc = r.columns.filter(c => c.type === 'date').length
  desc += `字段类型分布：${nc} 个数值型、${sc} 个文本型、${dc} 个日期型。`

  let conc = ''
  if (r.insights.length > 0) {
    const pos = r.insights.filter(i => i.type === 'positive').length
    const neg = r.insights.filter(i => i.type === 'negative').length
    const top = r.insights.slice(0, 2).map(t => t.title).join('、')
    conc = `<p style="margin-top:12px; padding:10px 14px; background:#f8fafc; border-radius:6px; color:#334155; font-size:12px; line-height:1.8;">
<strong>核心结论：</strong>本次分析共生成 ${r.insights.length} 条洞察${pos > 0 || neg > 0 ? `（${pos > 0 ? `优势 ${pos} 条` : ''}${pos > 0 && neg > 0 ? '、' : ''}${neg > 0 ? `风险 ${neg} 条` : ''}）` : ''}。关键发现包括：${esc(top)}。${neg > 0 ? '建议优先关注风险项。' : pos > 0 ? '可围绕优势项制定优化策略。' : ''}</p>`
  } else {
    conc = `<p style="margin-top:12px; padding:10px 14px; background:#f8fafc; border-radius:6px; color:#334155; font-size:12px; line-height:1.8;"><strong>核心结论：</strong>本次分析完成数据结构与质量评估，未生成深度洞察。</p>`
  }

  return `<p class="desc">${desc}</p>
<div class="cards">${cards.map(c => `<div class="card"><div class="card-val" style="color:${c[2]}">${esc(c[1])}</div><div class="card-lbl">${esc(c[0])}</div></div>`).join('')}</div>${conc}`
}

function buildOverview(r: AnalysisResult): string {
  const nc = r.columns.filter(c => c.type === 'number').length
  const sc = r.columns.filter(c => c.type === 'string').length
  const dc = r.columns.filter(c => c.type === 'date').length
  const rows: [string, string, string][] = [
    ['总记录数', `${r.overview.rowCount.toLocaleString()} 行`, r.overview.rowCount >= 100 ? '样本量充足，分析结果可信' : '样本量偏少，结论仅供参考'],
    ['字段数量', `${r.overview.colCount} 列`, r.overview.colCount >= 5 ? '维度丰富，支持多角度分析' : '维度较少，建议补充字段'],
    ['缺失单元格', `${r.overview.missingCells.toLocaleString()} 个 (${r.overview.missingPercent.toFixed(2)}%)`, r.overview.missingPercent <= 1 ? '可忽略' : r.overview.missingPercent <= 5 ? '可接受' : '建议优先处理'],
    ['重复行', `${r.overview.duplicateRows} 行`, r.overview.duplicateRows === 0 ? '无重复记录' : '存在重复，建议检查来源'],
  ]
  return `<p class="desc">以下是对数据集结构、完整性和字段分布的详细评估。</p>
<table><thead><tr><th>数据维度</th><th>数值</th><th>分析与评估</th></tr></thead><tbody>${rows.map(r => `<tr><td><strong>${esc(r[0])}</strong></td><td>${esc(r[1])}</td><td style="color:#64748b">${esc(r[2])}</td></tr>`).join('')}</tbody></table>
<p class="desc">字段构成：${nc} 个数值型（适合统计指标）、${sc} 个文本型（适合分类汇总）、${dc} 个日期型（适合时间序列分析）。</p>`
}

function buildCharts(charts: Array<{ id: string; title: string; type: string; description: string }>, imgs: string[]): string {
  let s = `<p class="desc">共生成 ${charts.length} 张可视化图表，帮助直观理解数据分布与趋势。</p>`
  for (let i = 0; i < charts.length; i++) {
    const ch = charts[i]
    const img = imgs[i]
    s += `<div class="chart-box"><h3>${esc(ch.title)}</h3>`
    if (ch.description) s += `<div class="desc">${esc(ch.description)}</div>`
    s += img ? `<img src="${img}" alt="${esc(ch.title)}">` : `<div class="chart-empty">[${ch.type.toUpperCase()}] ${esc(ch.title)} — 图表未捕获</div>`
    s += `</div>`
  }
  return s
}

function buildFields(cols: Array<{ name: string; type: string; uniqueCount: number; missingCount: number; missingPercent: number; min?: number; max?: number; mean?: number; std?: number }>): string {
  const nc = cols.filter(c => c.type === 'number').length
  const sc = cols.filter(c => c.type === 'string').length
  const dc = cols.filter(c => c.type === 'date').length
  let rows = ''
  for (const c of cols) {
    const nm = c.name.length > 12 ? c.name.slice(0, 11) + '…' : c.name
    const isN = c.type === 'number'
    const mc = c.missingPercent > MISSING_THRESHOLD ? '#ef4444' : c.missingPercent > 5 ? '#f59e0b' : '#334155'
    rows += `<tr><td style="font-weight:500">${esc(nm)}</td><td style="color:#3b82f6">${esc(TYPE_CN[c.type] || c.type)}</td>
<td>${c.uniqueCount.toLocaleString()}</td><td style="color:${mc}">${c.missingPercent.toFixed(1)}%</td>
<td>${isN && c.min != null ? fmtN(c.min) : '-'}</td><td>${isN && c.max != null ? fmtN(c.max) : '-'}</td>
<td>${isN && c.mean != null ? fmtN(c.mean) : '-'}</td><td>${isN && c.std != null ? fmtN(c.std) : '-'}</td></tr>`
  }
  return `<p class="desc">以下列出数据集中所有字段的基本统计信息。数值型字段包含最小值、最大值、均值、标准差。</p>
<table><thead><tr><th>字段名</th><th>类型</th><th>唯一值</th><th>缺失率</th><th>最小值</th><th>最大值</th><th>均值</th><th>标准差</th></tr></thead><tbody>${rows}</tbody></table>
<p style="font-size:11px;color:#94a3b8;margin-top:4px;">共 ${cols.length} 个字段：${nc} 数值型 · ${sc} 文本型 · ${dc} 日期型</p>`
}

function buildInsights(r: AnalysisResult): string {
  const ins = r.insights
  const counts: Record<string, number> = {}
  for (const i of ins) counts[i.type] = (counts[i.type] || 0) + 1

  let stats = ''
  for (const [tp, cnt] of Object.entries(counts)) {
    const c = INSIGHT_COLORS[tp] || '#3b82f6'
    stats += `<span style="color:${c};">● ${INSIGHT_CN[tp] || '信息'} ${cnt} 条</span>`
  }

  const pos = counts['positive'] || 0
  const neg = counts['negative'] || 0
  let desc = `本次分析共发现 ${ins.length} 条数据洞察。其中优势 ${pos} 条，风险 ${neg} 条。`
  if (neg > 0) desc += `建议优先关注风险项，结合业务背景进行深入排查。`

  let cards = ''
  for (let i = 0; i < ins.length; i++) {
    const item = ins[i]
    const c = INSIGHT_COLORS[item.type] || '#3b82f6'
    const lb = INSIGHT_CN[item.type] || '信息'
    const cl = item.confidence === 'high' ? '高置信度' : item.confidence === 'medium' ? '中等置信度' : '需验证'
    const cc = item.confidence === 'high' ? c : item.confidence === 'medium' ? '#f59e0b' : '#94a3b8'
    cards += `<div class="ins-card"><div class="ins-bar" style="background:${c}"></div><div class="ins-body">
<div class="ins-hdr"><span class="num" style="background:${c}">${String(i + 1).padStart(2, '0')}</span><span class="title" style="color:${c}">${esc(item.title)}</span></div>
<div class="ins-meta"><span class="badge" style="background:${c}">${esc(lb)}</span><span class="conf" style="color:${cc}">${esc(cl)}</span></div>
<div class="body">${esc(item.content)}</div></div></div>`
  }

  return `<p class="desc">${desc}</p><div class="insight-stats">${stats}</div>${cards}
<div class="summary-block"><strong>📊 综合建议：</strong>基于 ${r.overview.rowCount.toLocaleString()} 行数据的分析，${r.overview.missingPercent <= 3 ? '数据整体质量良好，分析结果具备较高参考价值。' : '建议优先处理数据缺失问题以提高分析准确性。'}${ins.length > 5 ? ` 共发现 ${ins.length} 条洞察，涵盖数据质量、趋势特征、异常检测等多个维度，建议逐条复核。` : ' 洞察数量有限，建议上传更全面的数据以获得更丰富的分析结论。'}</div>`
}

function buildFooter(): string {
  return `<div class="footer-section">
<p><strong>报告声明</strong>：本报告由 DataLens 智能数据分析平台基于规则引擎自动生成，仅供决策参考。分析结果受数据质量和算法模型限制。</p>
<p><strong>数据安全</strong>：所有数据均在浏览器本地完成处理和分析，不会上传至外部服务器。</p>
<p><strong>生成时间</strong>：${new Date().toLocaleString('zh-CN')}</p></div>`
}

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
function fmtDate(ds: string): string {
  try { return new Date(ds).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return ds }
}

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
