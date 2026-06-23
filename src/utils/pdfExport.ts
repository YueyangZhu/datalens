// PDF导出工具 - 稳定版：iframe + 原生打印
// 优点：无第三方库依赖、中文100%正常、浏览器原生支持
// 流程：生成报告HTML → 隐藏iframe → 打印对话框 → 用户选"另存为PDF"

import * as echarts from 'echarts'
import type { AnalysisResult } from '../types'

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
  console.log('[PDF导出] 开始生成报告...')
  
  // 1. 截图图表
  const chartImages: string[] = []
  if (chartElements) {
    for (let i = 0; i < chartElements.length; i++) {
      const el = chartElements[i]
      try {
        if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) {
          console.warn(`[PDF导出] 图表${i}尺寸为0，跳过`)
          chartImages.push('')
          continue
        }
        const inst = echarts.getInstanceByDom(el)
        if (inst) {
          const url = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' })
          if (url && url.length > 100) {
            chartImages.push(url)
            console.log(`[PDF导出] 图表${i}截图成功`)
            continue
          }
        }
        chartImages.push('')
      } catch (e) {
        console.warn(`[PDF导出] 图表${i}截图失败:`, e)
        chartImages.push('')
      }
    }
  }
  console.log('[PDF导出] 图表截图完成:', chartImages.length, '张')

  // 2. 生成完整HTML
  const html = buildFullHTML(result, chartImages)
  console.log('[PDF导出] HTML生成完成，长度:', html.length)

  // 3. 创建隐藏iframe
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;'
  document.body.appendChild(iframe)
  console.log('[PDF导出] iframe创建成功')

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    throw new Error('无法创建打印文档')
  }

  // 4. 写入内容
  doc.open()
  doc.write(html)
  doc.close()
  console.log('[PDF导出] HTML写入iframe完成')

  // 5. 等待图片加载完成
  await new Promise<void>((resolve, reject) => {
    const win = iframe.contentWindow
    if (!win) {
      reject(new Error('无法访问iframe窗口'))
      return
    }

    // 等待所有图片加载
    const images = doc.querySelectorAll('img')
    if (images.length === 0) {
      console.log('[PDF导出] 无需等待图片')
      setTimeout(resolve, 300)
      return
    }

    let loaded = 0
    let failed = 0
    const total = images.length
    console.log(`[PDF导出] 等待${total}张图片加载...`)

    images.forEach((img, idx) => {
      if (img.complete) {
        loaded++
        checkDone()
        return
      }
      img.onload = () => {
        loaded++
        console.log(`[PDF导出] 图片${idx}加载成功`)
        checkDone()
      }
      img.onerror = () => {
        failed++
        console.warn(`[PDF导出] 图片${idx}加载失败`)
        checkDone()
      }
    })

    // 超时机制
    setTimeout(() => {
      if (loaded + failed < total) {
        console.warn('[PDF导出] 图片加载超时，继续执行')
        resolve()
      }
    }, 3000)

    function checkDone() {
      if (loaded + failed >= total) {
        console.log(`[PDF导出] 图片加载完成: ${loaded}成功, ${failed}失败`)
        setTimeout(resolve, 200)
      }
    }
  })

  // 6. 触发打印
  console.log('[PDF导出] 触发打印...')
  const win = iframe.contentWindow
  if (win) {
    try {
      win.focus()
      win.print()
      console.log('[PDF导出] 打印对话框已弹出')
    } catch (e) {
      console.error('[PDF导出] 打印失败:', e)
      throw e
    }
  }

  // 7. 延迟清理iframe
  setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe)
      console.log('[PDF导出] iframe已清理')
    }
  }, 2000)
}

// ============ HTML 构建 ============

function buildFullHTML(r: AnalysisResult, chartImages: string[]): string {
  const now = new Date().toLocaleString('zh-CN')
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DataLens 数据分析报告 - ${esc(r.fileName)}</title>
<style>
@page { size: A4; margin: 15mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', -apple-system, sans-serif; color: #1e293b; font-size: 12px; line-height: 1.7; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

/* 封面 */
.cover { background: linear-gradient(145deg, #1d4ed8, #2563eb 50%, #3b82f6); color: #fff; min-height: 267mm; display: flex; flex-direction: column; justify-content: center; padding: 80px 40px; position: relative; page-break-after: always; }
.cover-stripe { position: absolute; bottom: 0; left: 0; right: 0; height: 5px; background: #f59e0b; }
.cover h1 { font-size: 48px; font-weight: 800; letter-spacing: 2px; margin-bottom: 12px; }
.cover h2 { font-size: 20px; font-weight: 400; opacity: 0.88; margin-bottom: 60px; }
.cover-meta { font-size: 14px; opacity: 0.85; line-height: 2.4; }
.cover-meta em { font-style: normal; opacity: 0.6; display: inline-block; width: 70px; }
.cover-bottom { position: absolute; bottom: 60px; left: 40px; right: 40px; text-align: center; font-size: 11px; opacity: 0.5; }

/* 正文内容 */
.content { padding: 10px 0; }
.section-title { font-size: 18px; font-weight: 700; color: #2563eb; padding-left: 12px; border-left: 4px solid #2563eb; margin: 20px 0 12px 0; }
.section-title:first-child { margin-top: 0; }
.desc { font-size: 12px; color: #64748b; margin-bottom: 10px; }

/* 卡片 */
.cards { display: flex; gap: 10px; margin: 10px 0 14px 0; }
.card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 10px; text-align: center; }
.card-val { font-size: 22px; font-weight: 700; }
.card-lbl { font-size: 11px; color: #64748b; margin-top: 2px; }

/* 表格 */
table { width: 100%; border-collapse: collapse; margin: 8px 0 12px 0; font-size: 11px; }
th { background: #eff6ff; color: #1e40af; font-weight: 600; padding: 8px 10px; text-align: left; border-bottom: 2px solid #bfdbfe; }
td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; }
tr:nth-child(even) td { background: #f8fafc; }

/* 图表块 */
.chart-block { margin: 16px 0; padding: 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
.chart-block h3 { font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 6px; }
.chart-block .desc { font-size: 11px; color: #64748b; margin-bottom: 8px; }
.chart-block img { width: 100%; max-width: 100%; border-radius: 4px; border: 1px solid #e2e8f0; display: block; }
.chart-block .analysis { font-size: 11px; color: #475569; margin-top: 10px; line-height: 1.7; padding: 10px 12px; background: #fff; border-radius: 4px; border-left: 3px solid #2563eb; }
.chart-empty { background: #f8fafc; border: 1px dashed #e2e8f0; border-radius: 4px; text-align: center; padding: 30px 0; color: #94a3b8; font-size: 12px; }

/* 洞察 */
.insight-stats { background: #f8fafc; border-radius: 6px; padding: 8px 14px; margin-bottom: 10px; }
.insight-stats span { margin-right: 14px; font-size: 11px; font-weight: 600; }
.ins-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; margin: 6px 0; display: flex; overflow: hidden; page-break-inside: avoid; }
.ins-bar { width: 4px; flex-shrink: 0; }
.ins-body { flex: 1; padding: 10px 12px; }
.ins-hdr { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
.ins-hdr .num { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; color: #fff; font-size: 11px; font-weight: 700; flex-shrink: 0; }
.ins-hdr .title { font-size: 13px; font-weight: 700; }
.ins-meta { display: flex; gap: 8px; align-items: center; margin: 3px 0; }
.ins-meta .badge { display: inline-block; padding: 1px 7px; border-radius: 8px; font-size: 10px; font-weight: 600; color: #fff; }
.ins-meta .conf { font-size: 10px; color: #94a3b8; }
.ins-body .body { font-size: 11px; color: #475569; line-height: 1.6; }

/* 总结块 */
.summary-block { background: linear-gradient(135deg, #eff6ff, #f0f9ff); border: 1px solid #bfdbfe; border-radius: 6px; padding: 12px 14px; margin: 12px 0; font-size: 12px; line-height: 1.7; color: #1e40af; }
.summary-block strong { color: #1d4ed8; }

/* 页脚 */
.footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
.footer p { font-size: 11px; color: #94a3b8; line-height: 1.8; margin: 4px 0; }

/* 打印按钮 */
.print-btn { position: fixed; top: 15px; right: 15px; z-index: 9999; background: #2563eb; color: white; border: none; border-radius: 6px; padding: 10px 24px; font-size: 14px; cursor: pointer; font-family: 'Microsoft YaHei', sans-serif; }
.print-btn:hover { background: #1d4ed8; }
@media print { .print-btn { display: none; } }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">保存为 PDF</button>
${buildCover(r, now)}
<div class="content">
  ${buildSection('一、执行摘要', buildSummary(r))}
  ${buildSection('二、数据概览', buildOverview(r))}
  ${r.charts.length > 0 ? buildSection('三、可视化图表与分析', buildCharts(r.charts, chartImages, r)) : ''}
  ${buildSection('四、字段详情', buildFields(r.columns))}
  ${r.insights.length > 0 ? buildSection('五、洞察与建议', buildInsights(r)) : ''}
  ${buildFooter()}
</div>
</body>
</html>`
}

// ============ 内容构建函数 ============

function buildCover(r: AnalysisResult, now: string): string {
  return `<div class="cover">
<h1>DataLens</h1>
<h2>智能数据分析报告</h2>
<div class="cover-meta">
<div><em>报告文件</em>${esc(r.fileName)}</div>
<div><em>生成时间</em>${esc(fmtDate(r.uploadTime))}</div>
<div><em>数据规模</em>${r.overview.rowCount.toLocaleString()} 行 × ${r.overview.colCount} 列</div>
<div><em>缺失率</em>${r.overview.missingPercent.toFixed(1)}%</div>
<div><em>重复行</em>${r.overview.duplicateRows} 行</div>
</div>
<div class="cover-bottom">本报告由 DataLens 智能数据分析平台自动生成 · ${now}</div>
<div class="cover-stripe"></div>
</div>`
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
    ['总记录数', `${r.overview.rowCount.toLocaleString()} 行`, r.overview.rowCount >= 1000 ? '样本量充足' : r.overview.rowCount >= 100 ? '样本量中等' : '样本量偏少'],
    ['字段数量', `${r.overview.colCount} 列`, r.overview.colCount >= 10 ? '维度丰富' : r.overview.colCount >= 5 ? '维度适中' : '维度较少'],
    ['缺失单元格', `${r.overview.missingCells.toLocaleString()} 个 (${r.overview.missingPercent.toFixed(2)}%)`, r.overview.missingPercent <= 1 ? '几乎无缺失' : r.overview.missingPercent <= 5 ? '少量缺失' : '缺失较多'],
    ['重复行', `${r.overview.duplicateRows} 行`, r.overview.duplicateRows === 0 ? '无重复' : r.overview.duplicateRows <= 10 ? '极少量' : '存在重复'],
  ]

  return `<p class="desc">以下是对数据集结构、完整性和字段分布的详细评估。</p>
<table><thead><tr><th>数据维度</th><th>数值</th><th>评估</th></tr></thead><tbody>
${rows.map(r => `<tr><td><strong>${esc(r[0])}</strong></td><td>${esc(r[1])}</td><td style="color:#64748b">${esc(r[2])}</td></tr>`).join('')}
</tbody></table>
<p class="desc">字段构成：${nc} 个数值型（统计/趋势）、${sc} 个文本型（分类/汇总）、${dc} 个日期型（时间序列）。</p>`
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
    s += `<div class="analysis">${analysis}</div>
</div>`
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
        let a = '📊 <strong>图表解读：</strong>该柱状图展示了不同分类维度的数值对比。'
        if (col.mean != null && col.std != null) {
          a += `数据均值约 ${fmtN(col.mean)}，标准差约 ${fmtN(col.std)}，${
            col.std > Math.abs(col.mean) * 0.5 ? '波动显著，建议关注异常分组' : '整体趋于稳定'
          }。`
        }
        return a
      }
      return `📊 <strong>图表解读：</strong>该柱状图展示了「${chart.title}」各分类的数值对比。建议关注数值异常的类别，分析其业务成因。`
    }

    case 'line': {
      if (numCols.length > 0) {
        const col = numCols[Math.min(idx, numCols.length - 1)]
        let a = '📈 <strong>图表解读：</strong>该折线图描绘了变化走势。'
        if (col.max != null && col.min != null) {
          a += `数据在 ${fmtN(col.min)} 至 ${fmtN(col.max)} 之间波动。`
        }
        a += '建议关注波峰波谷节点，对应关键业务事件。'
        return a
      }
      return '📈 <strong>图表解读：</strong>该折线图描绘了变化走势。建议关注拐点时刻，分析变化因素。'
    }

    case 'pie': {
      return '🥧 <strong>图表解读：</strong>该饼图展示了占比分布。重点关注占比较大的类别（主体部分），同时注意是否存在长尾分布。'
    }

    case 'histogram': {
      if (numCols.length > 0) {
        const col = numCols[Math.min(idx, numCols.length - 1)]
        let a = '📊 <strong>图表解读：</strong>该直方图展示数据分布形态。'
        if (col.mean != null && col.std != null) {
          a += `均值约 ${fmtN(col.mean)}，${col.std > Math.abs(col.mean) * 0.5 ? '离散度高' : '相对集中'}。`
        }
        return a
      }
      return '📊 <strong>图表解读：</strong>该直方图展示数据分布。若呈正态分布说明统计特性良好；若偏态建议分析异常成因。'
    }

    default: {
      return `📊 <strong>图表解读：</strong>该${chart.type}图表展示数据特征。建议结合其他指标交叉验证结论。`
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
<td style="font-weight:500">${esc(nm)}</td>
<td style="color:#3b82f6">${esc(TYPE_CN[c.type] || c.type)}</td>
<td>${c.uniqueCount.toLocaleString()}</td>
<td style="color:${mc}">${c.missingPercent.toFixed(1)}%</td>
<td>${isN && c.min != null ? fmtN(c.min) : '-'}</td>
<td>${isN && c.max != null ? fmtN(c.max) : '-'}</td>
<td>${isN && c.mean != null ? fmtN(c.mean) : '-'}</td>
<td>${isN && c.std != null ? fmtN(c.std) : '-'}</td>
</tr>`
  }

  return `<p class="desc">以下列出所有字段的基本统计信息。数值型字段含最小值、最大值、均值、标准差。</p>
<table><thead><tr><th>字段名</th><th>类型</th><th>唯一值</th><th>缺失率</th><th>最小值</th><th>最大值</th><th>均值</th><th>标准差</th></tr></thead><tbody>${rows}</tbody></table>
<p style="font-size:11px;color:#94a3b8;margin-top:6px;">共 ${cols.length} 个字段：${nc} 数值型 · ${sc} 文本型 · ${dc} 日期型 | 缺失率超10%标红</p>`
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
  let desc = `本次分析共发现 ${ins.length} 条洞察。优势 ${pos} 条，风险 ${neg} 条。`
  if (neg > 0) desc += `建议优先关注风险项。`

  let cards = ''
  for (let i = 0; i < ins.length; i++) {
    const item = ins[i]
    const c = INSIGHT_COLORS[item.type] || '#3b82f6'
    const lb = INSIGHT_CN[item.type] || '信息'
    const cl = item.confidence === 'high' ? '高置信度' : item.confidence === 'medium' ? '中等置信度' : '需验证'
    const cc = item.confidence === 'high' ? c : item.confidence === 'medium' ? '#f59e0b' : '#94a3b8'
    cards += `<div class="ins-card"><div class="ins-bar" style="background:${c}"></div><div class="ins-body">
<div class="ins-hdr"><span class="num" style="background:${c}">${String(i + 1).padStart(2, '0')}</span><span class="title" style="color:${c}">${esc(item.title)}</span></div>
<div class="ins-meta"><span class="badge" style="background:${c}">${esc(lb)}</span><span style="color:${cc};font-size:10px">${esc(cl)}</span></div>
<div class="body">${esc(item.content)}</div></div></div>`
  }

  return `<p class="desc">${desc}</p><div class="insight-stats">${stats}</div>${cards}
<div class="summary-block"><strong>📊 综合建议：</strong>基于 ${r.overview.rowCount.toLocaleString()} 行数据的分析，${r.overview.missingPercent <= 3 ? '数据整体质量良好。' : '建议优先处理数据缺失问题。'}${ins.length > 5 ? `共发现 ${ins.length} 条洞察，建议逐条复核。` : '洞察有限，建议上传更全面的数据。'}</div>`
}

function buildFooter(): string {
  return `<div class="footer">
<p><strong>报告声明</strong>：本报告由 DataLens 智能数据分析平台自动生成，仅供决策参考。</p>
<p><strong>数据安全</strong>：所有数据均在浏览器本地处理，不会上传至外部服务器。</p>
<p><strong>生成时间</strong>：${new Date().toLocaleString('zh-CN')}</p>
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
