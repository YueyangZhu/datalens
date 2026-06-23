// 数据解析模块 - 解析Excel/CSV文件为统一的数据结构

import * as XLSX from 'xlsx'
import type { DataTable } from '../types'

/**
 * 解析上传的文件（Excel或CSV）为DataTable结构
 */
export async function parseFile(file: File): Promise<DataTable> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

  // 取第一个Sheet
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('文件中没有数据表')
  }

  const sheet = workbook.Sheets[sheetName]

  // 转为JSON数组（带表头）
  const jsonData = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
  })

  if (jsonData.length === 0) {
    throw new Error('文件内容为空')
  }

  // 第一行作为表头
  const headers = (jsonData[0] as (string | number)[]).map((h, i) =>
    h !== null && h !== undefined ? String(h) : `列${i + 1}`
  )

  // 剩余行作为数据
  const rows = jsonData.slice(1).map(row =>
    (row as (string | number | null)[]).map(cell => {
      if (cell === null || cell === undefined || cell === '') return null
      // 日期对象转为字符串（cellDates:true时日期会被解析为Date对象）
      if (typeof cell === 'object' && cell !== null && 'toISOString' in cell) {
        const d = cell as Date
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }
      return cell as string | number | null
    })
  )

  // 过滤全空行
  const filteredRows = rows.filter(row =>
    row.some(cell => cell !== null && cell !== '')
  )

  return {
    headers,
    rows: filteredRows,
    fileName: file.name,
    rowCount: filteredRows.length,
    colCount: headers.length,
  }
}

/**
 * 获取文件大小描述
 */
export function getFileSize(file: File): string {
  const size = file.size
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
