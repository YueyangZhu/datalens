// 文件上传组件

import { useState, useRef, useCallback } from 'react'
import { parseFile, getFileSize } from '../utils/dataParser'
import type { DataTable } from '../types'

interface FileUploadProps {
  onFileLoaded: (data: DataTable) => void
  onError: (msg: string) => void
}

export default function FileUpload({ onFileLoaded, onError }: FileUploadProps) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    // 校验文件类型
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      '',
    ]
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      onError('请上传 Excel (.xlsx/.xls) 或 CSV (.csv) 文件')
      return
    }

    // 校验文件大小（10MB）
    if (file.size > 10 * 1024 * 1024) {
      onError('文件大小不能超过 10MB')
      return
    }

    setLoading(true)
    try {
      const data = await parseFile(file)
      if (data.rowCount === 0) {
        onError('文件内容为空，请检查文件')
        setLoading(false)
        return
      }
      onFileLoaded(data)
    } catch (e) {
      onError(`文件解析失败：${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }, [onFileLoaded, onError])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // 重置input，允许重复上传同一文件
    e.target.value = ''
  }, [handleFile])

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !loading && inputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300
        ${dragging
          ? 'border-primary-500 bg-primary-50 scale-[1.02]'
          : 'border-slate-300 bg-white hover:border-primary-400 hover:bg-slate-50'
        }
        ${loading ? 'pointer-events-none opacity-70' : ''}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleChange}
        className="hidden"
      />

      {loading ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-slate-600 text-sm">正在解析文件...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors
            ${dragging ? 'bg-primary-500' : 'bg-primary-100'}`}>
            <svg className={`w-8 h-8 ${dragging ? 'text-white' : 'text-primary-600'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-medium text-slate-700">
              {dragging ? '松开鼠标即可上传' : '拖拽文件到此处，或点击选择文件'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              支持 Excel (.xlsx / .xls) 和 CSV (.csv) 格式，最大 10MB
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
