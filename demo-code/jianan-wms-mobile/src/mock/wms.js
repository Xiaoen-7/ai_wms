/**
 * 简岸门店 WMS — Mock 数据层
 *
 * 数据口径对齐 PRD《简岸门店WMS-PRD》v2.2（20261021 账务专项版）：
 * - 库存账 = sku × 门店 × 四科目状态（可售 / 在途池 / 次品 / 待清理挂账量），见 PRD 5.9.1、8.1.1
 * - 事件流水只增不改，修正走反向事件，见 PRD 5.9.1
 * - 守恒恒等式（8.1.1）：Σ(四科目) 只随事件变动，任何操作前后合计不变
 * - 签收即入库（5.1.1、5.4.2）：单据状态与库存记账解耦，按实到件数入库，差额进挂账
 * - 调拨状态机见 PRD 3.5；单据状态机防重（非 8.1.2 幂等表，见 CLAUDE.md 偏差声明）
 *
 * 所有函数模拟 200~400ms 网络延迟；写操作会改内存中的库，刷新页面即复位。
 */

// ============================ 基础工具 ============================

const delay = (ms = 260) => new Promise((resolve) => setTimeout(resolve, ms))

/** 生成 2026-10-19 12:30:45 这样的本地时间串 */
function nowStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}:${p(d.getSeconds())}`
}

/** 生成 HH:mm 时间串，用于页脚数据时间戳 */
function hhmm() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 单据号：SD + 年月日 + 4 位序号 */
let seqMap = {}
function makeNo(prefix) {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const day = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
  const key = prefix + day
  seqMap[key] = (seqMap[key] || 0) + 1
  return `${prefix}${day}${String(seqMap[key]).padStart(4, '0')}`
}

// ============================ 商品主数据 ============================

/**
 * 商品主数据：货号 + 颜色 + 尺码 → SKU
 * 简岸为中高端女装连锁，主数据按「货号-颜色-尺码」三要素构成 SKU。
 */
export const PRODUCTS = [
  { sku: 'JN24AW001-BK-S', code: 'JN24AW001', name: '羊毛混纺廓形大衣', color: '黑色', size: 'S', price: 1899 },
  { sku: 'JN24AW001-BK-M', code: 'JN24AW001', name: '羊毛混纺廓形大衣', color: '黑色', size: 'M', price: 1899 },
  { sku: 'JN24AW001-CM-M', code: 'JN24AW001', name: '羊毛混纺廓形大衣', color: '驼色', size: 'M', price: 1899 },
  { sku: 'JN24AW008-WH-S', code: 'JN24AW008', name: '真丝提花衬衫', color: '米白', size: 'S', price: 899 },
  { sku: 'JN24AW008-WH-M', code: 'JN24AW008', name: '真丝提花衬衫', color: '米白', size: 'M', price: 899 },
  { sku: 'JN24AW008-NV-M', code: 'JN24AW008', name: '真丝提花衬衫', color: '藏青', size: 'M', price: 899 },
  { sku: 'JN24AW015-RD-M', code: 'JN24AW015', name: '高腰阔腿西装裤', color: '砖红', size: 'M', price: 699 },
  { sku: 'JN24AW015-BK-L', code: 'JN24AW015', name: '高腰阔腿西装裤', color: '黑色', size: 'L', price: 699 },
  { sku: 'JN24AW022-GY-S', code: 'JN24AW022', name: '羊绒针织开衫', color: '浅灰', size: 'S', price: 1299 },
  { sku: 'JN24AW022-GY-M', code: 'JN24AW022', name: '羊绒针织开衫', color: '浅灰', size: 'M', price: 1299 },
  { sku: 'JN24AW030-BR-M', code: 'JN24AW030', name: '法式碎花连衣裙', color: '咖啡', size: 'M', price: 1099 },
  { sku: 'JN24AW030-BR-L', code: 'JN24AW030', name: '法式碎花连衣裙', color: '咖啡', size: 'L', price: 1099 }
]

/** 条码 → 商品。真实系统由条码解析库比对商品主数据，见 PRD 待确认项 2 */
export const BARCODE_MAP = {
  '6901001001011': 'JN24AW001-BK-S',
  '6901001001012': 'JN24AW001-BK-M',
  '6901001001013': 'JN24AW001-CM-M',
  '6901001001021': 'JN24AW008-WH-S',
  '6901001001022': 'JN24AW008-WH-M',
  '6901001001023': 'JN24AW008-NV-M',
  '6901001001031': 'JN24AW015-RD-M',
  '6901001001032': 'JN24AW015-BK-L',
  '6901001001041': 'JN24AW022-GY-S',
  '6901001001042': 'JN24AW022-GY-M',
  '6901001001051': 'JN24AW030-BR-M',
  '6901001001052': 'JN24AW030-BR-L'
}

export function findProductBySku(sku) {
  return PRODUCTS.find((p) => p.sku === sku) || null
}

export function findProductByBarcode(code) {
  const sku = BARCODE_MAP[code]
  return sku ? findProductBySku(sku) : null
}

// ============================ 门店 ============================

/** 当前门店（旗舰店，访谈对象张姐所在店，见 PRD 7.1 B1） */
export const CURRENT_STORE = {
  id: 'S001',
  name: '简岸·旗舰店',
  manager: '张姐'
}

/** 其他门店，用于调拨收发货方与库存共享展示 */
export const STORES = [CURRENT_STORE]

// ============================ 库存账 ============================

/**
 * 库存账：[{ sku, sellable, inTransit, defective, holding }]
 * 四科目对齐 PRD v2.2 8.1.1：可售 / 在途池 / 次品 / 待清理挂账量。
 * 守恒恒等式：Σ(sellable+inTransit+defective+holding) 只随事件变动，任何操作前后合计不变。
 */
const inventory = [
  { sku: 'JN24AW001-BK-S', sellable: 6, inTransit: 0, defective: 1, holding: 0 },
  { sku: 'JN24AW001-BK-M', sellable: 11, inTransit: 4, defective: 0, holding: 0 },
  { sku: 'JN24AW001-CM-M', sellable: 3, inTransit: 0, defective: 0, holding: 0 },
  { sku: 'JN24AW008-WH-S', sellable: 14, inTransit: 0, defective: 2, holding: 0 },
  { sku: 'JN24AW008-WH-M', sellable: 9, inTransit: 6, defective: 0, holding: 0 },
  { sku: 'JN24AW008-NV-M', sellable: 4, inTransit: 0, defective: 0, holding: 0 },
  { sku: 'JN24AW015-RD-M', sellable: 18, inTransit: 0, defective: 0, holding: 0 },
  { sku: 'JN24AW015-BK-L', sellable: 7, inTransit: 2, defective: 3, holding: 0 },
  { sku: 'JN24AW022-GY-S', sellable: 5, inTransit: 0, defective: 0, holding: 0 },
  { sku: 'JN24AW022-GY-M', sellable: 12, inTransit: 0, defective: 1, holding: 0 },
  { sku: 'JN24AW030-BR-M', sellable: 8, inTransit: 3, defective: 0, holding: 0 },
  { sku: 'JN24AW030-BR-L', sellable: 2, inTransit: 0, defective: 0, holding: 0 }
]
// 注：JN24AW030-BR-M inTransit=3 对应调拨单 DB20261017002（已签收待点货 3 件），
// JN24AW015-BK-L inTransit=2 对应同单 2 件——初始数据满足守恒（v0.3.0 修复：原 0 不守恒）。

/** 库存最后同步时间戳（PRD 5.3.1 页脚标注数据时间） */
let invSyncedAt = '10:00'

function invRow(sku) {
  let row = inventory.find((r) => r.sku === sku)
  if (!row) {
    row = { sku, sellable: 0, inTransit: 0, defective: 0, holding: 0 }
    inventory.push(row)
  }
  return row
}

/** 合并商品主数据 + 库存数，供列表渲染 */
function joinProduct(row) {
  const p = findProductBySku(row.sku) || {}
  return {
    ...row,
    code: p.code || '-',
    name: p.name || '未知商品',
    color: p.color || '-',
    size: p.size || '-',
    price: p.price || 0,
    total: row.sellable + row.inTransit + row.defective + row.holding
  }
}

/** 守恒校验（PRD v2.2 8.1.1）：合计只随事件变动，用于开发调试断言 */
function inventoryTotal() {
  return inventory.reduce((s, r) => s + r.sellable + r.inTransit + r.defective + r.holding, 0)
}

// ============================ 收货单（扫码入库） ============================

/**
 * 待收货单：一箱多 SKU 时逐箱扫，此处演示 3 个箱。
 * docQty = 送货单应收数量；PRD 5.1.1 要求逐行与送货单对比，差异行红色高亮。
 */
const receipts = [
  {
    receiptNo: 'ASN20261019001',
    supplier: '杭州简岸服饰制造有限公司',
    arriveAt: '2026-10-19 09:20',
    status: '待收货', // 待收货 / 已入库 / 有差异
    boxes: [
      {
        boxCode: 'BOX-AW-1001',
        sku: 'JN24AW001-BK-M',
        docQty: 5,
        scanned: true
      },
      {
        boxCode: 'BOX-AW-1002',
        sku: 'JN24AW008-WH-M',
        docQty: 8,
        scanned: true
      },
      {
        boxCode: 'BOX-AW-1003',
        sku: 'JN24AW022-GY-M',
        docQty: 6,
        scanned: false
      }
    ]
  },
  {
    // 第二张待收货单（v0.3.0）：演示多单流转与「已入库后防重复操作」拦截
    receiptNo: 'ASN20261020002',
    supplier: '广州简岸服装有限公司',
    arriveAt: '2026-10-20 14:10',
    status: '待收货',
    boxes: [
      {
        boxCode: 'BOX-AW-2001',
        sku: 'JN24AW015-RD-M',
        docQty: 10,
        scanned: false
      },
      {
        boxCode: 'BOX-AW-2002',
        sku: 'JN24AW030-BR-L',
        docQty: 4,
        scanned: false
      }
    ]
  }
]

/** 差异单（PRD 5.1.2）：实点 ≠ 送货单时生成，挂账待供应商确认 */
const receiveDiffs = []

// ============================ 快捷扫码入库（单件入） ============================

/**
 * 到货可入库的 SKU 池：模拟「货已随送货单到店，扫码即得应收数量」。
 * 与 PRODUCTS 主数据保持一致，docQty = 该 SKU 今日送货单应收数量。
 */
const SCAN_INBOUND_SKUS = [
  'JN24AW001-BK-M',
  'JN24AW008-WH-M',
  'JN24AW022-GY-M',
  'JN24AW030-BR-M',
  'JN24AW015-BK-L',
  'JN24AW001-CM-M',
  'JN24AW030-BR-L',
  'JN24AW008-NV-M'
]

const SCAN_POOL = SCAN_INBOUND_SKUS.map((sku, i) => ({
  sku,
  docQty: [5, 8, 6, 4, 3, 2, 6, 5][i]
}))

/** 今日已入库记录，来源为快捷扫码 */
const scanInboundLogs = []

/**
 * 模拟扫码：从到货 SKU 池随机命中一条，返回商品 + 送货单应收数量。
 * 真实设备由扫码枪输入条码、后端按条码解析商品并带出应收数（PRD 5.1.1）。
 */
export async function scanInbound() {
  await delay(500)
  const pick = SCAN_POOL[Math.floor(Math.random() * SCAN_POOL.length)]
  const p = findProductBySku(pick.sku)
  return { ...p, docQty: pick.docQty, scannedAt: nowStr() }
}

/**
 * 未匹配条码待处理清单（PRD 3.7 状态机）。
 * 扫码入库与扫码盘点共用同一份（模块单例），条目结构：
 *   { code, count, status, at }
 * status 流转：
 *   待核实 →（店长四选一）已纠正 / 待补录 / 已关闭 / 已作废
 *   待补录 →（总部补录）已补录 →（店长确认回补）已追认
 * 已纠正 / 已关闭 / 已作废 / 已追认为终态。
 */
const PENDING_KEY = 'wms_pending_list_v1'
const SEQ_KEY = 'wms_unknown_seq_v1'

/**
 * 持久化到 localStorage：刷新、新开标签都不丢，两页共享同一份清单
 * （Demo 改动清单：持久化进 mock，不再随页面刷新丢失）。
 */
function loadPendingStore() {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistPending() {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pendingList))
  } catch {
    /* 存储不可用时退化为内存态 */
  }
}

const pendingList = loadPendingStore()
export const PENDING_TERMINAL = ['已纠正', '已关闭', '已作废', '已追认']

/** 读清单（返回副本，页面直接渲染） */
export function listPending() {
  return pendingList.map((p) => ({ ...p }))
}

/** 挂入清单：按码去重，同码累加次数（PRD 3.7 规则 2：件数不丢失） */
export function addPending(code) {
  const hit = pendingList.find((p) => p.code === code && p.status === '待核实')
  if (hit) {
    hit.count += 1
    persistPending()
    return { item: { ...hit }, dup: true }
  }
  const item = { code, count: 1, status: '待核实', at: nowStr() }
  pendingList.unshift(item)
  persistPending()
  return { item: { ...item }, dup: false }
}

/**
 * 处置状态流转（PRD 3.7），返回流转后条目。
 * v0.4.8 分件处置：同码累加 N 件可只处置其中 qty 件——
 * 处置 qty 件拆出独立已处置条目留痕，原条目剩余件数继续待核实（件数不丢失）；
 * qty ≥ 条目件数时整条处置（原行为）。
 */
export function resolvePending(code, status, qty = Infinity) {
  const hit = pendingList.find(
    (p) => p.code === code && !PENDING_TERMINAL.includes(p.status)
  )
  if (!hit) return null
  const n = Math.min(Number(qty) || Infinity, hit.count)
  if (n < hit.count) {
    hit.count -= n
    const item = { code, count: n, status, at: nowStr() }
    pendingList.unshift(item)
    persistPending()
    return { ...item, remaining: hit.count }
  }
  hit.status = status
  persistPending()
  return { ...hit }
}

/** 待处理条目数（未到终态才算待处理） */
export function countOpenPending(list = pendingList) {
  return list.filter((p) => !PENDING_TERMINAL.includes(p.status)).length
}

/** 未登记条码序号（持久化，跨刷新/跨标签不重置，保证演示序列连续） */
let unknownScanSeq = (() => {
  try {
    return Number(localStorage.getItem(SEQ_KEY)) || 0
  } catch {
    return 0
  }
})()

/**
 * 模拟扫到未登记条码：吊牌挂错款、非本店商品（访谈：供应商把 A 款吊牌挂到 B 款）。
 * 真实系统由扫码枪回传条码、后端查商品主数据无匹配即返回 null（见 scanBarcode）；
 * 此处直接产出一条主数据中不存在的条码，由页面挂入待处理清单，不静默丢弃。
 */
export async function scanUnknownInbound() {
  await delay(420)
  unknownScanSeq += 1
  try {
    localStorage.setItem(SEQ_KEY, String(unknownScanSeq))
  } catch {
    /* 存储不可用时退化为内存态 */
  }
  // 与 BARCODE_MAP 同段位 6901001001xxx，但未登记在商品主数据中。
  // 序列两两重复（901,901,902,902…）：模拟"同一条未登记码被连扫两件"，
  // 便于演示按码去重、同码累加 ×N 的规则，全程确定性可复现、不用概率。
  const idx = Math.ceil(unknownScanSeq / 2)
  return { code: `69010010019${String(idx).padStart(2, '0')}` }
}

/**
 * 快捷扫码确认入库：按实收数量记入库，同时累加库存账可售数。
 * v0.4.7：实收 ≠ 送货单应收时生成 CY 差异单（与收货单核点链路同口径），
 * 不再只弹提示不入账——差异不游离在账外，首页「待确认差异」同步 +1。
 */
export async function confirmScanInbound({ sku, qty }) {
  await delay(360)
  const p = findProductBySku(sku)
  if (!p) throw new Error('商品不存在')
  const num = Number(qty) || 0
  if (num <= 0) throw new Error('入库数量需大于 0')

  invRow(sku).sellable += num
  invSyncedAt = hhmm()

  const log = {
    id: `RK${makeNo('RK').slice(2)}`,
    sku: p.sku,
    code: p.code,
    name: p.name,
    color: p.color,
    size: p.size,
    qty: num,
    at: hhmm(),
    time: nowStr()
  }
  scanInboundLogs.unshift(log)

  // 快捷链路差异单：应收来自 SCAN_POOL 的送货单应收数（demo 简化：散件也带应收对比）
  const pool = SCAN_POOL.find((x) => x.sku === sku)
  if (pool && pool.docQty !== num) {
    const diff = {
      diffNo: makeNo('CY'),
      receiptNo: '-',
      supplier: '快捷扫码直入',
      source: '快捷扫码',
      status: '待确认',
      createdAt: nowStr(),
      lines: [
        {
          sku: p.sku,
          code: p.code,
          name: p.name,
          docQty: pool.docQty,
          actualQty: num,
          diffQty: num - pool.docQty
        }
      ]
    }
    receiveDiffs.unshift(diff)
    log.diffNo = diff.diffNo
  }
  return log
}

/** 今日入库列表 */
export async function fetchScanInboundLogs() {
  await delay(160)
  return scanInboundLogs
}

// ============================ 盘点（扫码盘点） ============================

/**
 * 盘点任务。PRD 5.2.1：逐件扫码累加 → 结束触发自动对账（5.2.2）。
 * 初始已盘一部分，方便演示「继续盘点」和「对账结果」两个状态。
 *
 * v0.3.0 冻结快照（PRD 5.16 / 方案 F）：盘点开始时冻结账本副本作为对账基准，
 * 盘点窗口内的入库/销售等账本变动不影响本次对账——顺序无关、账实可比。
 */
function freezeStocktakeSnapshot() {
  const snap = {}
  for (const r of inventory) snap[r.sku] = r.sellable
  return snap
}

/**
 * 货架实况（v0.4.4 新增）：货架上实际摆着的件数 = 冻结账本快照 + 预置偏差。
 *
 * 三层模型（盘点语义的根基）：
 *   账本（记录）≠ 货架实况（物理世界，mock 里有意差几件）≠ 扫码计数（店员逐件扫出来的）
 * 扫码扫的是货架，不是账本；差异 = 货架实况 vs 账本，系统不偷看账本补数。
 *
 * 以「偏差 delta」建模而非绝对数：重新开单后快照重冻，货架实况自动跟随新账本，
 * 演示任何时点开单都自洽。偏差剧情：大衣黑S 昨售 1 件漏记（盘亏）；
 * 衬衫米白M 到货 1 件漏登（盘盈）；开衫浅灰S 样衣借出未记账（盘亏）。
 */
const SHELF_DELTA = {
  'JN24AW001-BK-S': -1,
  'JN24AW008-WH-M': 1,
  'JN24AW022-GY-S': -1
}

/** 某 SKU 的货架实况件数（盲盘语义下页面不得展示该数，仅供扫码逻辑判断"货架还有没有货"） */
export function shelfQtyOf(sku) {
  const book = stocktakeTask.snapshot[sku] ?? 0
  return Math.max(0, book + (SHELF_DELTA[sku] || 0))
}

const stocktakeTask = {
  taskNo: 'PD20261019001',
  scope: '全店',
  startedAt: '2026-10-19 14:05',
  status: '盘点中', // 盘点中 / 已完成
  // 冻结快照：盘点开始瞬间的可售账副本（对账基准，此后不再变动）
  snapshot: freezeStocktakeSnapshot(),
  // 已扫到的 SKU 及实盘数。
  // v0.4.4 修正：预置数 = 对应 SKU 的货架实况（前 7 个 SKU 演示"已扫完的货架段"），
  // 此前预置数远大于账面（如衬衫 11/账面 9），连扫跑全店盘必出 -85 级假巨亏，误导培训。
  scanned: {
    'JN24AW001-BK-S': 5,
    'JN24AW001-BK-M': 11,
    'JN24AW008-WH-S': 14,
    'JN24AW008-WH-M': 10,
    'JN24AW015-RD-M': 18,
    'JN24AW015-BK-L': 7,
    'JN24AW022-GY-M': 12
  }
  // 未匹配条码不再存本任务：统一挂入共享 pendingList（PRD 3.7 跨页共享）
}

/**
 * 重新开单（v0.3.0 新增）：清空实盘数、状态回到「盘点中」，
 * 并按当前账本重新冻结快照——新一轮盘点以新基准对账（PRD 5.16）。
 */
export function resetStocktake() {
  stocktakeTask.status = '盘点中'
  stocktakeTask.scanned = {}
  stocktakeTask.snapshot = freezeStocktakeSnapshot()
  stocktakeTask.startedAt = nowStr()
  lastReconcile = null
  return { taskNo: stocktakeTask.taskNo, startedAt: stocktakeTask.startedAt }
}

/**
 * 驳回重盘（v0.4.6 新增）：对账结果作废，任务回到「盘点中」继续扫。
 * 已盘记录与冻结快照保留——驳回是"同一轮回去补扫/重扫"，不是新一轮（不重冻快照）。
 * 此前驳回只跳页面不改状态，回到盘点页连扫/结束按钮全灰（状态卡在「已完成」），
 * 用户只能绕道「重新开单」清空已盘——与"驳回重盘"文案语义相悖。
 */
export function resumeStocktake() {
  lastReconcile = null
  stocktakeTask.status = '盘点中'
  return { taskNo: stocktakeTask.taskNo, scannedCount: Object.keys(stocktakeTask.scanned).length }
}

/** 最近一次对账结果，供「差异对账」页展示 */
let lastReconcile = null

// ============================ 调拨单（调拨进度） ============================

/**
 * 调拨单状态机对齐 PRD 3.5：
 * 已发起 → 已发货 → 在途 → 已签收 → 已入库
 *                                    ↘ 差异挂账 → 已入库
 */
const transfers = [
  {
    transferNo: 'DB20261015001',
    fromStore: '简岸·旗舰店',
    toStore: '简岸·万象城店',
    direction: 'out', // out=我发出的 / in=我接收的
    status: '在途',
    expressNo: 'SF1234567890123',
    createdAt: '2026-10-15 10:20',
    items: [
      { sku: 'JN24AW001-BK-M', qty: 4 },
      { sku: 'JN24AW008-WH-M', qty: 6 }
    ],
    receivedQty: null,
    timeline: [
      { status: '已发起', at: '2026-10-15 10:20', note: '总部发起调拨单' },
      { status: '已发货', at: '2026-10-15 16:40', note: '调出店扫码发货，顺丰 SF1234567890123' },
      { status: '在途', at: '2026-10-15 18:05', note: '快递承运中' }
    ]
  },
  {
    transferNo: 'DB20261017002',
    fromStore: '简岸·银泰中心店',
    toStore: '简岸·旗舰店',
    direction: 'in',
    status: '已签收',
    expressNo: 'JD9876543210456',
    createdAt: '2026-10-17 11:30',
    items: [
      { sku: 'JN24AW015-BK-L', qty: 2 },
      { sku: 'JN24AW030-BR-M', qty: 3 }
    ],
    receivedQty: null,
    timeline: [
      { status: '已发起', at: '2026-10-17 11:30', note: '总部发起调拨单' },
      { status: '已发货', at: '2026-10-17 15:10', note: '调出店扫码发货，京东 JD9876543210456' },
      { status: '在途', at: '2026-10-17 19:00', note: '快递承运中' },
      { status: '已签收', at: '2026-10-19 09:45', note: '调入店已扫码签收，待开箱点货' }
    ]
  },
  {
    transferNo: 'DB20261012003',
    fromStore: '简岸·旗舰店',
    toStore: '简岸·滨江店',
    direction: 'out',
    status: '已入库',
    expressNo: 'SF1234500099877',
    createdAt: '2026-10-12 09:10',
    items: [{ sku: 'JN24AW022-GY-S', qty: 3 }],
    receivedQty: null,
    timeline: [
      { status: '已发起', at: '2026-10-12 09:10', note: '总部发起调拨单' },
      { status: '已发货', at: '2026-10-12 14:00', note: '调出店扫码发货，顺丰 SF1234500099877' },
      { status: '在途', at: '2026-10-12 17:30', note: '快递承运中' },
      { status: '已签收', at: '2026-10-13 10:15', note: '调入店已扫码签收' },
      { status: '已入库', at: '2026-10-13 10:40', note: '开箱点货一致，调拨完成' }
    ]
  }
]

// ============================ 对外接口 ============================

/**
 * 首页看板：待办 + 今日数据。
 * 数字与各模块 mock 数据保持一致，避免演示时自相矛盾。
 */
export async function fetchHomeOverview() {
  await delay(200)
  const todoReceipt = receipts.filter((r) => r.status === '待收货').length
  const todoTransfer = transfers.filter((t) => t.direction === 'in' && t.status === '在途').length
  const pendingStocktake = stocktakeTask.status === '盘点中'
  return {
    store: CURRENT_STORE,
    syncedAt: hhmm(),
    todos: {
      receipt: todoReceipt,
      transfer: todoTransfer,
      stocktake: pendingStocktake ? 1 : 0,
      diff: receiveDiffs.filter((d) => d.status === '待确认').length,
      // v0.4.2 聚合（PRD v2.3 2.6 首页工作台规则）：退货两类待办 + 今日退货件数
      review: countOpenReview(),
      defective: defectives.filter((d) => d.status === '待处理').reduce((s, d) => s + d.qty, 0)
    },
    today: {
      // 今日入库动态累计（v0.3.0）：基数 13 + 快捷扫码入库累计件数，不再写死
      inbound: 13 + scanInboundLogs.reduce((s, l) => s + l.qty, 0),
      outbound: 8,
      returns: returnLogs.reduce((s, l) => s + l.qty, 0),
      stocktakeProgress: Object.keys(stocktakeTask.scanned).length,
      stocktakeTotal: PRODUCTS.length
    },
    warnings: [
      { level: 'warning', text: 'DB20261015001 已在途 4 天，请跟进调入店签收' },
      { level: 'info', text: '本月盘点差异率 2.8%，低于目标 3%' }
    ]
  }
}

/**
 * 扫码识别：条码 → 商品主数据。
 * PRD 5.1.1 验收：扫描有效箱外条码 3 秒内展示清单。
 * 未知条码返回 null，由页面提示「未匹配商品主数据」。
 */
export async function scanBarcode(code) {
  await delay(200)
  const product = findProductByBarcode(code)
  if (!product) return null
  return product
}

/** 待收货单列表 */
export async function fetchReceipts() {
  await delay(220)
  return receipts.map((r) => ({
    ...r,
    totalDocQty: r.boxes.reduce((s, b) => s + b.docQty, 0),
    scannedBoxes: r.boxes.filter((b) => b.scanned).length,
    boxCount: r.boxes.length
  }))
}

/** 收货单详情 */
export async function fetchReceiptDetail(receiptNo) {
  await delay(200)
  const r = receipts.find((x) => x.receiptNo === receiptNo)
  if (!r) throw new Error('收货单不存在')
  return {
    ...r,
    lines: r.boxes.map((b) => {
      const p = findProductBySku(b.sku) || {}
      return {
        ...b,
        ...p,
        // 实点数量：已扫码箱默认与送货单一致，演示时可手动改造成差异
        actualQty: b.actualQty ?? b.docQty
      }
    })
  }
}

/**
 * 确认入库（PRD 5.1.1）。
 * 若某行实点 ≠ 送货单，则生成差异记录（PRD 5.1.2），差异行按实点入库、差异部分挂账。
 * 返回 { receiptNo, diff, addedQty }
 */
export async function confirmReceipt(receiptNo, lines) {
  await delay(420)
  const r = receipts.find((x) => x.receiptNo === receiptNo)
  if (!r) throw new Error('收货单不存在')
  // 单据状态机防重（PRD 3.6；非 8.1.2 幂等表，见 CLAUDE.md 偏差声明）：
  // 已入库 / 有差异 均为终态，重复提交直接拦截，避免二次记账破坏守恒。
  if (r.status !== '待收货') {
    throw new Error(`该收货单已入库（${r.status}），请勿重复操作`)
  }

  let addedQty = 0
  const diffLines = []

  for (const line of lines) {
    const box = r.boxes.find((b) => b.boxCode === line.boxCode)
    if (!box) continue
    const actual = Number(line.actualQty) || 0
    box.actualQty = actual
    box.scanned = true
    // 按实点入库（PRD 5.1.2：供应商确认前，该批货按实点入库，差异部分挂账）
    invRow(line.sku).sellable += actual
    addedQty += actual
    if (actual !== box.docQty) {
      diffLines.push({
        sku: line.sku,
        code: line.code,
        name: line.name,
        docQty: box.docQty,
        actualQty: actual,
        diffQty: actual - box.docQty
      })
    }
  }

  invSyncedAt = hhmm()
  r.status = diffLines.length ? '有差异' : '已入库'

  let diff = null
  if (diffLines.length) {
    diff = {
      diffNo: makeNo('CY'),
      receiptNo,
      supplier: r.supplier,
      source: '收货单核点',
      status: '待确认', // 待确认 / 已确认
      createdAt: nowStr(),
      lines: diffLines
    }
    receiveDiffs.unshift(diff)
  }

  return { receiptNo, diff, addedQty }
}

/** 差异单列表 */
export async function fetchReceiveDiffs() {
  await delay(180)
  return receiveDiffs
}

/**
 * 店长确认差异单（v0.4.7 新增，PRD 5.1.2 待确认→已确认）。
 * 确认语义：已与供应商核实该笔差异，入库按实点不变、差额维持挂账追偿；
 * 仅状态流转，不改库存账（入库时已按实点记账）。
 */
export async function confirmReceiveDiff(diffNo) {
  await delay(300)
  const d = receiveDiffs.find((x) => x.diffNo === diffNo)
  if (!d) throw new Error('差异单不存在')
  if (d.status !== '待确认') throw new Error(`该差异单已处理（${d.status}），请勿重复操作`)
  d.status = '已确认'
  d.confirmedAt = nowStr()
  return { ...d }
}

/**
 * 实时库存查询（PRD 5.3.1 + 8.1.1 四科目）。
 * keyword 支持货号 / SKU / 商品名模糊匹配；status 为 sellable|inTransit|defective|holding|all。
 */
export async function fetchInventory({ keyword = '', status = 'all' } = {}) {
  await delay(240)
  const kw = keyword.trim().toUpperCase()
  let rows = inventory.map(joinProduct)

  if (kw) {
    rows = rows.filter(
      (r) =>
        r.sku.toUpperCase().includes(kw) ||
        r.code.toUpperCase().includes(kw) ||
        r.name.includes(keyword.trim()) ||
        r.color.includes(keyword.trim())
    )
  }

  if (status === 'inTransit') rows = rows.filter((r) => r.inTransit > 0)
  if (status === 'defective') rows = rows.filter((r) => r.defective > 0)
  if (status === 'holding') rows = rows.filter((r) => r.holding > 0)

  rows.sort((a, b) => b.sellable - a.sellable)

  return {
    list: rows,
    syncedAt: invSyncedAt,
    summary: {
      sellable: rows.reduce((s, r) => s + r.sellable, 0),
      inTransit: rows.reduce((s, r) => s + r.inTransit, 0),
      defective: rows.reduce((s, r) => s + r.defective, 0),
      holding: rows.reduce((s, r) => s + r.holding, 0)
    }
  }
}

/** 当前盘点任务 */
export async function fetchStocktakeTask() {
  await delay(200)
  return {
    ...stocktakeTask,
    scannedCount: Object.keys(stocktakeTask.scanned).length,
    totalSku: PRODUCTS.length,
    lines: Object.entries(stocktakeTask.scanned)
      .map(([sku, qty]) => {
        const p = findProductBySku(sku) || {}
        return { sku, qty, ...p }
      })
      .sort((a, b) => (a.sku > b.sku ? 1 : -1))
  }
}

/**
 * 盘点扫码：同一 SKU 连续扫码自动累加计数（PRD 5.2.1 边界）。
 * 未知条码不静默丢弃，返回 matched:false 并挂入共享待处理清单（PRD 3.7）。
 *
 * v0.4.4 货架实况约束：货架上有几件就扫得出几件（shelfQtyOf）。
 * 扫码计数达到货架实况后再扫同一 SKU，返回 shelfDone:true——
 * 模拟"这件货的枪口已经过完了"，防止凭空多计（此前无限点击可扫出远超实况的数）。
 */
export async function scanForStocktake(code, currentScanned) {
  await delay(180)
  const product = findProductByBarcode(code)
  if (!product) {
    // 挂入与扫码入库共享的待处理清单（PRD 3.7 跨页共享）
    const r = addPending(code)
    return { matched: false, code, pending: r.item, dup: r.dup }
  }
  const shelf = shelfQtyOf(product.sku)
  const count = (currentScanned[product.sku] || 0) + 1
  if (count > shelf) {
    return { matched: true, product, shelf, shelfDone: true }
  }
  return { matched: true, product, count, shelf }
}

/** 结束盘点 → 自动对账（PRD 5.2.2 + 5.16 冻结快照基准） */
export async function finishStocktake(scanned) {
  await delay(600)
  stocktakeTask.scanned = { ...scanned }
  stocktakeTask.status = '已完成'

  // v0.3.1 修复：只对「已盘 SKU」出差异——未盘 ≠ 盘亏，
  // 未盘 SKU 不进入对账行，只在结果里以 uncheckedSku 报数（此前未盘被按实盘 0 误算成巨盘亏）。
  const checkedSkuCount = Object.keys(scanned).length
  const lines = PRODUCTS.filter((p) => scanned[p.sku] !== undefined).map((p) => {
    // 账面数取盘点开始时的冻结快照（PRD 5.16 / v0.3.0 修复）：
    // 不再用实时 sellable——盘点窗口内的入库不该污染本次差异。
    const bookQty = stocktakeTask.snapshot[p.sku] ?? 0
    const actualQty = scanned[p.sku] || 0
    const diffQty = actualQty - bookQty
    return {
      sku: p.sku,
      code: p.code,
      name: p.name,
      color: p.color,
      size: p.size,
      bookQty,
      actualQty,
      diffQty,
      // 归因（PRD 5.2.2 规则库 R1~R5）
      attribution: diffQty === 0 ? null : attribute(p.sku, diffQty)
    }
  })

  const diffLines = lines.filter((l) => l.diffQty !== 0)
  lastReconcile = {
    taskNo: stocktakeTask.taskNo,
    finishedAt: nowStr(),
    totalSku: PRODUCTS.length,
    checkedSku: checkedSkuCount,
    uncheckedSku: PRODUCTS.length - checkedSkuCount,
    diffCount: diffLines.length,
    lossQty: diffLines.filter((l) => l.diffQty < 0).reduce((s, l) => s + l.diffQty, 0),
    gainQty: diffLines.filter((l) => l.diffQty > 0).reduce((s, l) => s + l.diffQty, 0),
    lines: diffLines,
    allLines: lines
  }
  return lastReconcile
}

/**
 * 确认差异 → 生成调整单并落账（PRD 5.2.2；v0.3.1 修复：此前确认后库存不更新）。
 * 账面向实盘对齐：盘亏减可售、盘盈加可售（差额基于冻结快照基准）。
 * 注意：盘点调整是「账实校准事件」，合计随 Δ 变化，不属于守恒内部转移。
 *
 * v0.4.5 修复（用户验收发现）：已落账 SKU 的货架偏差清零。
 * 此前 SHELF_DELTA 是固定预埋——落账把账本对齐实况后，下一轮盘点又冒出同样的 -1，
 * 等于每轮都凭空亏同一件，不合物理逻辑。正确语义：账实校准后，这些 SKU 的账实差异源消失；
 * 未盘 SKU 的偏差保留（货架确实还差着，下轮盘它仍会暴露）。重置演示数据可恢复初始剧情。
 */
export async function applyStocktakeAdjust() {
  await delay(500)
  if (!lastReconcile) throw new Error('暂无对账结果，请先完成盘点')
  const adjustNo = makeNo('TZ')
  let applied = 0
  for (const l of lastReconcile.lines) {
    if (!l.diffQty) continue
    invRow(l.sku).sellable += l.diffQty
    delete SHELF_DELTA[l.sku] // 账本已按实况校准，该 SKU 的预埋偏差剧情结束
    applied += 1
  }
  invSyncedAt = hhmm()
  return { adjustNo, applied }
}

/**
 * 差异归因。演示规则库 R1~R5 的判定输出：
 * 结论 + 证据链（关联单据号）+ 置信度，PRD 5.2.2 核心逻辑。
 */
function attribute(sku, diffQty) {
  if (diffQty < 0) {
    return {
      rule: 'R1',
      conclusion: '有销售流水无库存扣减',
      evidence: [`POS2026101800912（销售 2 件，库存未扣减）`],
      confidence: 0.84
    }
  }
  return {
    rule: 'R2',
    conclusion: '退货入库 SKU ≠ 原销售单 SKU',
    evidence: [`TH2026101700345（原单 ${sku} 退货，入错至同款异码）`],
    confidence: 0.71
  }
}

/** 最近一次对账结果 */
export async function fetchLastReconcile() {
  await delay(160)
  return lastReconcile
}

/** 调拨单列表，direction: all|out|in */
export async function fetchTransfers({ direction = 'all', status = 'all' } = {}) {
  await delay(240)
  let list = transfers.map((t) => ({
    ...t,
    totalQty: t.items.reduce((s, i) => s + i.qty, 0),
    lines: t.items.map((i) => {
      const p = findProductBySku(i.sku) || {}
      return { ...i, ...p }
    })
  }))
  if (direction !== 'all') list = list.filter((t) => t.direction === direction)
  if (status !== 'all') list = list.filter((t) => t.status === status)
  return list
}

/** 调拨单详情 */
export async function fetchTransferDetail(transferNo) {
  await delay(200)
  const t = transfers.find((x) => x.transferNo === transferNo)
  if (!t) throw new Error('调拨单不存在')
  return {
    ...t,
    totalQty: t.items.reduce((s, i) => s + i.qty, 0),
    lines: t.items.map((i) => {
      const p = findProductBySku(i.sku) || {}
      return { ...i, ...p }
    })
  }
}

/**
 * 调拨收货（PRD 5.4.2 + v2.2 签收即入库）。
 * v0.3.0 守恒重写：
 * - 防重：非「已签收」状态一律拦截，已入库单不可重复点货（PRD 3.6 状态机）
 * - 记账与状态解耦：无论有无差异，按实到件数立即入可售账（5.4.2 差异不阻塞入库）
 * - 在途池清账：inTransit -= 调拨单应到数（原 v0.2.0 缺陷：在途池只进不出）
 * - 差额入账：实到 < 应到 → 差额进「待清理挂账量」科目（8.1.1），不再自创「差异挂账」库存状态
 * 守恒验证：Σ(sellable+inTransit+defective+holding) 前后不变——
 *   一致：sellable +qty，inTransit -qty，合计不变；
 *   有差：sellable +receivedQty，inTransit -qty，holding +(qty-receivedQty)，合计不变。
 */
export async function receiveTransfer(transferNo, receivedLines) {
  await delay(480)
  const t = transfers.find((x) => x.transferNo === transferNo)
  if (!t) throw new Error('调拨单不存在')
  if (t.direction !== 'in') throw new Error('该调拨单为本店调出，无需点货入库')
  // 单据状态机防重（PRD 3.6）：只有「已签收」可执行点货入库
  if (t.status !== '已签收') {
    throw new Error(`该调拨单当前状态为「${t.status}」，请勿重复操作`)
  }

  const holdLines = []
  for (const l of receivedLines) {
    const received = Number(l.receivedQty) || 0
    const row = invRow(l.sku)
    // 签收即入库：按实到件数入可售账（PRD v2.2 5.4.2）
    row.sellable += received
    // 在途池清账：按调拨单应到数扣减（原单 qty）
    row.inTransit -= l.qty
    if (row.inTransit < 0) row.inTransit = 0
    // 差额挂账：实到 < 应到 → 差额进「待清理挂账量」（PRD 8.1.1 第四科目）
    if (received < l.qty) {
      const holdQty = l.qty - received
      row.holding += holdQty
      holdLines.push({ sku: l.sku, qty: l.qty, receivedQty: received, holdQty })
    }
  }
  t.receivedQty = receivedLines
  invSyncedAt = hhmm()

  const hasDiff = holdLines.length > 0
  let diffNo = null
  if (hasDiff) {
    // 差异单照常生成（PRD 5.4.2 边界：实到≠调拨单须生成差异单），但不再阻塞入库
    diffNo = makeNo('DB')
    t.diffNo = diffNo
    t.timeline.push({
      status: '差异挂账',
      at: nowStr(),
      note: `实到与调拨单不一致，差异单 ${diffNo} 已生成，差额 ${holdLines.reduce((s, l) => s + l.holdQty, 0)} 件挂账待两端确认`
    })
  }
  // 终态：已入库（差异不改变单据终态，货权待决走差异单，PRD v2.2 3.6）
  t.status = '已入库'
  t.timeline.push({
    status: '已入库',
    at: nowStr(),
    note: hasDiff ? '按实到件数入库，差额挂账，调拨完成' : '实到与调拨单一致，调拨完成'
  })
  return { status: t.status, diffNo, holdDiff: holdLines }
}

// ============================ 退换货（扫码验退 + 次品登记） ============================

/**
 * 销售单（模拟 POS 对接，PRD 5.6.1 前置条件「POS 销售数据已对接」）。
 * 退货扫码凭吊牌条码反查原销售单：SKU / 原单号 / 购买时间 / 批次。
 * 历史销售不参与当前库存账（库存初始快照已扣除），只作反查依据。
 */
const SALES = [
  { saleNo: 'XS202610150012', sku: 'JN24AW030-BR-M', qty: 1, soldAt: '2026-10-15 15:32', batch: 'AW24-B' },
  { saleNo: 'XS202610160021', sku: 'JN24AW008-WH-S', qty: 1, soldAt: '2026-10-16 11:08', batch: 'AW24-A' },
  { saleNo: 'XS202610190058', sku: 'JN24AW022-GY-M', qty: 1, soldAt: '2026-10-19 13:15', batch: 'AW24-A' },
  { saleNo: 'XS202610200066', sku: 'JN24AW015-RD-M', qty: 1, soldAt: '2026-10-20 17:22', batch: 'AW24-B' }
]

/**
 * 退货扫码计划（确定性轮询，与未登记条码同思路：不用概率、演示可复现）。
 * 3 条有原单 + 1 条查无原单（大衣 M：主数据有、POS 查无销售单 → 走人工录入）。
 */
const RET_SCAN_PLAN = [
  { barcode: '6901001001051', saleNo: 'XS202610150012' },
  { barcode: '6901001001021', saleNo: 'XS202610160021' },
  { barcode: '6901001001012', saleNo: null },
  { barcode: '6901001001042', saleNo: 'XS202610190058' }
]

const RET_SEQ_KEY = 'wms_ret_seq_v1'
let retScanSeq = (() => {
  try {
    return Number(localStorage.getItem(RET_SEQ_KEY)) || 0
  } catch {
    return 0
  }
})()

/**
 * 退货模拟扫码：确定性轮询 RET_SCAN_PLAN。
 * 返回 { code, product, sale }；sale 为 null 表示「条码认识、POS 查无原单」。
 */
export async function scanReturn() {
  await delay(500)
  retScanSeq += 1
  try {
    localStorage.setItem(RET_SEQ_KEY, String(retScanSeq))
  } catch {
    /* 存储不可用时退化为内存态 */
  }
  const plan = RET_SCAN_PLAN[(retScanSeq - 1) % RET_SCAN_PLAN.length]
  const product = findProductByBarcode(plan.barcode)
  const sale = plan.saleNo ? SALES.find((s) => s.saleNo === plan.saleNo) || null : null
  return { code: plan.barcode, product, sale }
}

/** 退货记录（今日），供退换货主页列表展示 */
const returnLogs = []

/**
 * 待复核清单（PRD 5.6.1：查无原单人工录入强制标记；24h 内补原单可解除）。
 * 条目：{ id, sku, qty, reason, status: '待复核'|'已复核', at, resolvedSaleNo, resolvedAt }
 * 持久化到 localStorage，与未匹配条码清单同策略。
 */
const REVIEW_KEY = 'wms_review_list_v1'

function loadReviewStore() {
  try {
    const raw = localStorage.getItem(REVIEW_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistReview() {
  try {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(reviewList))
  } catch {
    /* 存储不可用时退化为内存态 */
  }
}

const reviewList = loadReviewStore()

/** 待复核清单（返回副本） */
export function fetchReviewList() {
  return reviewList.map((r) => ({ ...r }))
}

/** 待复核数量（角标） */
export function countOpenReview() {
  return reviewList.filter((r) => r.status === '待复核').length
}

/**
 * 补录原单 → 解除待复核标记（PRD 5.6.1 异常场景）。
 */
export function resolveReview(id, saleNo) {
  const hit = reviewList.find((r) => r.id === id)
  if (!hit) throw new Error('待复核条目不存在')
  if (hit.status !== '待复核') throw new Error('该条目已复核，请勿重复操作')
  if (!saleNo || !String(saleNo).trim()) throw new Error('请填写原销售单号')
  hit.status = '已复核'
  hit.resolvedSaleNo = String(saleNo).trim()
  hit.resolvedAt = nowStr()
  persistReview()
  return { ...hit }
}

/**
 * 扫码验退确认（PRD 5.6.1 核心逻辑）：
 * - 吊牌完好/包装未拆 → 按原 SKU 入回可售库存（外部流入事件，Σ四科目 +qty）
 * - 吊牌破损/包装拆封 → 强制归次品：次品账 +qty，并自动生成次品登记（5.6.2）
 * - 换货 = 一退一进两笔事件（PRD 5.6.1 边界）：退货入库 + 换货出库（可售扣减）
 * 守恒说明：退货入库/次品归入为外部流入（合计增加）；换货出库为外部流出（合计减少）——
 * 与收货同理，「Σ四科目只随事件变动」而非守恒不变。
 */
export async function confirmReturn({ sku, saleNo = null, tagOk, qty = 1, exchangeSku = null }) {
  await delay(420)
  const p = findProductBySku(sku)
  if (!p) throw new Error('商品不存在')
  const num = Number(qty) || 0
  if (num <= 0) throw new Error('退货数量需大于 0')

  const events = []
  // 先校验换出库存，再统一落账，避免中途抛错导致半截记账
  if (exchangeSku) {
    const ep = findProductBySku(exchangeSku)
    if (!ep) throw new Error('换出商品不存在')
    if (exchangeSku === sku) throw new Error('换货应选不同 SKU；同款同码直接退货即可')
    if (invRow(exchangeSku).sellable < num) {
      throw new Error(`换出商品「${ep.name} ${ep.color}/${ep.size}」可售库存不足`)
    }
  }

  const returnNo = makeNo('TH')
  if (tagOk) {
    invRow(sku).sellable += num
    events.push({ type: '退货入库', sku, qty: num, note: '吊牌完好/包装未拆，按原 SKU 入回可售库存' })
  } else {
    invRow(sku).defective += num
    const cpId = makeNo('CP')
    defectives.unshift({
      id: cpId,
      sku,
      qty: num,
      reason: '退换货-吊牌/包装破损',
      status: '待处理',
      at: nowStr(),
      trail: [{ status: '待处理', at: nowStr(), note: `验退 ${returnNo} 归次品，自动登记` }]
    })
    events.push({ type: '次品登记', sku, qty: num, note: `吊牌/包装破损，归入次品科目（次品登记 ${cpId}）` })
  }
  if (exchangeSku) {
    invRow(exchangeSku).sellable -= num
    const ep = findProductBySku(exchangeSku)
    events.push({ type: '换货出库', sku: exchangeSku, qty: num, note: `一退一进第二笔：换出 ${ep.name} ${ep.color}/${ep.size} 交予顾客` })
  }
  invSyncedAt = hhmm()

  returnLogs.unshift({
    id: returnNo,
    saleNo,
    sku,
    code: p.code,
    name: p.name,
    color: p.color,
    size: p.size,
    qty: num,
    tagOk,
    exchangeSku,
    events,
    at: hhmm(),
    time: nowStr()
  })
  return { returnNo, events }
}

/**
 * 查无原单 → 人工录入（PRD 5.6.1 异常场景）。
 * 强制勾选「标记待复核」才能提交（数据层强校验，AC 校验场景）；入回可售库存同时挂入待复核清单。
 */
export async function confirmManualReturn({ sku, qty, reason = '', reviewFlag = false }) {
  await delay(420)
  if (!reviewFlag) throw new Error('人工录入必须勾选「标记待复核」后才能提交（PRD 5.6.1）')
  const p = findProductBySku(sku)
  if (!p) throw new Error('商品不存在')
  const num = Number(qty) || 0
  if (num <= 0) throw new Error('退货数量需大于 0')

  const reviewId = makeNo('RV')
  reviewList.unshift({
    id: reviewId,
    sku,
    qty: num,
    reason: reason || '人工录入，POS 查无原单',
    status: '待复核',
    at: nowStr(),
    resolvedSaleNo: null,
    resolvedAt: null
  })
  persistReview()

  invRow(sku).sellable += num
  invSyncedAt = hhmm()

  const returnNo = makeNo('TH')
  returnLogs.unshift({
    id: returnNo,
    saleNo: null,
    sku,
    code: p.code,
    name: p.name,
    color: p.color,
    size: p.size,
    qty: num,
    tagOk: true,
    exchangeSku: null,
    events: [{ type: '退货入库', sku, qty: num, note: '人工录入入回可售库存，已强制标记待复核' }],
    at: hhmm(),
    time: nowStr(),
    manual: true,
    reviewId
  })
  return { returnNo, reviewId }
}

/** 今日退货记录列表 */
export async function fetchReturnLogs() {
  await delay(180)
  return returnLogs.map((r) => ({ ...r }))
}

// ============================ 次品登记（PRD 5.6.2） ============================

/**
 * 次品清单。预置一条与初始库存账 JN24AW008-WH-S defective=2 相扣（其中 1 件为本条）。
 * 登记入口两条路：① 退换货验退自动登记（不扣可售，外部流入）② 本店发现手工登记
 * （可售 → 次品，守恒内部转移）。促销处理 = 次品账扣减（外部流出）。
 */
const defectives = [
  {
    id: 'CP202610180001',
    sku: 'JN24AW008-WH-S',
    qty: 1,
    reason: '展示污渍（顾客退回）',
    status: '待处理',
    at: '2026-10-18 16:40',
    trail: [{ status: '待处理', at: '2026-10-18 16:40', note: '验退归次品，自动登记' }]
  }
]

/** 次品列表，status: all|待处理|已促销处理 */
export async function fetchDefectives({ status = 'all' } = {}) {
  await delay(200)
  let list = defectives.map((d) => {
    const p = findProductBySku(d.sku) || {}
    return { ...d, ...p }
  })
  if (status !== 'all') list = list.filter((d) => d.status === status)
  return {
    list,
    summary: {
      open: defectives.filter((d) => d.status === '待处理').reduce((s, d) => s + d.qty, 0),
      done: defectives.filter((d) => d.status === '已促销处理').reduce((s, d) => s + d.qty, 0)
    }
  }
}

/**
 * 手工登记次品（门店内发现，如陈列磨损）：可售 → 次品，守恒内部转移。
 * 次品原因必填（PRD 5.6.2 校验场景）。
 */
export async function registerDefective({ sku, qty, reason }) {
  await delay(360)
  const p = findProductBySku(sku)
  if (!p) throw new Error('商品不存在')
  const num = Number(qty) || 0
  if (num <= 0) throw new Error('登记数量需大于 0')
  if (!reason || !String(reason).trim()) throw new Error('次品原因必填')
  const row = invRow(sku)
  if (row.sellable < num) throw new Error(`可售库存仅剩 ${row.sellable} 件，不足以划扣 ${num} 件`)

  const id = makeNo('CP')
  row.sellable -= num
  row.defective += num
  invSyncedAt = hhmm()
  const item = {
    id,
    sku,
    qty: num,
    reason: String(reason).trim(),
    status: '待处理',
    at: nowStr(),
    trail: [{ status: '待处理', at: nowStr(), note: `手工登记：可售 ${num} 件划入次品账` }]
  }
  defectives.unshift(item)
  return { id, ...item }
}

/**
 * 促销处理（对接总部季度促销）：状态留痕变更，次品账同步扣减（外部流出）。
 * 联动失败自动告警在本 mock 不适用（内存操作不会失败），保留待处理态逻辑见 PRD。
 */
export async function promoteDefective(id) {
  await delay(360)
  const hit = defectives.find((d) => d.id === id)
  if (!hit) throw new Error('次品登记不存在')
  if (hit.status !== '待处理') throw new Error('该条目已促销处理，请勿重复操作')
  const row = invRow(hit.sku)
  if (row.defective < hit.qty) throw new Error('次品账数量异常，请先盘点校准')

  hit.status = '已促销处理'
  row.defective -= hit.qty
  invSyncedAt = hhmm()
  hit.trail.push({ status: '已促销处理', at: nowStr(), note: `总部季度促销低价处理，次品账扣减 ${hit.qty} 件` })
  return { ...hit }
}

/**
 * 重置演示数据（v0.3.0 新增）：
 * 清空 localStorage 持久化的两份状态（未匹配条码清单 / 序号），再刷新页面——
 * 内存态（库存账、单据、盘点）随刷新自动回到初始快照。
 * 入口在「我的」页，演示翻车后一键复原。
 */
export async function resetDemoData() {
  await delay(200)
  try {
    localStorage.removeItem(PENDING_KEY)
    localStorage.removeItem(SEQ_KEY)
    localStorage.removeItem(REVIEW_KEY)
    localStorage.removeItem(RET_SEQ_KEY)
  } catch {
    /* 存储不可用时忽略 */
  }
  if (typeof window !== 'undefined') window.location.reload()
}

export default {
  PRODUCTS,
  BARCODE_MAP,
  CURRENT_STORE,
  findProductBySku,
  findProductByBarcode,
  fetchHomeOverview,
  scanBarcode,
  fetchReceipts,
  fetchReceiptDetail,
  confirmReceipt,
  scanInbound,
  scanUnknownInbound,
  confirmScanInbound,
  fetchScanInboundLogs,
  fetchReceiveDiffs,
  confirmReceiveDiff,
  fetchInventory,
  fetchStocktakeTask,
  scanForStocktake,
  finishStocktake,
  resetStocktake,
  fetchLastReconcile,
  applyStocktakeAdjust,
  fetchTransfers,
  fetchTransferDetail,
  receiveTransfer,
  scanReturn,
  confirmReturn,
  confirmManualReturn,
  fetchReturnLogs,
  fetchReviewList,
  countOpenReview,
  resolveReview,
  fetchDefectives,
  registerDefective,
  promoteDefective,
  resetDemoData
}