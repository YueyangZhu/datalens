// PDF导出工具 - 直接下载方案
// 流程：显示loading遮罩 → 渲染可见报告容器 → html2canvas截图 → jsPDF生成PDF → save()自动下载

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import * as echarts from 'echarts'
import type { AnalysisResult } from '../types'

const REPORT_W = 794
const SCALE = 2
const PAD = '10mm'

const TYPE_CN: Record<string, string> = {
  number: '数值型', string: '文本型', date: '日期型', boolean: '布尔型',
}
const INSIGHT_CN: Record<string, string> = {
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
  // 1. 截图图表
  const chartImages = await captureCharts(chartElements || [])

  // 2. 显示 loading 遮罩
  const overlay = createOverlay()
  document.body.appendChild(overlay)

  // 3. 在遮罩下方渲染可见报告容器（遮罩挡住用户视线，但容器对浏览器是visible的）
  const container = document.createElement('div')
  container.style.cssText = `
    position: fixed; top: 0; left: 0; z-index: 99999;
    width: ${REPORT_W}px; background: #fff;
  `
  container.innerHTML = buildReportHTML(result, chartImages)
  document.body.appendChild(container)

  // 等待浏览器布局完成
  await delay(100)

  // 4. html2canvas 截图
  let canvas: HTMLCanvasElement
  try {
    canvas = await html2canvas(container, {
      scale: SCALE,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      allowTaint: true,
    })
  } finally {
    document.body.removeChild(container)
    document.body.removeChild(overlay)
  }

  if (canvas.width === 0 || canvas.height === 0) {
    throw new Error('生成报告失败，请刷新页面后重试')
  }

  // 5. jsPDF 按 A4 (595×842pt @72dpi) 裁切
  const doc = new jsPDF('p', 'pt', 'a4')
  const pw = 595.28
  const ph = 841.89
  const imgW = pw
  const scaleRatio = imgW / canvas.width

  let srcY = 0
  let page = 0
  while (srcY < canvas.height) {
    if (page > 0) doc.addPage()
    page++

    const srcH = Math.min(canvas.height - srcY, canvas.width * (ph / pw))
    const imgH = srcH * scaleRatio

    // 生成当前页的canvas切片
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = canvas.width
    pageCanvas.height = Math.min(srcH, canvas.height - srcY)
    const ctx = pageCanvas.getContext('2d')!
    ctx.drawImage(canvas, 0, srcY, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height)

    doc.addImage(pageCanvas.toDataURL('image/png', 0.92), 'PNG', 0, 0, imgW, imgH)
    srcY += srcH
  }

  // 6. 自动下载
  const name = result.fileName.replace(/[^\w\u4e00-\u9fa5.-]/g, '_')
  doc.save(`${name}_数据分析报告.pdf`)
}

// ============ 图表截图 ============

async function captureCharts(elements: HTMLDivElement[]): Promise<string[]> {
  const images: string[] = []
  for (const el of elements) {
    try {
      if (el.offsetWidth === 0 || el.offsetHeight === 0) { images.push(''); continue }
      const inst = echarts.getInstanceByDom(el)
      if (inst) {
        const url = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })
        if (url && url.length > 100) { images.push(url); continue }
      }
      images.push('')
    } catch { images.push('') }
  }
  return images
}

// ============ Overlay ============

function createOverlay(): HTMLDivElement {
  const d = document.createElement('div')
  d.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    z-index: 100000; background: rgba(0,0,0,0.55);
    display: flex; align-items: center; justify-content: center;
  `
  const inner = document.createElement('div')
  inner.style.cssText = `
    background: #fff; border-radius: 12px; padding: 32px 48px;
    text-align: center; font-family: 'Microsoft YaHei',sans-serif;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  `
  inner.innerHTML = `<div style="font-size:18px;color:#1e293b;margin-bottom:12px">正在生成PDF报告...</div>
<div style="font-size:13px;color:#94a3b8">请稍候，这可能需要几秒钟</div>`
  d.appendChild(inner)
  return d
}

// ============ 报告 HTML ============

function buildReportHTML(r: AnalysisResult, chartImages: string[]): string {
  const now = new Date().toLocaleString('zh-CN')
  return `<style>${getCSS(PAD)}</style>
${buildCover(r, now)}
<div class="content">
  ${buildSection('一、执行摘要', buildSummary(r))}
  ${buildSection('二、数据概览', buildOverview(r))}
  ${r.charts.length > 0 ? buildSection('三、可视化图表与分析', buildCharts(r.charts, chartImages, r)) : ''}
  ${buildSection('四、字段详情', buildFields(r.columns))}
  ${r.insights.length > 0 ? buildSection('五、洞察与建议', buildInsights(r)) : ''}
  ${buildFooter()}
</div>`
}

function getCSS(pad: string): string {
  return `
*{margin:0;padding:0;box-sizing:border-box;}
.report-body{background:#fff;}
body,.report-body{font-family:'Microsoft YaHei','PingFang SC','Noto Sans SC',-apple-system,sans-serif;color:#1e293b;font-size:13px;line-height:1.75;}

.cover{background:linear-gradient(145deg,#1d4ed8,#2563eb 50%,#3b82f6);color:#fff;width:${REPORT_W}px;min-height:1122px;display:flex;flex-direction:column;justify-content:center;padding:15vh ${pad};position:relative;}
.cover-stripe{position:absolute;bottom:0;left:0;right:0;height:5px;background:#f59e0b;}
.cover h1{font-size:48px;font-weight:800;letter-spacing:3px;margin-bottom:10px;}
.cover h2{font-size:20px;font-weight:400;opacity:.88;margin-bottom:50px;}
.cover-meta{font-size:14px;opacity:.85;line-height:2.2;}
.cover-meta em{font-style:normal;opacity:.6;display:inline-block;width:70px;}
.cover-bottom{position:absolute;bottom:10vh;left:${pad};right:${pad};text-align:center;font-size:11px;opacity:.45;}

.content{width:${REPORT_W}px;padding:${pad};background:#fff;}
.section-title{font-size:18px;font-weight:700;color:#2563eb;padding-left:10px;border-left:4px solid #2563eb;margin:24px 0 14px 0;}
.section-title:first-child{margin-top:0;}
.desc{font-size:13px;color:#64748b;margin-bottom:12px;}

.cards{display:flex;gap:10px;margin:10px 0 14px 0;}
.card{flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 12px;text-align:center;}
.card-val{font-size:24px;font-weight:700;}
.card-lbl{font-size:11px;color:#64748b;margin-top:3px;}

table{width:100%;border-collapse:collapse;margin:8px 0 14px 0;}
th{background:#eff6ff;color:#1e40af;font-size:12px;font-weight:600;padding:8px 10px;text-align:left;border-bottom:2px solid #bfdbfe;}
td{padding:7px 10px;font-size:12px;border-bottom:1px solid #f1f5f9;color:#334155;}
tr:nth-child(even) td{background:#f8fafc;}

.chart-block{margin:20px 0 28px 0;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;}
.chart-block h3{font-size:15px;font-weight:700;color:#1e293b;margin-bottom:4px;}
.chart-block .desc{font-size:12px;color:#64748b;margin-bottom:10px;}
.chart-block img{width:100%;border-radius:4px;border:1px solid #e2e8f0;}
.chart-block .analysis{font-size:12px;color:#475569;margin-top:10px;line-height:1.8;padding:10px 12px;background:#fff;border-radius:4px;border-left:3px solid #2563eb;}
.chart-empty{background:#f8fafc;border:1px dashed #e2e8f0;border-radius:4px;text-align:center;padding:40px 0;color:#94a3b8;font-size:12px;}

.insight-stats{background:#f8fafc;border-radius:6px;padding:8px 14px;margin-bottom:12px;}
.insight-stats span{margin-right:14px;font-size:12px;font-weight:600;}
.ins-card{background:#fff;border:1px solid #e2e8f0;border-radius:6px;margin:6px 0;display:flex;overflow:hidden;}
.ins-bar{width:4px;flex-shrink:0;}
.ins-body{flex:1;padding:10px 12px;}
.ins-hdr{display:flex;align-items:center;gap:6px;margin-bottom:3px;}
.ins-hdr .num{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;color:#fff;font-size:11px;font-weight:700;flex-shrink:0;}
.ins-hdr .title{font-size:14px;font-weight:700;}
.ins-meta{display:flex;gap:8px;align-items:center;margin:3px 0;}
.ins-meta .badge{display:inline-block;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:600;color:#fff;opacity:.88;}
.ins-meta .conf{font-size:11px;color:#94a3b8;}
.ins-body .body{font-size:12px;color:#475569;line-height:1.7;}

.summary-block{background:linear-gradient(135deg,#eff6ff,#f0f9ff);border:1px solid #bfdbfe;border-radius:6px;padding:12px 14px;margin:14px 0;font-size:13px;line-height:1.8;color:#1e40af;}
.summary-block strong{color:#1d4ed8;}
.footer-section{margin-top:30px;padding:16px 0;border-top:1px solid #e2e8f0;}
.footer-section p{font-size:12px;color:#94a3b8;line-height:2;margin:3px 0;}
.footer-section strong{color:#64748b;}
`
}

// ==================== HTML 构建 ====================

function buildCover(r: AnalysisResult, now: string): string {
  return `<div class="cover">
<h1>DataLens</h1><h2>智能数据分析报告</h2>
<div class="cover-meta">
<div><em>报告文件</em>${esc(r.fileName)}</div>
<div><em>生成时间</em>${esc(fmtDate(r.uploadTime))}</div>
<div><em>数据规模</em>${r.overview.rowCount.toLocaleString()} 行 × ${r.overview.colCount} 列</div>
<div><em>缺失率</em>${r.overview.missingPercent.toFixed(1)}%</div>
<div><em>重复行</em>${r.overview.duplicateRows} 行</div>
</div>
<div class="cover-bottom">本报告由 DataLens 智能数据分析平台自动生成 · ${now}</div>
<div class="cover-stripe"></div></div>`
}

function buildSection(title: string, content: string): string {
  return `<div class="section-title">${title}</div>${content}`
}

function buildSummary(r: AnalysisResult): string {
  const cards: [string, string, string][] = [
    ['总行数', r.overview.rowCount.toLocaleString(), '#2563eb'],
    ['总列数', String(r.overview.colCount), '#3b82f6'],
    ['缺失值', `${r.overview.missingCells.toLocaleString()} (${r.overview.missingPercent.toFixed(1)}%)`, '#f59e0b'],
    ['重复行', String(r.overview.duplicateRows), '#ef4444'],
  ]

  let desc = `本次分析对文件「${esc(r.fileName)}」进行了解读。数据集包含 ${r.overview.rowCount.toLocaleString()} 行记录、${r.overview.colCount} 个字段。`
  desc += r.overview.missingPercent <= 3 ? `数据质量良好，缺失率仅 ${r.overview.missingPercent.toFixed(1)}%。` : `数据存在一定缺失（${r.overview.missingPercent.toFixed(1)}%），建议关注数据质量。`
  if (r.overview.duplicateRows > 0) desc += `发现 ${r.overview.duplicateRows} 行重复记录，建议核查数据来源。`

  const nc = r.columns.filter(c => c.type === 'number').length
  const sc = r.columns.filter(c => c.type === 'string').length
  const dc = r.columns.filter(c => c.type === 'date').length
  desc += `字段类型分布：${nc} 个数值型、${sc} 个文本型、${dc} 个日期型。`

  const ns = r.insights.filter(i => i.type === 'negative').length
  const ps = r.insights.filter(i => i.type === 'positive').length
  let conc = ''
  if (r.insights.length > 0) {
    conc = `<div class="summary-block"><strong>核心结论：</strong>本次分析共生成 ${r.insights.length} 条洞察`
    if (ps > 0 || ns > 0) conc += `（优势 ${ps} 条、风险 ${ns} 条）`
    conc += `。${ns > 0 ? '建议优先关注风险项，结合业务背景进行深入排查。' : '可围绕优势项制定业务优化策略。'}</div>`
  }

  return `<p class="desc">${desc}</p>
<div class="cards">${cards.map(c => `<div class="card"><div class="card-val" style="color:${c[2]}">${esc(c[1])}</div><div class="card-lbl">${esc(c[0])}</div></div>`).join('')}</div>${conc}`
}

function buildOverview(r: AnalysisResult): string {
  const nc = r.columns.filter(c => c.type === 'number').length
  const sc = r.columns.filter(c => c.type === 'string').length
  const dc = r.columns.filter(c => c.type === 'date').length

  const rows: [string, string, string][] = [
    ['总记录数', `${r.overview.rowCount.toLocaleString()} 行`, r.overview.rowCount >= 1000 ? '样本量充足，分析结果可信度高' : r.overview.rowCount >= 100 ? '样本量中等，结论可供参考' : '样本量偏少，结论仅供参考'],
    ['字段数量', `${r.overview.colCount} 列`, r.overview.colCount >= 10 ? '维度丰富，支持多角度交叉分析' : r.overview.colCount >= 5 ? '维度适中，基础分析可行' : '维度较少，建议补充更多字段'],
    ['缺失单元格', `${r.overview.missingCells.toLocaleString()} 个 (${r.overview.missingPercent.toFixed(2)}%)`, r.overview.missingPercent <= 1 ? '几乎无缺失，数据完整性优秀' : r.overview.missingPercent <= 5 ? '少量缺失，在可接受范围内' : '缺失较多，建议优先处理缺失值'],
    ['重复行', `${r.overview.duplicateRows} 行`, r.overview.duplicateRows === 0 ? '无重复记录，数据清洁度高' : r.overview.duplicateRows <= 10 ? '极少量重复，可忽略' : '存在重复，建议检查数据来源'],
  ]

  return `<p class="desc">以下是对数据集结构、完整性和字段分布的详细评估。</p>
<table><thead><tr><th>数据维度</th><th>数值</th><th>分析与评估</th></tr></thead><tbody>
${rows.map(r => `<tr><td><strong>${esc(r[0])}</strong></td><td>${esc(r[1])}</td><td style="color:#64748b">${esc(r[2])}</td></tr>`).join('')}
</tbody></table>
<p class="desc">字段构成：${nc} 个数值型（适用于统计分析和趋势判断）、${sc} 个文本型（适用于分类汇总和文本分析）、${dc} 个日期型（适用于时间序列分析和周期性挖掘）。</p>`
}

function buildCharts(charts: Array<{ id: string; title: string; type: string; description: string }>, imgs: string[], r: AnalysisResult): string {
  let s = `<p class="desc">共生成 ${charts.length} 张可视化图表，下方为每张图表的展示与数据解读。</p>`
  for (let i = 0; i < charts.length; i++) {
    const ch = charts[i]
    const img = imgs[i]
    const analysis = generateChartAnalysis(ch, i, r)
    s += `<div class="chart-block">
<h3>${esc(ch.title)}</h3>`
    if (ch.description) s += `<div class="desc">${esc(ch.description)}</div>`
    s += img ? `<img src="${img}" alt="${esc(ch.title)}">` : `<div class="chart-empty">[图表未捕获]</div>`
    s += `<div class="analysis">${analysis}</div>`
    s += `</div>`
  }
  return s
}

function generateChartAnalysis(chart: { title: string; type: string }, idx: number, r: AnalysisResult): string {
  const numCols = r.columns.filter(c => c.type === 'number')
  
  switch (chart.type) {
    case 'bar':
    case 'column': {
      if (numCols.length > 0) {
        const col = numCols[Math.min(idx, numCols.length - 1)]
        return `📊 <strong>图表解读：</strong>该柱状图展示了不同分类维度的数值对比情况。从图中可以看出，各分类之间存在明显的数值差异，反映了${chart.title}在不同分组下的分布特征。${
          col.mean != null && col.std != null
            ? `参考数据：均值约 ${fmtN(col.mean)}，标准差约 ${fmtN(col.std)}，标准差相对${
              col.std > Math.abs(col.mean) * 0.5 ? '较大，说明数据波动显著' : '较小，数据整体趋于稳定'
            }。`
            : `建议关注数值较高或较低的异常分组，分析其背后的业务原因。`
        }</div>`
      }
      return `📊 <strong>图表解读：</strong>该柱状图直观展示了「${chart.title}」各分类的数值对比。通过柱状的高低可以快速识别表现突出或偏低的类别，为后续的业务决策提供数据依据。建议重点关注数值异常的维度，深入分析其成因。`
    }

    case 'line': {
      if (numCols.length > 0) {
        const col = numCols[Math.min(idx, numCols.length - 1)]
        return `📈 <strong>图表解读：</strong>该折线图描绘了「${chart.title}」随时间/维度的变化走势。通过观察折线的斜率变化，可以判断数据在不同阶段的增长或下降趋势。${
          col.mean != null
            ? `整体均值为 ${fmtN(col.mean)}，${
              col.max != null && col.min != null && col.min < col.max
                ? `数据在 ${fmtN(col.min)} 至 ${fmtN(col.max)} 之间波动。`
                : ''
            }`
            : ''
        }建议关注图中的波峰和波谷节点，这些时间点通常对应着关键的业务事件或市场变化。</div>`
      }
      return `📈 <strong>图表解读：</strong>该折线图描绘了「${chart.title}」的变化走势。折线的起伏反映了数据随时间或维度的演变规律。建议关注图中的拐点时刻，分析引起数据变化的关键因素，为趋势预测提供参考。`
    }

    case 'pie': {
      return `🥧 <strong>图表解读：</strong>该饼图展示了「${chart.title}」的各项占比分布。扇区的大小直观反映了各分类所占份额的差异。重点关注占比较大的类别——它们是数据构成的主体部分。同时注意是否存在长尾分布（部分类别占比极低），这有助于优化资源配置。`
    }

    case 'histogram': {
      if (numCols.length > 0) {
        const col = numCols[Math.min(idx, numCols.length - 1)]
        return `📊 <strong>图表解读：</strong>该直方图展示了「${chart.title}」的数据分布形态。通过观察柱子的分布特征，可以判断数据是集中分布（单峰）还是呈现双峰/多峰模式，以及是否存在明显的偏态。${
          col.mean != null && col.std != null
            ? `数据均值约为 ${fmtN(col.mean)}，标准差约为 ${fmtN(col.std)}，${
              col.std > Math.abs(col.mean) * 0.5 ? '数据离散度较高，说明样本间差异较大' : '数据相对集中，说明样本具有一定的一致性'
            }。`
            : ''
        }若数据呈正态分布，说明样本具有良好的统计特性；若存在偏态或异常值，建议结合业务背景进一步分析。</div>`
      }
      return `📊 <strong>图表解读：</strong>该直方图展示了「${chart.title}」的数据分布形态。通过观察频率分布可以了解数据的集中趋势、离散程度和异常值情况。若分布呈钟形（正态），说明数据具有良好的统计特性；若存在长尾或多峰，建议进一步分析异常数据的业务成因。`
    }

    default: {
      return `📊 <strong>图表解读：</strong>该图表以${chart.type}类型展示了「${chart.title}」的数据特征。通过可视化呈现，可以更直观地理解数据的内在规律和结构。建议结合其他图表和统计指标，从多维度交叉验证分析结论。`
    }
  }
}

function buildFields(cols: Array<{ name: string; type: string; uniqueCount: number; missingCount: number; missingPercent: number; min?: number; max?: number; mean?: number; std?: number }>): string {
  const nc = cols.filter(c => c.type === 'number').length
  const sc = cols.filter(c => c.type === 'string').length
  const dc = cols.filter(c => c.type === 'date').length

  let rows = ''
  for (const c of cols) {
    const nm = c.name.length > 14 ? c.name.slice(0, 13) + '…' : c.name
    const isN = c.type === 'number'
    const mc = c.missingPercent > 10 ? '#ef4444' : c.missingPercent > 5 ? '#f59e0b' : '#334155'
    rows += `<tr>
<td style="font-weight:500">${esc(nm)}</td><td style="color:#3b82f6">${esc(TYPE_CN[c.type] || c.type)}</td>
<td>${c.uniqueCount.toLocaleString()}</td><td style="color:${mc}">${c.missingPercent.toFixed(1)}%</td>
<td>${isN && c.min != null ? fmtN(c.min) : '-'}</td>
<td>${isN && c.max != null ? fmtN(c.max) : '-'}</td>
<td>${isN && c.mean != null ? fmtN(c.mean) : '-'}</td>
<td>${isN && c.std != null ? fmtN(c.std) : '-'}</td>
</tr>`
  }

  return `<p class="desc">以下列出数据集中所有字段的基本统计信息。数值型字段包含最小值、最大值、均值、标准差，文本型字段显示唯一值数量。</p>
<table><thead><tr><th>字段名</th><th>类型</th><th>唯一值</th><th>缺失率</th><th>最小值</th><th>最大值</th><th>均值</th><th>标准差</th></tr></thead><tbody>${rows}</tbody></table>
<p style="font-size:12px;color:#94a3b8;margin-top:6px;">共 ${cols.length} 个字段：${nc} 数值型 · ${sc} 文本型 · ${dc} 日期型 | 缺失率超 10% 的字段已标红，建议关注</p>`
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
  let desc = `本次分析共发现 ${ins.length} 条数据洞察。其中优势 ${pos} 条，风险 ${neg} 条，提示 ${ins.filter(i => i.type === 'warning').length} 条，信息 ${ins.filter(i => i.type === 'info').length} 条。`
  if (neg > 0) desc += `建议优先关注风险项，结合业务背景进行深入排查。`
  if (pos > 0) desc += `优势项可作为业务优化的参考方向。`

  let cards = ''
  for (let i = 0; i < ins.length; i++) {
    const item = ins[i]
    const c = INSIGHT_COLORS[item.type] || '#3b82f6'
    const lb = INSIGHT_CN[item.type] || '信息'
    const cl = item.confidence === 'high' ? '高置信度' : item.confidence === 'medium' ? '中等置信度' : '需人工验证'
    const cc = item.confidence === 'high' ? c : item.confidence === 'medium' ? '#f59e0b' : '#94a3b8'
    cards += `<div class="ins-card"><div class="ins-bar" style="background:${c}"></div><div class="ins-body">
<div class="ins-hdr"><span class="num" style="background:${c}">${String(i + 1).padStart(2, '0')}</span><span class="title" style="color:${c}">${esc(item.title)}</span></div>
<div class="ins-meta"><span class="badge" style="background:${c}">${esc(lb)}</span><span class="conf" style="color:${cc}">${esc(cl)}</span></div>
<div class="body">${esc(item.content)}</div></div></div>`
  }

  return `<p class="desc">${desc}</p><div class="insight-stats">${stats}</div>${cards}
<div class="summary-block"><strong>📊 综合建议：</strong>基于 ${r.overview.rowCount.toLocaleString()} 行数据的分析，${r.overview.missingPercent <= 3 ? '数据整体质量良好，分析结果具备较高参考价值。' : '建议优先处理数据缺失问题以提高分析准确性。'}${ins.length > 5 ? ` 共发现 ${ins.length} 条洞察，涵盖数据质量、趋势特征、异常检测等多个维度，建议逐条复核后制定优化方案。` : ' 洞察数量有限，建议上传更全面的数据以获得更丰富的分析结论。建议增加时间维度、地域维度或业务分类维度的数据。'}</div>`
}

function buildFooter(): string {
  return `<div class="footer-section">
<p><strong>报告声明</strong>：本报告由 DataLens 智能数据分析平台基于规则引擎自动生成，仅供决策参考。分析结果受数据质量和算法模型限制，具体业务决策请结合实际情况。</p>
<p><strong>数据安全</strong>：所有数据均在浏览器本地完成处理和分析，不会上传至外部服务器，确保数据隐私和安全。</p>
<p><strong>生成时间</strong>：${new Date().toLocaleString('zh-CN')}</p></div>`
}

// ============ 工具函数 ============

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
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
        els.push(c)
      }
    })
  }
  return els
}
