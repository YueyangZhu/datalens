// PDF导出工具 - 将分析结果导出为PDF文件

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

/**
 * 将指定DOM元素导出为PDF
 * @param element 要导出的DOM元素
 * @param fileName 文件名
 */
export async function exportElementToPDF(element: HTMLElement, fileName: string): Promise<void> {
  // 1. 将DOM元素转为canvas（高分辨率）
  const canvas = await html2canvas(element, {
    scale: 2,              // 2倍分辨率，保证清晰度
    useCORS: true,         // 允许跨域资源（ECharts图表）
    backgroundColor: '#f8fafc',  // 背景色与页面一致
    logging: false,        // 关闭日志
    windowWidth: element.scrollWidth,  // 确保完整宽度
  })

  // 2. 计算PDF尺寸（A4纸张，纵向）
  const pdfWidth = 210     // A4宽度 mm
  const pdfHeight = 297    // A4高度 mm
  const margin = 10        // 页边距 mm
  const contentWidth = pdfWidth - margin * 2

  // canvas宽高比
  const canvasWidth = canvas.width
  const canvasHeight = canvas.height
  const imgRatio = canvasHeight / canvasWidth

  // 计算图片在PDF中的高度
  const imgWidth = contentWidth
  const imgHeight = imgWidth * imgRatio

  // 3. 将canvas转为图片数据
  const imgData = canvas.toDataURL('image/jpeg', 0.95)

  // 4. 创建PDF，处理分页
  const pdf = new jsPDF('p', 'mm', 'a4')

  // 可用内容高度（每页）
  const pageContentHeight = pdfHeight - margin * 2

  if (imgHeight <= pageContentHeight) {
    // 不需要分页，单页输出
    pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight)
  } else {
    // 需要分页：按内容高度切割图片
    // 计算每个PDF页对应的canvas像素高度
    const pxPerMm = canvasWidth / contentWidth  // 每mm对应的canvas像素数
    const pageHeightInPx = pageContentHeight * pxPerMm

    let remainingHeight = canvasHeight
    let currentY = 0  // canvas上的切割起始Y坐标

    while (remainingHeight > 0) {
      // 当前页对应的canvas高度
      const currentPageHeight = Math.min(pageHeightInPx, remainingHeight)

      // 从canvas截取当前页的部分
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvasWidth
      pageCanvas.height = Math.ceil(currentPageHeight)
      const ctx = pageCanvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
      ctx.drawImage(
        canvas,
        0, currentY,                           // 源图起始坐标
        canvasWidth, currentPageHeight,         // 源图尺寸
        0, 0,                                   // 目标起始坐标
        canvasWidth, currentPageHeight           // 目标尺寸
      )

      const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95)
      const pageImgHeight = (currentPageHeight / pxPerMm)

      // 第一页不需要addPage
      if (currentY > 0) {
        pdf.addPage()
      }

      pdf.addImage(pageImgData, 'JPEG', margin, margin, imgWidth, pageImgHeight)

      currentY += currentPageHeight
      remainingHeight -= currentPageHeight
    }
  }

  // 5. 添加页脚（页码）
  const totalPages = pdf.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setFontSize(8)
    pdf.setTextColor(150, 150, 150)
    pdf.text(
      `DataLens 智能数据分析报告 · 第 ${i}/${totalPages} 页`,
      pdfWidth / 2,
      pdfHeight - 5,
      { align: 'center' }
    )
  }

  // 6. 保存PDF
  const safeFileName = fileName.replace(/[^\w\u4e00-\u9fa5.-]/g, '_')
  pdf.save(`${safeFileName}_分析报告.pdf`)
}
