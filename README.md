# DataLens - 智能数据分析平台

上传 Excel/CSV 文件，自动生成可视化图表和 AI 洞察报告。

## 功能

- 拖拽上传 Excel(.xlsx/.xls) / CSV(.csv)，最大 10MB
- 自动数据解析与概览（行数、列数、缺失值、重复行）
- 智能图表生成（柱状图、折线图、饼图、直方图、多维对比，最多5种）
- AI 洞察报告（数据质量、波动性、集中度、贡献度等）
- 字段详情（类型检测、统计指标）
- 历史记录（最近50条）

## 技术栈

- React 18 + TypeScript + Vite 6
- TailwindCSS 3
- ECharts 5 (echarts-for-react)
- xlsx (SheetJS)

## 开发

```bash
npm install
npm run dev      # 本地开发
npm run build    # 构建生产版本
npm run preview  # 预览生产版本
```

## 部署

支持任何静态托管服务：EdgeOne Pages、Vercel、Cloudflare Pages、GitHub Pages 等。

- 构建命令：`npm run build`
- 输出目录：`dist`
