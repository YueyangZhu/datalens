// PDF导出工具 - 专业格式数据分析报告

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { AnalysisResult } from '../types'

// ============ 类型定义 ============

/** RGB颜色数组 */
type RGB = [number, number, number]

/** 颜色方案 */
const C = {
  primary: [37, 99, 235] as RGB,
  text: [30, 41, 59] as RGB,
  textLight: [100, 116, 139] as RGB,
  border: [226, 232, 240] as RGB,
  bgLight: [248, 250, 252] as RGB,
  bgCard: [255, 255, 255] as RGB,
  positive: [22, 163, 74] as RGB,
  negative: [239, 68, 68] as RGB,
  warning: [245, 158, 11] as RGB,
  info: [59, 130, 246] as RGB,
} as const

const TYPE_LABELS: Record<string, string> = {
  number: '数值型', string: '文本型', date: '日期型', boolean: '布尔型',
}
const INSIGHT_LABELS: Record<string, string> = {
  positive: '优势', negative: '风险', warning: '注意', info: '信息',
}

// ============ 常量 ============
const PW = 210    // A4宽
const PH = 297    // A4高
const ML = 18     // 左边距
const MR = 18     // 右边距
const MT = 20     // 上边距
const MB = 15     // 下边距
const CW = PW - ML - MR // 内容宽度

// ============ 颜色辅助函数 ============
function fc(pdf: jsPDF, r: number, g: number, b: number) { pdf.setFillColor(r, g, b) }
function fcA(pdf: jsPDF, r: number, g: number, b: number, a: number) { pdf.setFillColor(r, g, b, a) }
function dc(pdf: jsPDF, r: number, g: number, b: number) { pdf.setDrawColor(r, g, b) }
function tc(pdf: jsPDF, r: number, g: number, b: number) { pdf.setTextColor(r, g, b) }
function colorOf(type: string): [number, number, number] {
  switch (type) {
    case 'positive': return [C.positive[0], C.positive[1], C.positive[2]]
    case 'negative': return [C.negative[0], C.negative[1], C.negative[2]]
    case 'warning': return [C.warning[0], C.warning[1], C.warning[2]]
    default: return [C.info[0], C.info[1], C.info[2]]
  }
}

/**
 * 导出分析结果为专业PDF报告（主入口）
 */
export async function exportToPDFReport(
  result: AnalysisResult,
  chartElements?: HTMLDivElement[]
): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4')
  let y = MT

  // ---- 封面页 ----
  drawCover(pdf, result)
  pdf.addPage()

  // ---- 执行摘要 ----
  y = MT
  y = drawSummary(pdf, result, y)

  // ---- 数据概览 ----
  checkPage(pdf, y, 40)
  y = sectionTitle(pdf, y, '\u4E00\u3001\u6570\u636E\u6982\u89C8')  // 一、数据概览
  y = drawOverview(pdf, result, y + 5)

  // ---- 图表 ----
  if (result.charts.length > 0) {
    checkPage(pdf, y, 50)
    y = sectionTitle(pdf, y, '\u4E8C\u3001\u53EF\u89C6\u5316\u56FE\u8868')  // 二、可视化图表
    y += 3

    for (let i = 0; i < result.charts.length; i++) {
      const chartEl = chartElements?.[i]
      if (!checkPage(pdf, y, 70)) y = MT
      y = await drawChart(pdf, result.charts[i], chartEl, y)
      y += 3
    }
  }

  // ---- 字段详情 ----
  checkPage(pdf, y, 35)
  y = sectionTitle(pdf, y, '\u4E09\u3001\u5B57\u6BB5\u8BE6\u60C5')  // 三、字段详情
  y = drawFields(pdf, result.columns, y + 5)

  // ---- 洞察与建议 ----
  if (result.insights.length > 0) {
    checkPage(pdf, y, 30)
    y = sectionTitle(pdf, y, '\u56DB\u3001\u6D1E\u5BDF\u4E0E\u5EFA\u8BAE')  // 四、洞察与建议
    y = drawInsights(pdf, result.insights, y + 5)
  }

  // ---- 尾部声明 ----
  checkPage(pdf, y, 25)
  y = drawDisclaimer(pdf, y)

  // ---- 全局页脚 ----
  addFooters(pdf)

  const safeName = result.fileName.replace(/[^\w\u4e00-\u9fa5.-]/g, '_')
  pdf.save(`${safeName}_\u6570\u636E\u5206\u6790\u62A5\u544A.pdf`)  // _数据分析报告.pdf
}

// ==================== 封面 ====================
function drawCover(pdf: jsPDF, r: AnalysisResult): void {
  // 蓝色头部区域
  fc(pdf, 37, 99, 235)
  pdf.rect(0, 0, PW, 115, 'F')
  // 金色装饰条
  fc(pdf, 245, 158, 11)
  pdf.rect(0, 113, PW, 4, 'F')

  // 主标题
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(32)
  pdf.setFont('helvetica', 'bold')
  pdf.text('DataLens', ML + 5, 52)
  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'normal')
  pdf.text('\u667A\u80FD\u6570\u636E\u5206\u6790\u62A5\u544A', ML + 5, 66)  // 智能数据分析报告

  // 元信息区
  let iy = 138
  const lh = 13
  pdf.setFontSize(10); tc(pdf, 100, 116, 139)
  pdf.text('\u62A5\u544A\u6587\u4EF6', ML + 10, iy); iy += lh   // 报告文件
  pdf.text('\u751F\u6210\u65F6\u95F4', ML + 10, iy); iy += lh   // 生成时间
  pdf.text('\u6570\u636E\u89C4\u6A21', ML + 10, iy); iy += lh   // 数据规模
  pdf.text('\u7F3A\u5931\u7387', ML + 10, iy); iy += lh         // 缺失率
  pdf.text('\u91CD\u590D\u884C\u6570', ML + 10, iy)             // 重复行数

  iy = 138
  pdf.setFontSize(11); tc(pdf, 30, 41, 59)
  pdf.text(r.fileName || '-', ML + 48, iy); iy += lh
  pdf.text(formatDate(r.uploadTime), ML + 48, iy); iy += lh
  pdf.text(`${r.overview.rowCount.toLocaleString()} \u884C \u00D7 ${r.overview.colCount} \u5217`, ML + 48, iy); iy += lh
  pdf.text(`${r.overview.missingPercent.toFixed(1)}%`, ML + 48, iy); iy += lh
  pdf.text(`${r.overview.duplicateRows} \u884C`, ML + 48, iy)   // 行

  // 底部品牌
  pdf.setFontSize(8); tc(pdf, 100, 116, 139)
  pdf.text(
    '\u672C\u62A5\u544A\u7531 DataLens \u667A\u80FD\u6570\u636E\u5206\u6790\u5E73\u53F0\u81EA\u52A8\u751F\u6210',
    PW / 2, PH - 22, { align: 'center' })
  pdf.text(
    `\u62A5\u544A\u751F\u6210\u65F6\u95F4\uFF1A${new Date().toLocaleString('zh-CN')}`,
    PW / 2, PH - 14, { align: 'center' })
}

// ==================== 执行摘要 ====================
function drawSummary(pdf: jsPDF, r: AnalysisResult, startY: number): number {
  let y = startY
  pdf.setFontSize(18); tc(pdf, 37, 99, 235); pdf.setFont('helvetica', 'bold')
  pdf.text('\u6267\u884C\u6458\u8981', ML, y)  // 执行摘要
  y += 9
  dc(pdf, 226, 232, 240); pdf.setLineWidth(0.5)
  pdf.line(ML, y, PW - MR, y)
  y += 7

  // 四个指标卡片
  fc(pdf, 248, 250, 252)
  pdf.roundedRect(ML, y, CW, 26, 3, 3, 'F')

  const cardW = CW / 4
  const cards: [string, string, [number, number, number]][] = [
    ['\u603B\u884C\u6570', `${r.overview.rowCount.toLocaleString()}`, [37, 99, 235]],
    ['\u603B\u5217\u6570', `${r.overview.colCount}`, [59, 130, 246]],
    ['\u7F3A\u5931\u503C', `${r.overview.missingCells.toLocaleString()} (${r.overview.missingPercent.toFixed(1)}%)`, [245, 158, 11]],
    ['\u91CD\u590D\u884C', `${r.overview.duplicateRows}`, [239, 68, 68]],
  ]

  for (let i = 0; i < 4; i++) {
    const cx = ML + cardW * i + cardW / 2
    const cc = cards[i][2]
    tc(pdf, cc[0], cc[1], cc[2]); pdf.setFontSize(15); pdf.setFont('helvetica', 'bold')
    pdf.text(cards[i][1], cx, y + 11, { align: 'center' })
    tc(pdf, 100, 116, 139); pdf.setFontSize(8); pdf.setFont('helvetica', 'normal')
    pdf.text(cards[i][0], cx, y + 20, { align: 'center' })
  }
  y += 31

  // 核心发现
  if (r.insights.length > 0) {
    pdf.setFontSize(11); tc(pdf, 30, 41, 59); pdf.setFont('helvetica', 'bold')
    pdf.text('\u6838\u5FC3\u53D1\u73B0', ML, y)  // 核心发现
    y += 6

    const top = r.insights.slice(0, 6)
    for (const ins of top) {
      if (y > PH - MB - 12) break
      const ic = colorOf(ins.type)
      const label = INSIGHT_LABELS[ins.type] || '\u4FE1\u606F'  // 信息

      // 圆点标记
      fc(pdf, ic[0], ic[1], ic[2])
      pdf.circle(ML + 3, y, 2, 'F')
      // 标签底色
      fc(pdf, ic[0], ic[1], ic[2])
      const lw = pdf.getTextWidth(label) + 6
      pdf.roundedRect(ML + 8, y - 3.5, lw, 6, 1.5, 1.5, 'F')
      pdf.setTextColor(255, 255, 255); pdf.setFontSize(7); pdf.setFont('helvetica', 'bold')
      pdf.text(label, ML + 11, y)

      // 内容文字
      tc(pdf, 30, 41, 59); pdf.setFontSize(9); pdf.setFont('helvetica', 'normal')
      const tx = ML + lw + 14
      const lines = pdf.splitTextToSize(ins.title, PW - MR - tx)
      pdf.text(lines, tx, y)
      y += Math.max(9, lines.length * 4.5) + 2
    }
  }

  return y + 6
}

// ==================== 章节标题 ====================
function sectionTitle(pdf: jsPDF, y: number, title: string): number {
  fc(pdf, 37, 99, 235)
  pdf.rect(ML, y - 3, 3, 13, 'F')          // 左侧蓝色竖条
  tc(pdf, 37, 99, 235); pdf.setFontSize(14); pdf.setFont('helvetica', 'bold')
  pdf.text(title, ML + 9, y + 7)
  dc(pdf, 226, 232, 240); pdf.setLineWidth(0.3)
  pdf.line(ML, y + 12, PW - MR, y + 12)
  return y + 17
}

// ==================== 数据概览 ====================
function drawOverview(pdf: jsPDF, r: AnalysisResult, startY: number): number {
  let y = startY

  pdf.setFontSize(10); tc(pdf, 100, 116, 139); pdf.setFont('helvetica', 'normal')
  const desc = `\u672C\u6B21\u5206\u6790\u5BF9\u6587\u4EF6\u300C${r.fileName}\u300D\u8FDB\u884C\u4E86\u5168\u9762\u7684\u6570\u636E\u89E3\u8BFB\u3002\u8BE5\u6570\u636E\u96C6\u5171\u5305\u542B ${r.overview.rowCount.toLocaleString()} \u884C\u8BB0\u5F55\u548C ${r.overview.colCount} \u4E2A\u5B57\u6BB5\u3002`
  pdf.text(pdf.splitTextToSize(desc, CW), ML, y)
  y += 14

  // 表格数据
  const tbl = [
    ['\u6570\u636E\u7EF4\u5EA6', '\u6570\u503C', '\u8BC4\u4F30'],
    ['\u603B\u8BB0\u5F55\u6570', `${r.overview.rowCount.toLocaleString()} \u884C`, r.overview.rowCount >= 100 ? '\u6837\u672C\u91CF\u5145\u8DB3' : '\u6837\u672C\u91CF\u504F\u5C11'],
    ['\u5B57\u6BB5\u6570\u91CF', `${r.overview.colCount} \u5217`, r.overview.colCount >= 5 ? '\u7EF4\u5EA6\u4E30\u5BCC' : '\u7EF4\u5EA6\u8F83\u5C11'],
    ['\u7F3A\u5931\u5355\u5143\u683C', `${r.overview.missingCells.toLocaleString()} \u4E2A`, r.overview.missingPercent <= 5 ? '\u8D28\u91CF\u826F\u597D' : '\u9700\u5173\u6CE8'],
    ['\u7F3A\u5931\u6BD4\u4F8B', `${r.overview.missingPercent.toFixed(2)}%`, r.overview.missingPercent < 3 ? '\u53EF\u63A5\u53D7' : '\u5EFA\u8BAE\u5904\u7406'],
    ['\u5B8C\u5168\u91CD\u590D\u884C', `${r.overview.duplicateRows} \u884C`, r.overview.duplicateRows === 0 ? '\u65E0\u91CD\u590D' : '\u5B58\u5728\u91CD\u590D'],
  ]
  return simpleTable(pdf, tbl, y)
}

// ==================== 图表块 ====================
async function drawChart(
  pdf: jsPDF,
  chart: { id: string; title: string; type: string; description: string },
  chartEl: HTMLElement | undefined,
  startY: number
): Promise<number> {
  let y = startY

  // 标题
  tc(pdf, 30, 41, 59); pdf.setFontSize(11); pdf.setFont('helvetica', 'bold')
  pdf.text(chart.title, ML, y)
  y += 5

  // 描述
  if (chart.description) {
    tc(pdf, 100, 116, 139); pdf.setFontSize(8.5); pdf.setFont('helvetica', 'normal')
    pdf.text(pdf.splitTextToSize(chart.description, CW), ML, y)
    y += 9
  } else {
    y += 4
  }

  // 截图插入
  if (chartEl && chartEl.offsetWidth > 0) {
    try {
      const canvas = await html2canvas(chartEl, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
      })
      const img = canvas.toDataURL('image/png', 1.0)
      const imgW = CW
      const imgH = (canvas.height / canvas.width) * imgW
      const finalH = Math.min(imgH, 82)
      pdf.addImage(img, 'PNG', ML, y, imgW, finalH)
      y += finalH + 3
    } catch {
      y += 5
    }
  } else {
    fc(pdf, 248, 250, 252)
    pdf.roundedRect(ML, y, CW, 18, 2, 2, 'F')
    tc(pdf, 100, 116, 139); pdf.setFontSize(9)
    pdf.text(`[${chart.type.toUpperCase()}] ${chart.title}`, ML + CW / 2, y + 11, { align: 'center' })
    y += 22
  }

  return y
}

// ==================== 字段详情表 ====================
function drawFields(
  pdf: jsPDF,
  cols: Array<{
    name: string; type: string; uniqueCount: number;
    missingCount: number; missingPercent: number;
    min?: number; max?: number; mean?: number; std?: number;
  }>,
  startY: number
): number {
  let y = startY

  // 表头
  const cws = [26, 16, 20, 20, 28, 28, 28]
  const hdrs = ['\u5B57\u6BB5\u540D', '\u7C7B\u578B', '\u552F\u4E00\u503C', '\u7F3A\u5931\u7387', '\u6700\u5C0F\u503C', '\u6700\u5927\u503C', '\u5747\u503C']
  fc(pdf, 240, 246, 255)
  pdf.rect(ML, y - 5, CW, 8, 'F')
  pdf.setFontSize(8); tc(pdf, 30, 41, 59); pdf.setFont('helvetica', 'bold')

  let x = ML
  for (let i = 0; i < hdrs.length; i++) { pdf.text(hdrs[i], x + 2, y); x += cws[i] }
  y += 6

  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5)

  for (let ri = 0; ri < cols.length; ri++) {
    if (y > PH - MB - 8) {
      pdf.addPage(); y = MT
      fc(pdf, 240, 246, 255); pdf.rect(ML, y - 5, CW, 8, 'F')
      pdf.setFont('helvetica', 'bold'); x = ML
      for (let i = 0; i < hdrs.length; i++) { pdf.text(hdrs[i], x + 2, y); x += cws[i] }
      pdf.setFont('helvetica', 'normal'); y += 6
    }

    const col = cols[ri]
    if (ri % 2 === 0) { fc(pdf, 252, 252, 253); pdf.rect(ML, y - 4.5, CW, 7, 'F') }

    tc(pdf, 30, 41, 59); x = ML

    const nm = col.name.length > 7 ? col.name.slice(0, 6) + '..' : col.name
    pdf.text(nm, x + 2, y); x += cws[0]

    tc(pdf, 59, 130, 246)
    pdf.text(TYPE_LABELS[col.type] || col.type, x + 2, y); x += cws[1]

    tc(pdf, 30, 41, 59)
    pdf.text(String(col.uniqueCount), x + 2, y); x += cws[2]
    pdf.text(`${col.missingPercent.toFixed(1)}%`, x + 2, y); x += cws[3]

    if (col.type === 'number' && col.min !== undefined) {
      pdf.text(fmtN(col.min), x + 2, y); x += cws[4]
      pdf.text(fmtN(col.max), x + 2, y); x += cws[5]
      pdf.text(fmtN(col.mean), x + 2, y); x += cws[6]
    } else {
      x += cws[4] + cws[5] + cws[6]
    }
    y += 7
  }

  y += 5
  const nc = cols.filter(c => c.type === 'number').length
  const st = cols.filter(c => c.type === 'string').length
  const dt = cols.filter(c => c.type === 'date').length

  pdf.setFontSize(8.5); tc(pdf, 100, 116, 139); pdf.setFont('helvetica', 'italic')
  pdf.text(`\u5B57\u6BB5\u6784\u6210\uFF1A${nc}\u4E2A\u6570\u503C\u578B \u00B7 ${st}\u4E2A\u6587\u672C\u578B \u00B7 ${dt}\u4E2A\u65E5\u671F\u578B \u00B7 \u5171${cols.length}\u4E2A\u5B57\u6BB5`, ML, y)
  return y + 8
}

// ==================== 洞察列表 ====================
function drawInsights(
  pdf: jsPDF,
  ins: Array<{ type: string; title: string; content: string; confidence: string }>,
  startY: number
): number {
  let y = startY

  // 分类统计
  const counts: Record<string, number> = {}
  for (const i of ins) counts[i.type] = (counts[i.type] || 0) + 1

  fc(pdf, 248, 250, 252)
  pdf.roundedRect(ML, y - 3, CW, 11, 2, 2, 'F')

  let sx = ML + 6
  pdf.setFontSize(8)
  Object.entries(counts).forEach(([tp, cnt]) => {
    const ic = colorOf(tp)
    fc(pdf, ic[0], ic[1], ic[2])
    pdf.circle(sx, y + 2, 1.8, 'F')
    tc(pdf, ic[0], ic[1], ic[2]); pdf.setFont('helvetica', 'bold')
    pdf.text(`${INSIGHT_LABELS[tp]} ${cnt}`, sx + 3, y + 3.5)
    sx += pdf.getTextWidth(`${INSIGHT_LABELS[tp]} ${cnt}`) + 12
  })

  y += 15

  for (let i = 0; i < ins.length; i++) {
    const item = ins[i]

    if (y > PH - MB - 22) { pdf.addPage(); y = MT }

    const ch = 20 + (item.content.length > 55 ? 8 : 0)
    fc(pdf, 255, 255, 255)
    dc(pdf, 226, 232, 240); pdf.setLineWidth(0.3)
    pdf.roundedRect(ML, y - 3, CW, ch, 2, 2, 'FD')

    // 左侧色条
    const barColor = colorOf(item.type)
    fc(pdf, barColor[0], barColor[1], barColor[2])
    pdf.rect(ML, y - 3, 3, ch, 'F')

    // 编号圆圈
    fc(pdf, barColor[0], barColor[1], barColor[2])
    pdf.circle(ML + 9, y + 2.5, 4.5, 'F')
    pdf.setTextColor(255, 255, 255); pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold')
    pdf.text(`${(i + 1).toString().padStart(2, '0')}`, ML + 9, y + 4.5, { align: 'center' })

    // 标题
    tc(pdf, barColor[0], barColor[1], barColor[2]); pdf.setFontSize(10); pdf.setFont('helvetica', 'bold')
    pdf.text(item.title, ML + 17, y + 3.5)

    // 置信度标签
    const cl = confLabel(item.confidence)
    const cw_ = pdf.getTextWidth(cl) + 6
    fcA(pdf, barColor[0], barColor[1], barColor[2], 18)
    pdf.roundedRect(PW - MR - cw_ - 1, y - 0.5, cw_, 5.5, 1, 1, 'F')
    tc(pdf, barColor[0], barColor[1], barColor[2]); pdf.setFontSize(7)
    pdf.text(cl, PW - MR - cw_ + 1, y + 2.5)

    // 内容
    tc(pdf, 30, 41, 59); pdf.setFontSize(8.5); pdf.setFont('helvetica', 'normal')
    const lines = pdf.splitTextToSize(item.content, CW - 24)
    pdf.text(lines, ML + 17, y + 12)

    y += ch + 4
  }

  return y
}

// ==================== 尾部声明 ====================
function drawDisclaimer(pdf: jsPDF, startY: number): number {
  let y = startY + 4
  dc(pdf, 226, 232, 240); pdf.setLineWidth(0.5)
  pdf.line(ML, y, PW - MR, y)
  y += 7

  pdf.setFontSize(8.5); tc(pdf, 100, 116, 139); pdf.setFont('helvetica', 'normal')

  const notes = [
    '\u62A5\u544A\u58F0\u660E\uFF1A\u672C\u62A5\u544A\u7531 DataLens \u667A\u80FD\u6570\u636E\u5206\u6790\u5E73\u53F0\u57FA\u4E8E\u89C4\u5219\u5F15\u64CE\u81EA\u52A8\u751F\u6210\uFF0C\u53EA\u4F9B\u53C2\u8003\u3002',
    '\u6570\u636E\u5904\u7406\uFF1A\u6240\u6709\u6570\u636E\u5747\u5728\u6D4F\u89C8\u5668\u672C\u5730\u5B8C\u6210\u5904\u7406\u548C\u5206\u6790\uFF0C\u4E0D\u4F1A\u4E0A\u4F20\u81F3\u4EFB\u4F55\u5916\u90E8\u670D\u52A1\u5668\u3002',
    '\u5EFA\u8BAE\u64CD\u4F5C\uFF1A\u5982\u53D1\u73B0\u5F02\u5E38\u6570\u636E\u6216\u9700\u8981\u66F4\u6DF1\u5165\u7684\u5206\u6790\uFF0C\u5EFA\u8BAE\u7ED3\u5408\u4E1A\u52A1\u80CC\u666F\u8FDB\u884C\u4EBA\u5DE5\u590D\u6838\u3002',
  ]
  for (const note of notes) {
    const ls = pdf.splitTextToSize(note, CW)
    pdf.text(ls, ML, y)
    y += ls.length * 4 + 3
  }
  return y
}

// ==================== 页脚 ====================
function addFooters(pdf: jsPDF): void {
  const total = pdf.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p)
    dc(pdf, 226, 232, 240); pdf.setLineWidth(0.3)
    pdf.line(ML, PH - MB + 2, PW - MR, PH - MB + 2)
    pdf.setFontSize(8); tc(pdf, 100, 116, 139)
    pdf.text(`\u7B2C ${p} / ${total} \u9875`, PW / 2, PH - 8, { align: 'center' })
    pdf.text('DataLens \u667A\u80FD\u6570\u636E\u5206\u6790\u5E73\u53F0', PW - MR, PH - 8, { align: 'right' })
  }
}

// ==================== 工具函数 ====================
function checkPage(pdf: jsPDF, currentY: number, needH: number): boolean {
  if (currentY + needH > PH - MB) { pdf.addPage(); return false }
  return true
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

function confLabel(c: string): string {
  return c === 'high' ? '\u9AD8\u7F6E\u4FE1\u5EA6' : c === 'medium' ? '\u4E2D\u7B49\u7F6E\u4FE1\u5EA6' : '\u53C2\u8003\u6027\u8D28'
}

function simpleTable(pdf: jsPDF, data: string[][], startY: number): number {
  const colWs = [CW * 0.3, CW * 0.3, CW * 0.4]
  const cellH = 9
  let y = startY

  for (let r = 0; r < data.length; r++) {
    const row = data[r]
    fc(pdf, r % 2 === 0 ? 240 : 255, r % 2 === 0 ? 248 : 255, r % 2 === 0 ? 255 : 255)
    pdf.rect(ML, y - cellH + 3, CW, cellH, 'F')

    let x = ML + 4
    for (let c = 0; c < row.length; c++) {
      if (r === 0) {
        pdf.setFont('helvetica', 'bold'); tc(pdf, 30, 41, 59)
      } else {
        pdf.setFont('helvetica', 'normal')
        tc(pdf, c === 2 ? 100 : 30, c === 2 ? 116 : 41, c === 2 ? 139 : 59)
      }
      pdf.setFontSize(9)
      pdf.text(row[c], x, y)
      x += colWs[c]
    }
    y += cellH
  }
  return y
}

/**
 * 收集页面中所有 ECharts 图表容器的 DOM 元素
 */
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
