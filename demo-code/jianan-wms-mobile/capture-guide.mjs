/**
 * 简岸门店 WMS · 图解版指南截图脚本（对应指南 v1.2 / Demo v0.4.8）
 * 用法：dev server 已启动（localhost:5173，内存态干净）后 node capture-guide.mjs
 * 输出：../../第5章~第8章/guide-images-v2/           （干净版）
 *       ../../第5章~第8章/guide-images-v2-annotated/（红框标注版）
 */
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
const require = createRequire('C:/Users/xiaoencj/.workbuddy/binaries/node/workspace/package.json')
const { chromium } = require('playwright')

const BASE = 'http://localhost:5173'
const CLEAN = 'D:/XboxGames/AI/AI_upclass/第5章~第8章/guide-images-v2'
const ANNO = 'D:/XboxGames/AI/AI_upclass/第5章~第8章/guide-images-v2-annotated'
fs.mkdirSync(CLEAN, { recursive: true })
fs.mkdirSync(ANNO, { recursive: true })

const results = []
const ok = (name, cond, detail = '') => {
  results.push({ name, pass: !!cond, detail })
  console.log(`${cond ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`)
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })

const goto = async (p) => {
  for (let i = 0; i < 3; i++) {
    await page.goto(`${BASE}/#${p}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    if (page.url().includes(`#${p}`)) return
  }
}
const enabled = (sel, timeout = 10000) =>
  page.waitForFunction((s) => { const b = document.querySelector(s); return b && !b.disabled }, sel, { timeout })
const toastWait = async (ms = 5000) => page.waitForSelector('.van-toast', { state: 'visible', timeout: ms }).catch(() => null)
const toastText = async () => (await page.locator('.van-toast__text').first().textContent().catch(() => '')) || ''

// 标注：红框 outline —— 用行内样式（addStyleTag 会在导航后失效，导致标注丢失）
const HL_CSS = 'outline:3px solid #ee0a24 !important;outline-offset:2px;z-index:9999;'
const clearHl = async () =>
  page.evaluate(() => document.querySelectorAll('.cap-hl').forEach((e) => {
    e.classList.remove('cap-hl')
    e.style.outline = ''
    e.style.outlineOffset = ''
  }))
const hlSel = async (sel) =>
  page.evaluate(([s, css]) => { const e = document.querySelector(s); if (e) { e.classList.add('cap-hl'); e.style.cssText += ';' + css } return !!e }, [sel, HL_CSS])
const hlText = async (t) =>
  page.evaluate(([x, css]) => {
    const xp = `//*[contains(normalize-space(.),'${x}') and not(descendant::*[contains(normalize-space(.),'${x}')])]`
    const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
    if (el) { el.classList.add('cap-hl'); el.style.cssText += ';' + css; return true }
    return false
  }, [t, HL_CSS])

/** 截干净版 + 标注版。hl: [{sel}|{text}] */
const shot = async (name, hl = []) => {
  await page.screenshot({ path: path.join(CLEAN, `${name}.png`) })
  let any = true
  for (const h of hl) any = (h.sel ? await hlSel(h.sel) : await hlText(h.text)) && any
  // 断言标注真实渲染（computedStyle outline 生效），防止样式静默失效
  if (hl.length && any) {
    const rendered = await page.evaluate(() => {
      const e = document.querySelector('.cap-hl')
      return e ? getComputedStyle(e).outlineWidth : 'none'
    })
    if (rendered !== '3px') { any = false; console.log(`WARN | ${name} 标注未渲染 outlineWidth=${rendered}`) }
  }
  await page.screenshot({ path: path.join(ANNO, `${name}.png`) })
  await clearHl()
  ok(name, any, hl.length ? '标注命中' : '无标注')
}

try {
  // ===== 复位：清 localStorage → reload =====
  await goto('/home')
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(900)

  // ===== 剧本 E 开场：首页 / 功能页 =====
  await shot('01-home')
  await goto('/functions')
  await shot('02-functions', [{ text: '收货单' }])

  // ===== 剧本 A-1：收货单核点（含差异挂账闭环） =====
  await goto('/receipt')
  await shot('03-receipt-list', [{ text: 'ASN20261019001' }])
  await page.locator('text=ASN20261019001').first().click()
  await page.waitForTimeout(700)
  await shot('04-receipt-detail', [{ sel: '.demo-barcodes .van-tag:last-child' }])
  await page.locator('.demo-barcodes .van-tag:last-child').click()
  await page.waitForTimeout(600)
  await shot('05-receipt-scanned', [{ text: '确认入库' }])
  await page.locator('button', { hasText: '扫一条错误箱码' }).click()
  await toastWait()
  await page.waitForTimeout(300)
  await shot('06-receipt-unknown', [{ sel: '.van-toast' }])
  await page.waitForTimeout(2200)
  // 第三箱实点 6→5
  await page.locator('.line:last-child .van-stepper__minus').click()
  await page.waitForTimeout(500)
  await shot('07-receipt-diff-step', [{ sel: '.line:last-child' }, { text: '确认入库' }])
  await page.locator('button', { hasText: '确认入库' }).first().click()
  await page.locator('.van-dialog').waitFor({ state: 'visible', timeout: 6000 })
  await page.waitForTimeout(400)
  await shot('08-receipt-diff-dialog', [{ sel: '.van-dialog__cancel' }])
  await page.locator('.van-dialog__cancel', { hasText: '稍后处理' }).click()
  await page.waitForURL('**/receipt-diffs', { timeout: 6000 })
  await page.waitForTimeout(600)
  await shot('09-receipt-diffs', [{ text: '确认差异' }])
  await goto('/home')
  await shot('10-home-diff', [{ text: '待确认差异' }])
  await goto('/receipt-diffs')
  await page.waitForTimeout(600)
  await page.locator('button', { hasText: '确认差异' }).first().click()
  await page.waitForTimeout(900)
  await shot('11-receipt-diffs-confirmed', [{ text: '已确认' }])

  // ===== 剧本 A-2：快捷扫码（差额同口径差异单） =====
  await goto('/receipt-scan')
  await page.locator('.scan-btn').click()
  await page.locator('.van-popup .van-stepper').waitFor({ state: 'visible', timeout: 8000 })
  await shot('12-receipt-scan', [{ text: '确认入库' }])
  await page.locator('.van-popup .van-stepper__minus').click()
  await page.waitForTimeout(400)
  await page.locator('button', { hasText: '确认入库' }).first().click()
  await toastWait()
  await page.waitForTimeout(300)
  await shot('13-scan-diff-toast', [{ sel: '.van-toast' }])
  await page.waitForTimeout(2200)

  // ===== 剧本 P：未匹配条码分件处置（×2 拆分） =====
  await page.locator('button', { hasText: '扫一条未登记条码' }).click()
  await page.waitForTimeout(800)
  await page.locator('button', { hasText: '扫一条未登记条码' }).click()
  await page.waitForTimeout(800)
  const pRow = page.locator('.p-row', { hasText: '×2' }).first()
  ok('P-x2 行出现', await pRow.isVisible().catch(() => false))
  await shot('14-pending-x2', [{ text: '处置' }])
  await pRow.locator('button', { hasText: '处置' }).click()
  await page.locator('.van-action-sheet').waitFor({ state: 'visible', timeout: 5000 })
  await page.waitForTimeout(300)
  await shot('15-pending-dispose-sheet', [{ sel: '.van-action-sheet__item' }])
  await page.locator('.van-action-sheet__item').first().click()
  await page.locator('.van-dialog').waitFor({ state: 'visible', timeout: 5000 })
  await page.waitForTimeout(300)
  await shot('16-pending-dispose-dialog', [{ sel: '.van-dialog .van-stepper' }])
  await page.locator('.van-dialog__confirm').click()
  await page.waitForTimeout(900)
  await shot('17-pending-split', [{ text: '待核实' }, { text: '已纠正' }])
  // 剩余 1 件处置闭环
  const pCode = (await page.locator('.p-row').filter({ has: page.locator('.van-tag', { hasText: '待核实' }) }).first().locator('.p-code').textContent()).trim()
  await page.locator('.p-row', { hasText: pCode }).filter({ has: page.locator('.van-tag', { hasText: '待核实' }) }).locator('button', { hasText: '处置' }).click()
  await page.locator('.van-action-sheet__item').first().click()
  await page.waitForTimeout(900)
  await shot('18-pending-closed')
  // 收尾：确认快捷扫码差异单（状态归零）
  await goto('/receipt-diffs')
  await page.waitForTimeout(600)
  await page.locator('button', { hasText: '确认差异' }).first().click()
  await page.waitForTimeout(800)

  // ===== 剧本 C：调拨收货 =====
  await goto('/transfer')
  await shot('19-transfer-list', [{ text: 'DB20261017002' }])
  await goto('/transfer/DB20261017002')
  await page.waitForTimeout(700)
  await shot('20-transfer-detail', [{ text: '扫描箱内商品条码' }])
  for (let i = 0; i < 5; i++) {
    await page.locator('button', { hasText: '扫描箱内商品条码' }).first().click()
    await page.waitForTimeout(700)
  }
  await shot('21-transfer-scanned', [{ text: '确认收货并入库' }])
  await page.locator('button', { hasText: '确认收货并入库' }).first().click()
  await toastWait()
  await page.waitForTimeout(300)
  await shot('22-transfer-done', [{ sel: '.van-toast' }])
  await page.waitForTimeout(2200)

  // ===== 剧本 D：退换货 =====
  await goto('/returns')
  await shot('23-returns-home', [{ text: '扫码验退' }])
  await goto('/returns/scan')
  await page.locator('.scan-btn').click()
  await page.waitForTimeout(900)
  await shot('24-return-matched', [{ text: '入回原库存' }])
  await page.locator('button', { hasText: '入回原库存' }).first().click()
  await page.waitForTimeout(900)
  await shot('25-return-done')
  // 第 2 扫：破损归次品（v0.4.9：「再扫一件」= 直接扫下一件）
  await page.locator('button', { hasText: '再扫一件' }).click()
  await page.waitForTimeout(1500)
  await page.locator('.van-radio', { hasText: '破损或已拆封' }).click()
  await page.waitForTimeout(300)
  await shot('26-return-defective', [{ text: '归次品' }])
  await page.locator('button', { hasText: '归次品' }).first().click()
  await page.waitForTimeout(900)
  // 第 3 扫：查无原单 → 人工录入（v0.4.9：退货商品按条码自动填入，无需手选）
  await page.locator('button', { hasText: '再扫一件' }).click()
  await page.waitForTimeout(2400) // 等上一扫的成功 toast 消失再截图
  await shot('27-return-manual', [{ text: '必勾' }])
  await page.locator('button', { hasText: '提交人工录入' }).first().click()
  await toastWait()
  await page.waitForTimeout(300)
  await shot('28-return-blocked', [{ sel: '.van-toast' }])
  await page.waitForTimeout(2000)
  await page.locator('.van-checkbox').click()
  await page.locator('button', { hasText: '提交人工录入' }).first().click()
  await page.waitForTimeout(900)
  // D-2 待复核闭环
  await goto('/returns/review')
  await page.waitForTimeout(700)
  await shot('29-return-review', [{ text: '补录原单' }])
  page.once('dialog', (d) => d.accept('XS202610210077'))
  await page.locator('button', { hasText: '补录原单' }).first().click()
  await page.locator('.van-dialog__confirm').click()
  await page.waitForTimeout(1200)
  await shot('30-return-review-done', [{ text: '已复核' }])

  // ===== 剧本 D-3：次品登记 =====
  await goto('/defective')
  await page.waitForTimeout(700)
  await shot('31-defective-list', [{ sel: '.fab' }])
  await page.locator('.fab').click()
  await page.waitForTimeout(600)
  // 先留空提交 → 被拦
  await page.locator('.reg-form .big-btn').click()
  await toastWait()
  await page.waitForTimeout(300)
  await shot('32-defective-blocked', [{ sel: '.van-toast' }])
  await page.waitForTimeout(2000)
  // 选 SKU + 填原因 → 成功
  await page.locator('.reg-form .van-field').first().click()
  await page.waitForTimeout(600)
  await page.locator('.van-picker__confirm').click()
  await page.waitForTimeout(500)
  await page.locator('.reg-form textarea').fill('陈列磨损')
  await page.waitForTimeout(300)
  await shot('33-defective-register', [{ sel: '.reg-form .big-btn' }])
  await page.locator('.reg-form .big-btn').click()
  await page.waitForTimeout(900)
  // 促销处理（退换货第 2 扫生成的 CP 待处理条目）：直接执行 + toast
  await page.locator('button', { hasText: '促销处理' }).first().click()
  await toastWait()
  await page.waitForTimeout(400)
  await shot('35-defective-promoted', [{ text: '已促销处理' }])
  await page.waitForTimeout(2000)

  // ===== 剧本 B：盘点（连扫 → 落账 → 盘平 → 护栏驳回） =====
  await goto('/stocktake')
  await page.waitForTimeout(700)
  await shot('36-stocktake-task', [{ sel: '.batch-btn' }])
  await enabled('.batch-btn')
  await page.locator('.batch-btn').click()
  await page.waitForTimeout(2500)
  await shot('37-stocktake-batching')
  await page.locator('.van-toast', { hasText: '货架已全部扫完' }).waitFor({ state: 'visible', timeout: 120000 }).catch(() => {})
  await page.waitForTimeout(300)
  await shot('38-stocktake-full', [{ sel: '.van-toast' }, { text: '结束盘点' }])
  await page.locator('.bottom-bar .big-btn', { hasText: '结束盘点' }).click()
  await page.waitForURL('**/stocktake/result', { timeout: 8000 })
  await page.waitForTimeout(800)
  await shot('39-result-100', [{ text: '确认差异' }])
  await page.locator('button', { hasText: '确认差异' }).first().click()
  await page.waitForTimeout(1500)
  // 落账后：重新开单按钮出现
  await goto('/stocktake')
  await page.waitForTimeout(700)
  await shot('40-reopen-btn', [{ text: '重新开单' }])
  await page.locator('.bottom-bar .big-btn', { hasText: '重新开单' }).click()
  await page.locator('.van-dialog').waitFor({ state: 'visible', timeout: 5000 })
  await page.waitForTimeout(300)
  await shot('41-reopen-dialog', [{ sel: '.van-dialog__confirm' }])
  await page.locator('.van-dialog__confirm').click()
  await page.waitForTimeout(800)
  await enabled('.batch-btn')
  await page.locator('.batch-btn').click()
  await page.locator('.van-toast', { hasText: '货架已全部扫完' }).waitFor({ state: 'visible', timeout: 120000 }).catch(() => {})
  await enabled('.batch-btn')
  await page.locator('.bottom-bar .big-btn', { hasText: '结束盘点' }).click()
  await page.waitForURL('**/stocktake/result', { timeout: 8000 })
  await page.waitForTimeout(800)
  await shot('42-result-flat', [{ text: '盘平' }])
  // 半盘护栏
  await goto('/stocktake')
  await page.waitForTimeout(700)
  await page.locator('.bottom-bar .big-btn', { hasText: '重新开单' }).click()
  await page.locator('.van-dialog__confirm').click()
  await page.waitForTimeout(800)
  await enabled('.scan-btn')
  for (let i = 0; i < 3; i++) {
    await page.locator('.scan-btn').click()
    await page.waitForTimeout(1100)
  }
  await page.locator('.bottom-bar .big-btn', { hasText: '结束盘点' }).click()
  await page.waitForURL('**/stocktake/result', { timeout: 8000 })
  await page.waitForTimeout(800)
  await shot('43-result-partial', [{ text: '确认差异' }])
  await page.locator('button', { hasText: '确认差异' }).first().click()
  await page.locator('.van-dialog').waitFor({ state: 'visible', timeout: 5000 })
  await page.waitForTimeout(300)
  await shot('44-guard-dialog', [{ sel: '.van-dialog__cancel' }])
  await page.locator('.van-dialog__cancel', { hasText: '驳回重盘' }).click()
  await page.waitForTimeout(1400)
  await shot('45-stocktake-resumed', [{ text: '盘点中' }])

  // ===== 剧本 E 收尾：库存 / 我的 =====
  await goto('/inventory')
  await shot('46-inventory', [{ text: '挂账' }])
  await goto('/profile')
  await shot('47-profile', [{ text: '重置演示数据' }])
} catch (e) {
  ok('脚本异常', false, String(e).slice(0, 500))
} finally {
  await browser.close()
}

const fails = results.filter((r) => !r.pass)
console.log(`\n==== 截图完成: ${results.length - fails.length}/${results.length} ====`)
process.exit(fails.length ? 1 : 0)
