/**
 * 简岸门店 WMS · 全流程 E2E 冒烟（对应实操指南剧本 A → C → D → B → E）
 * 用法：NODE_PATH 不需要，playwright 从中央 workspace 解析
 *   node smoke-full.mjs
 * 约定（CLAUDE.md）：任何版本交付给用户验收前，必须先跑本脚本全绿。
 * 前提：dev server 已启动（localhost:5173）且刚重启过（内存态干净）。
 */
import { createRequire } from 'module'
const require = createRequire('C:/Users/xiaoencj/.workbuddy/binaries/node/workspace/package.json')
const { chromium } = require('playwright')

const BASE = 'http://localhost:5173'
const results = []
const ok = (name, cond, detail = '') => {
  results.push({ name, pass: !!cond, detail })
  console.log(`${cond ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`)
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

const goto = async (path) => {
  // 页面可能有 setTimeout 自动跳转（如入库后 900ms 回列表），与 goto 竞争——校验 URL 不符则重试
  for (let i = 0; i < 3; i++) {
    await page.goto(`${BASE}/#${path}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    if (page.url().includes(`#${path}`)) return
  }
}
/** 等元素存在且可点 */
const enabled = (sel, timeout = 10000) =>
  page.waitForFunction(
    (s) => {
      const b = document.querySelector(s)
      return b && !b.disabled
    },
    sel,
    { timeout }
  )
const toastText = async () =>
  (await page.locator('.van-toast__text').first().textContent().catch(() => '')) || ''

try {
  // ===== 剧本 A：收货单核点入库（含差异：第三箱实点 6→5） =====
  await goto('/receipt')
  await page.locator('text=ASN20261019001').first().click()
  await page.waitForTimeout(700)
  // 箱 1001/1002 已扫预置，扫第 3 箱
  const boxTag = page.locator('.demo-barcodes .van-tag').first()
  await boxTag.click()
  await page.waitForTimeout(600)
  ok('A1 第三箱扫码后可确认入库', await enabled('.bottom-bar .big-btn, .big-btn[type=primary]'), '')
  // 实点 6→5（最后一行 = BOX-AW-1003 的 stepper）
  await page.locator('.line:last-child .van-stepper__minus').click()
  await page.waitForTimeout(400)
  await page.locator('button', { hasText: '确认入库' }).first().click()
  await page.waitForTimeout(1300)
  ok('A2 入库成功 toast', (await toastText()).length > 0, await toastText())
  // 差异弹窗 → 「稍后处理」应直达差异页（v0.4.7：不再停留死页）
  await page.locator('.van-dialog').waitFor({ state: 'visible', timeout: 5000 })
  await page.locator('.van-dialog__cancel', { hasText: '稍后处理' }).click()
  await page.waitForURL('**/receipt-diffs', { timeout: 6000 })
  ok('A2b 稍后处理直达差异页', page.url().includes('/receipt-diffs'), '')

  // ===== 差异闭环：收货单差异 → 差异页确认 =====
  await goto('/receipt-diffs')
  await page.waitForTimeout(600)
  let diffBody = (await page.locator('body').textContent()).replace(/\s+/g, '')
  ok('A3 差异页出现 CY 待确认单', diffBody.includes('待确认') && diffBody.includes('CY'), '')
  await page.locator('button', { hasText: '确认差异' }).first().click()
  await page.waitForTimeout(900)
  diffBody = (await page.locator('body').textContent()).replace(/\s+/g, '')
  ok('A4 确认后状态=已确认', diffBody.includes('已确认'), '')

  // ===== 快捷扫码差异：实收 ≠ 应收 → 同样生成差异单 =====
  await goto('/receipt-scan')
  await page.locator('.scan-btn').click()
  await page.locator('.van-popup .van-stepper').waitFor({ state: 'visible', timeout: 8000 })
  await page.locator('.van-popup .van-stepper__minus').click()
  await page.waitForTimeout(500)
  await page.locator('button', { hasText: '确认入库' }).first().click()
  await page.waitForTimeout(1000)
  ok('S1 快捷差额生成差异单 toast', (await toastText()).includes('差异单'), await toastText())
  await goto('/receipt-diffs')
  await page.waitForTimeout(600)
  diffBody = (await page.locator('body').textContent()).replace(/\s+/g, '')
  ok('S2 差异页出现快捷来源差异单', diffBody.includes('快捷扫码') && diffBody.includes('待确认'), '')

  // 数据联动：首页待办随差异单生成/确认联动（keep-alive Tab 激活重拉，v0.4.7）
  const homeDiff = async () => {
    await goto('/home')
    return (
      await page.locator('.todo-item', { hasText: '待确认差异' }).locator('.todo-num').textContent()
    ).trim()
  }
  ok('S2b 差异单待确认时首页=1', (await homeDiff()) === '1', '')
  await goto('/receipt-diffs')
  await page.waitForTimeout(600)
  await page.locator('button', { hasText: '确认差异' }).first().click()
  await page.waitForTimeout(900)
  ok('S3 确认后首页联动归 0', (await homeDiff()) === '0', '')

  // ===== 剧本 C：调拨收货（银泰→旗舰店，已签收 5 件：BK-L 2 + BR-M 3） =====
  await goto('/transfer/DB20261017002')
  // 大按钮「扫描箱内商品条码」= 给下一个未扫满的 SKU 记一件，共 5 件
  for (let i = 0; i < 5; i++) {
    await page.locator('button', { hasText: '扫描箱内商品条码' }).first().click()
    await page.waitForTimeout(700)
  }
  await page.locator('button', { hasText: '确认收货并入库' }).first().click()
  await page.waitForTimeout(900)
  ok('C1 调拨 5 件点货入库', (await toastText()).length > 0, await toastText())

  // ===== 剧本 D：退换货（第 1 扫入回原库存 / 第 2 扫归次品 / 第 3 扫人工录入强校验） =====
  await goto('/returns/scan')
  const retScanBtn = page.locator('.scan-btn')
  // 第 1 扫：连衣裙有原单 → 吊牌完好 → 入回原库存
  await retScanBtn.click()
  await page.waitForTimeout(900)
  ok('D1 第 1 扫出原销售单卡', await page.locator('text=原销售单').first().isVisible().catch(() => false))
  await page.locator('button', { hasText: '入回原库存' }).first().click()
  await page.waitForTimeout(900)
  ok('D2 退货单生成', (await page.locator('text=再扫一件').first().isVisible().catch(() => false)))
  // 第 2 扫：衬衫有原单 → 破损 → 归次品（v0.4.9：「再扫一件」= 直接扫下一件，不回空态页）
  await page.locator('button', { hasText: '再扫一件' }).click()
  await page.waitForTimeout(1500)
  await page.locator('.van-radio', { hasText: '破损或已拆封' }).click()
  await page.locator('button', { hasText: '归次品' }).first().click()
  await page.waitForTimeout(900)
  ok('D3 破损归次品提交', (await page.locator('text=再扫一件').first().isVisible().catch(() => false)))
  // 第 3 扫：大衣查无原单 → 人工录入强校验（v0.4.9：退货商品按条码自动填入）
  await page.locator('button', { hasText: '再扫一件' }).click()
  await page.waitForTimeout(1500)
  const manualVisible = await page.locator('text=标记待复核').first().isVisible().catch(() => false)
  const autoFilled = await page
    .locator('.van-field', { hasText: '退货商品' })
    .locator('input')
    .first()
    .inputValue()
    .catch(() => '')
  ok('D4 查无原单出人工录入表单', manualVisible)
  ok('D4b 退货商品按条码自动填入', autoFilled.includes('廓形大衣'), autoFilled)
  // 不勾待复核直接提交 → 被拦
  await page.locator('button', { hasText: '提交人工录入' }).first().click()
  await page.waitForTimeout(700)
  ok('D5 不勾待复核被拦截', (await toastText()).includes('必须勾选'), await toastText())
  await page.locator('.van-checkbox').click()
  await page.locator('button', { hasText: '提交人工录入' }).first().click()
  await page.waitForTimeout(900)
  ok('D6 勾选后提交成功', (await page.locator('text=再扫一件').first().isVisible().catch(() => false)))
  // 待复核角标
  await goto('/returns')
  const badge = await page.locator('.van-badge, .van-info').first().textContent().catch(() => '')
  ok('D7 退换货主页待复核角标 ≥1', Number(badge) >= 1, String(badge))

  // ===== 剧本 P：未匹配条码分件处置（同码 ×2 只核 1 件） =====
  await goto('/receipt-scan')
  await page.locator('button', { hasText: '扫一条未登记条码' }).click()
  await page.waitForTimeout(800)
  await page.locator('button', { hasText: '扫一条未登记条码' }).click()
  await page.waitForTimeout(800)
  const pRow = page.locator('.p-row', { hasText: '×2' }).first()
  ok('P1 同码累加 ×2', await pRow.isVisible().catch(() => false), '')
  const pCode = (await pRow.locator('.p-code').textContent()).trim()
  await pRow.locator('button', { hasText: '处置' }).click()
  await page.locator('.van-action-sheet__item').first().click()
  await page.locator('.van-dialog').waitFor({ state: 'visible', timeout: 5000 })
  await page.locator('.van-dialog__confirm').click()
  await page.waitForTimeout(900)
  // 拆分后：原 ×2 打包条目消失（剩 1 件不显示 ×N），该码出现 已纠正 + 待核实 两条
  const pendingBody = (await page.locator('body').textContent()).replace(/\s+/g, '')
  ok('P2 分件处置拆分 ×2 打包', !pendingBody.includes('×2'), '')
  ok('P3 已处置件独立留痕', pendingBody.includes('已纠正'), '')
  // 剩余 1 件：单件直接处置，不再弹数量选择
  await page
    .locator('.p-row', { hasText: pCode })
    .filter({ has: page.locator('.van-tag', { hasText: '待核实' }) })
    .locator('button', { hasText: '处置' })
    .click()
  await page.locator('.van-action-sheet__item').first().click()
  await page.waitForTimeout(800)
  const codeRows = page.locator('.p-row', { hasText: pCode })
  ok(
    'P4 全部处置闭环（该码 2 条均已纠正）',
    (await codeRows.count()) === 2 &&
      (await codeRows.locator('.van-tag', { hasText: '待核实' }).count()) === 0,
    ''
  )

  // ===== 剧本 B：盘点（连扫 → 对账 → 落账清偏差 → 盘平 + 驳回闭环） =====
  await goto('/stocktake')
  const resetBtn = page.locator('.bottom-bar .big-btn', { hasText: '重新开单' })
  if (await resetBtn.isVisible().catch(() => false)) {
    await resetBtn.click()
    await page.locator('.van-dialog__confirm').click()
    await page.waitForTimeout(800)
  }
  const batchBtn = page.locator('.batch-btn')
  await enabled('.batch-btn')
  await batchBtn.click()
  await page
    .locator('.van-toast', { hasText: '货架已全部扫完' })
    .waitFor({ state: 'visible', timeout: 180000 })
    .catch(() => {})
  await enabled('.batch-btn')
  const fullBody = (await page.locator('body').textContent()).replace(/\s+/g, '')
  ok('B1 连扫全店 12/12', fullBody.includes('12/12'), '')
  await page.locator('.bottom-bar .big-btn', { hasText: '结束盘点' }).click()
  await page.waitForURL('**/stocktake/result', { timeout: 8000 })
  await page.waitForTimeout(800)
  let body = (await page.locator('body').textContent()).replace(/\s+/g, '')
  const loss1 = body.match(/(-?\d+)盘亏件数/)
  const gain1 = body.match(/\+(\d+)盘盈件数/)
  ok('B2 首轮盘亏 -2', loss1 && loss1[1] === '-2', loss1 ? loss1[1] : '未匹配')
  ok('B3 首轮盘盈 +1', gain1 && gain1[1] === '1', gain1 ? gain1[1] : '未匹配')
  // 确认差异落账（覆盖率 100% 不弹护栏）
  await page.locator('button', { hasText: '确认差异' }).first().click()
  await page.waitForTimeout(1500)
  // 第二轮：重开单 → 连扫 → 盘平
  await goto('/stocktake')
  const reset2 = page.locator('.bottom-bar .big-btn', { hasText: '重新开单' })
  if (await reset2.isVisible().catch(() => false)) {
    await reset2.click()
    await page.locator('.van-dialog__confirm').click()
    await page.waitForTimeout(800)
  }
  await enabled('.batch-btn')
  await page.locator('.batch-btn').click()
  await page
    .locator('.van-toast', { hasText: '货架已全部扫完' })
    .waitFor({ state: 'visible', timeout: 180000 })
    .catch(() => {})
  await enabled('.batch-btn')
  await page.locator('.bottom-bar .big-btn', { hasText: '结束盘点' }).click()
  await page.waitForURL('**/stocktake/result', { timeout: 8000 })
  await page.waitForTimeout(800)
  body = (await page.locator('body').textContent()).replace(/\s+/g, '')
  const loss2 = body.match(/(-?\d+)盘亏件数/)
  const gain2 = body.match(/\+(\d+)盘盈件数/)
  ok('B4 落账后次轮盘平（盘亏 0）', loss2 && loss2[1] === '0', loss2 ? loss2[1] : '未匹配')
  ok('B5 落账后次轮盘平（盘盈 0）', gain2 && gain2[1] === '0', gain2 ? gain2[1] : '未匹配')
  // 驳回闭环：重开单 → 点 3 次大按钮（半盘）→ 确认差异 → 护栏弹窗驳回 → 状态恢复
  await goto('/stocktake')
  const reset3 = page.locator('.bottom-bar .big-btn', { hasText: '重新开单' })
  if (await reset3.isVisible().catch(() => false)) {
    await reset3.click()
    await page.locator('.van-dialog__confirm').click()
    await page.waitForTimeout(800)
  }
  await enabled('.scan-btn')
  for (let i = 0; i < 3; i++) {
    await page.locator('.scan-btn').click()
    await page.waitForTimeout(1100)
  }
  await page.locator('.bottom-bar .big-btn', { hasText: '结束盘点' }).click()
  await page.waitForURL('**/stocktake/result', { timeout: 8000 })
  await page.waitForTimeout(800)
  await page.locator('button', { hasText: '确认差异' }).first().click()
  await page.locator('.van-dialog').waitFor({ state: 'visible', timeout: 5000 })
  ok('B6 半盘触发护栏弹窗', true)
  await page.locator('.van-dialog__cancel', { hasText: '驳回重盘' }).click()
  await page.waitForTimeout(1400)
  const status = (await page.locator('.card .van-tag').first().textContent()).trim()
  ok('B7 驳回后状态=盘点中', status === '盘点中', status)
  await enabled('.batch-btn')
  ok('B8 驳回后连扫可点', true)
  const progress = (await page.locator('.progress-text').textContent()).replace(/\s/g, '')
  ok('B9 驳回后已盘保留', progress !== '0/12', progress)

  // ===== 剧本 E：首页数据聚合 + 待办跳转 =====
  await goto('/home')
  ok('E1 首页待办网格渲染', await page.locator('.todo-grid, [class*=todo]').first().isVisible().catch(() => false))
  ok('E2 今日入库卡渲染', await page.locator('text=今日入库').first().isVisible().catch(() => false))
  await page.locator('.todo-item', { hasText: '待确认差异' }).click()
  await page.waitForURL('**/receipt-diffs', { timeout: 6000 })
  ok('E3 待确认差异直达差异页', page.url().includes('/receipt-diffs'), '')

} catch (e) {
  ok('脚本异常', false, String(e).slice(0, 400))
} finally {
  await browser.close()
}

const fails = results.filter((r) => !r.pass)
console.log(`\n==== 全流程冒烟: ${results.length - fails.length}/${results.length} 通过 ====`)
process.exit(fails.length ? 1 : 0)
