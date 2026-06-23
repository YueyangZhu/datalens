// 列详情组件 - 展示各列的分析结果

import type { ColumnAnalysis } from '../types'

interface ColumnDetailsProps {
  columns: ColumnAnalysis[]
}

const typeConfig = {
  number: { label: '数值型', color: 'bg-blue-100 text-blue-700' },
  string: { label: '文本型', color: 'bg-purple-100 text-purple-700' },
  date: { label: '日期型', color: 'bg-green-100 text-green-700' },
  boolean: { label: '布尔型', color: 'bg-amber-100 text-amber-700' },
}

export default function ColumnDetails({ columns }: ColumnDetailsProps) {
  return (
    <div className="fade-in">
      <h3 className="text-base font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        字段详情
      </h3>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-3 px-4 font-medium text-slate-600">字段名</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">类型</th>
                <th className="text-right py-3 px-4 font-medium text-slate-600">唯一值</th>
                <th className="text-right py-3 px-4 font-medium text-slate-600">缺失</th>
                {columns.some(c => c.type === 'number') && (
                  <>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">最小值</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">最大值</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">平均值</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">总和</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {columns.map((col, i) => {
                const typeConf = typeConfig[col.type]
                return (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-800">{col.name}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${typeConf.color}`}>
                        {typeConf.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">{col.uniqueCount}</td>
                    <td className="py-3 px-4 text-right">
                      {col.missingCount > 0 ? (
                        <span className="text-amber-600">{col.missingCount} ({col.missingPercent.toFixed(1)}%)</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    {columns.some(c => c.type === 'number') && (
                      <>
                        <td className="py-3 px-4 text-right text-slate-600">{col.min !== undefined ? col.min.toLocaleString() : '-'}</td>
                        <td className="py-3 px-4 text-right text-slate-600">{col.max !== undefined ? col.max.toLocaleString() : '-'}</td>
                        <td className="py-3 px-4 text-right text-slate-600">{col.mean !== undefined ? col.mean.toLocaleString() : '-'}</td>
                        <td className="py-3 px-4 text-right text-slate-600">{col.sum !== undefined ? col.sum.toLocaleString() : '-'}</td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
