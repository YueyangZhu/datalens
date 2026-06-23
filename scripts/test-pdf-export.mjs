// PDF导出自动化测试脚本
// 使用 puppeteer-core + 系统 Chrome 在本地 preview 环境测试导出流程

import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PREVIEW_URL = 'http://localhost:4173'
const SAMPLE_FILE = join(__dirname, '..', 'sample-data', '用户增长数据.csv')
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runTest() {
  if (!existsSync(CHROME_PATH)) {
    throw new Error(`未找到 Chrome：${CHROME_PATH}`)
  }
  if (!existsSync(SAMPLE_FILE)) {
    throw new Error(`未找到测试文件：${SAMPLE_FILE}`)
  }

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const errors = []
  const logs = []

  try {
    const page = await browser.newPage()

    // 监听控制台日志
    page.on('console', msg => {
      const text = msg.text()
      logs.push(`[${msg.type()}] ${text}`)
      if (msg.type() === 'error' || text.includes('drawImage') || text.includes('Failed')) {
        errors.push(text)
      }
    })
    page.on('pageerror', err => errors.push(`pageerror: ${err.message}`))

    await page.setViewport({ width: 1280, height: 800 })

    // 打开页面
    console.log(`[1/5] 打开页面：${PREVIEW_URL}`)
    await page.goto(PREVIEW_URL, { waitUntil: 'networkidle2', timeout: 30000 })

    // 等待上传组件渲染
    console.log('[2/5] 等待上传组件...')
    await page.waitForSelector('input[type="file"]', { timeout: 10000 })

    // 上传 CSV 文件
    console.log('[3/5] 上传测试文件...')
    const input = await page.$('input[type="file"]')
    if (!input) throw new Error('未找到文件上传 input')
    await input.uploadFile(SAMPLE_FILE)

    // 等待分析完成（导出按钮出现）
    console.log('[4/5] 等待分析完成...')
    await page.waitForFunction(
      () => {
        const btns = Array.from(document.querySelectorAll('button'))
        return btns.some(b => b.textContent?.includes('导出PDF'))
      },
      { timeout: 30000 }
    )
    await sleep(2000) // 给图表渲染一点时间

    // 点击导出 PDF
    console.log('[5/5] 点击导出 PDF...')
    const btn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      return btns.find(b => b.textContent?.includes('导出PDF'))
    })
    if (!btn) throw new Error('未找到导出 PDF 按钮')
    await btn.click()

    // 等待导出完成
    await sleep(8000)

    // 检查错误
    console.log('\n--- 控制台日志 ---')
    logs.forEach(l => console.log(l))

    if (errors.length > 0) {
      console.error('\n--- 发现错误 ---')
      errors.forEach(e => console.error(e))
      throw new Error('导出过程中检测到错误')
    }

    console.log('\n✅ PDF 导出测试通过：未检测到错误')
  } finally {
    await browser.close()
  }
}

runTest()
  .then(() => {
    console.log('测试成功')
    process.exit(0)
  })
  .catch(err => {
    console.error('测试失败:', err.message)
    process.exit(1)
  })
