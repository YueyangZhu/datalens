// 洞察报告组件

import type { Insight } from '../types'

interface InsightReportProps {
  insights: Insight[]
}

const insightConfig = {
  positive: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'text-green-600',
    badge: 'bg-green-100 text-green-700',
    label: '积极信号',
    iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  negative: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-600',
    badge: 'bg-red-100 text-red-700',
    label: '风险预警',
    iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-700',
    label: '需关注',
    iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700',
    label: '数据洞察',
    iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
}

const confidenceConfig = {
  high: { label: '高可信', color: 'text-green-600' },
  medium: { label: '中可信', color: 'text-amber-600' },
  low: { label: '低可信', color: 'text-slate-400' },
}

export default function InsightReport({ insights }: InsightReportProps) {
  if (insights.length === 0) {
    return null
  }

  return (
    <div className="fade-in">
      <h3 className="text-base font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        AI 洞察报告
        <span className="text-sm font-normal text-slate-400">（共{insights.length}条洞察）</span>
      </h3>
      <div className="space-y-3">
        {insights.map((insight, i) => {
          const config = insightConfig[insight.type]
          const conf = confidenceConfig[insight.confidence]
          return (
            <div
              key={i}
              className={`rounded-xl border p-4 ${config.bg} ${config.border} slide-in`}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 ${config.icon}`}>
                  <svg className="w-5 h-5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.iconPath} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="text-sm font-semibold text-slate-800">{insight.title}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${config.badge}`}>
                      {config.label}
                    </span>
                    <span className={`text-xs ${conf.color}`}>· {conf.label}</span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{insight.content}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
