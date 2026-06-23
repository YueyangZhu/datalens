// 图表展示组件

import ReactECharts from 'echarts-for-react'
import type { ChartConfig } from '../types'

interface ChartDisplayProps {
  charts: ChartConfig[]
}

export default function ChartDisplay({ charts }: ChartDisplayProps) {
  if (charts.length === 0) {
    return null
  }

  return (
    <div className="fade-in">
      <h3 className="text-base font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
        可视化图表
        <span className="text-sm font-normal text-slate-400">（共{charts.length}个图表）</span>
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {charts.map((chart) => (
          <div key={chart.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-slate-700">{chart.title}</h4>
              <p className="text-xs text-slate-400 mt-0.5">{chart.description}</p>
            </div>
            <div className="echarts-container">
              <ReactECharts
                option={chart.option}
                style={{ height: '300px', width: '100%' }}
                opts={{ renderer: 'canvas' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
