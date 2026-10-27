# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 本项目以简体中文为主；代码、文件路径、命令、技术专有名词保留英文。

---

## 项目概览

简岸门店 WMS — 移动端 H5 Demo，Vue 3 + Vite + Vant 4，**纯前端 + Mock**，不对接真实后端。

PRD 来源：`../../第5章~第8章/prd/简岸门店WMS-PRD-v2.3-20261023.md`（内容版本 v2.3，2026-10-23；新增 2.6 信息架构与导航；v2.2/v2.1 同目录留档）
账务专项评审：`../../第5章~第8章/prd/简岸门店WMS-库存账务专项评审-20261021.md`（v2.2 修复依据，含守恒约束 8.1.1 与幂等规范 8.1.2）

**交付门槛（2026-10-23 用户要求）**：任何版本给用户验收前，必须先跑 `node smoke-full.mjs` 全绿（覆盖指南剧本 A→C→D→B→E 全链路，21 项断言；前提：先重启 dev server 保证内存态干净）。此前只冒烟改动点、让用户当 QA，v0.4.4~v0.4.6 连续三个批次都是用户验收抓出 bug——不再允许。

**dev server 管理纪律（2026-10-26 用户要求）**：重启 dev server 一律用 `bash restart-dev.sh`（先杀占用 5173 的全部旧进程再起一个新实例）。严禁用 `npm run dev` 直接起新实例——旧实例会遗留在后台持续堆积（曾一下午堆 7 个被用户逐个手动清理）。改完代码需要重启时：杀旧 → 起新 → 只留一个。

**当前状态**（v0.4.7，2026-10-26 收货差异闭环）：已完成 PRD 第一批四个核心功能 + 账务守恒修复（v0.3.0）+ 验收缺陷修复（v0.3.1）+ 退换货链路（v0.4.0）+ 盘点落账护栏（v0.4.1）+ 首页工作台聚合与次品升入口（v0.4.2，按 PRD v2.3 §2.6）+ 未登记条码按钮 UX（v0.4.3）+ 盘点货架实况与连扫（v0.4.4）+ 连扫验收修复（v0.4.5）+ 驳回重盘状态恢复（v0.4.6）+ 收货差异闭环（v0.4.7）

### v0.4.7 收货差异闭环（2026-10-26，用户跑流程发现）

- **差异单无列表页**：CY 差异单此前生成后无处可看（fetchReceiveDiffs 无页面调用），首页「待确认差异」只能跳收货单凑数。修复：新增 `views/receipt/ReceiptDiffs.vue`（/receipt-diffs）——CY 单列表（单号/供应商/来源/差异行/状态）+ 店长「确认差异」动作（待确认→已确认，`confirmReceiveDiff()` 仅状态流转不改账，入库时已按实点记账）；首页待办直达
- **快捷扫码链路差异缺失**：/receipt-scan 改实收 6→5 只弹提示不挂差异。修复：`confirmScanInbound` 实收 ≠ SCAN_POOL 应收时同样生成 CY 差异单（source='快捷扫码'，log 带回 diffNo）——差异不游离在账外
- **页面标题撞名**：/receipt（收货单列表）标题误标「扫码入库」与 /receipt-scan 撞名 → 改「收货单」
- 两链路口径统一：实点/实收入账，差额生成差异单挂账追偿（差异单本身不改四科目——入库时已按实点记账）
- 冒烟：smoke-full 扩至覆盖收货单 6→5 差异 → 差异页确认 → 快捷扫码差异 → 首页跳转，全绿后交付

### v0.4.6 驳回重盘状态恢复（2026-10-23，用户验收发现）

- **驳回后按钮全灰**：护栏弹窗/底部按钮的「驳回重盘」此前只跳页面，任务状态卡在「已完成」——回到盘点页连扫/结束盘点 disabled，用户只能绕道「重新开单」清空已盘。修复：mock 新增 `resumeStocktake()`（lastReconcile 作废 + status 回「盘点中」，**已盘记录与冻结快照保留**——驳回=同一轮回去补扫，不重冻快照）；对账页两处驳回先调它再跳转
- 语义澄清：「必须盘完才能点结束」不成立——结束盘点任何时候可点（半盘有护栏弹窗兜底）；按钮灰只是任务处于已完成终态
- 冒烟：弹窗驳回/底部驳回均恢复「盘点中」且已盘保留，续扫到底正常对账（截图核验 12/12 100%）

### v0.4.5 连扫验收修复（2026-10-23，用户验收发现）

- **落账后同款差异重复出现**：SHELF_DELTA 固定预埋，落账对齐账本后下一轮盘点又冒出同样 -1（等于每轮凭空亏同一件）。修复：`applyStocktakeAdjust` 对已落账 SKU `delete SHELF_DELTA[sku]`——账实校准后差异源消失；未盘 SKU 偏差保留（货架确实还差着）；「重置演示数据」恢复初始剧情
- **连扫太快手感差**：间隔 160ms → 400ms（含 180ms 识别延迟每件约 0.6 秒），清单数字逐件跳动看得清
- **停止竞态**：点停止瞬间飞行中的一件已完成扫描但不再计入"本轮连扫 N 件"提示（数据准确，报数保守）
- 解释记录：连扫 9 件"已盘 SKU 不动"是正常的——扫的是件、进度按款计数，9 件可能全落在开头一两个款（一款十几件正是连扫的价值）

### v0.4.4 盘点扫码语义重做：货架实况 + 连扫（2026-10-23，用户三轮质疑驱动）

- **缺陷根源**：旧扫码模拟"每个未盘 SKU 记 1 件"且预置已盘数远超账面 → 跑全店盘必出 -85 级假巨亏；"一键扫满按账本补齐"思路被用户否定（系统抄答案 = 错上加错）
- **三层模型**：账本（记录）≠ 货架实况（物理世界）≠ 扫码计数。mock 新增 `SHELF_DELTA`（预置偏差：大衣黑S -1 / 衬衫米白M +1 / 开衫浅灰S -1，剧情=昨售漏记/到货漏登/样衣借出）+ `shelfQtyOf()`（实况 = 冻结快照 + delta，重开单自动跟随新账本）
- **物理上限**：`scanForStocktake` 校验货架实况——扫满再扫返回 `shelfDone:true`，页面提示"货架上已扫不出更多"，杜绝凭空多计
- **连扫模式**（替代"一键扫满"）：每 160ms 逐件扫"货架上的下一件"，可随时停止，扫完自动停并报件数——模拟真实扫码枪连发（真实门店扫几百上千件靠扫码枪每秒 3~5 次连发/RFID 批量读，不靠点按钮）；不偷看账本，差异 = 货架 vs 账本自然暴露
- **预置已盘修正**：初始 7 个已盘 SKU 改为等于各自货架实况（此前衬衫 11/账面 9 等错数）
- 冒烟 11 项：连扫到底 21 件自动停、12/12 全盘、对账差异 = 盘亏 2 / 盘盈 1（真实小差异，截图核验）；指南剧本 B 已同步改写（实操指南 v1.1）

### v0.4.3 未登记条码按钮 UX（2026-10-23，用户验收发现）

- 「扫一条未登记条码（演示）」功能有效但反馈弱（van-tag 似禁用态 + toast 一闪 + 清单在页尾不滚动）：van-tag → van-button plain danger；toast 后自动平滑滚动到 PendingList（nextTick + scrollIntoView）

### v0.4.2 信息架构聚合（2026-10-23，按 PRD v2.3 §2.6）

- 首页待办补「退货待复核」「次品待处理」两项（点击直达 /returns/review、/defective）；今日概况补「今日退货」行（→/returns）；待办网格 4 列改 3 列（6 项两行）
- 次品登记升「功能」页一级入口（PRD 5.6.2 独立页面定位回归）；撤掉退换货主页底部次品小卡片（单一入口原则）
- `fetchHomeOverview` 扩展 todos.review / todos.defective / today.returns；入口归属后续以 PRD §2.6 登记，不再即兴

### v0.4.1 盘点落账护栏（2026-10-23，用户验收发现）

- **半轮盘点可一键砍账**：重新开单后只扫极少件数即结束对账（如 -41 盘亏），点「确认差异」直接落账——数字是诚实减法，但没盘完的结果不应被静默确认。修复：覆盖率 < 100% 时确认强制弹窗（写明已盘/未盘数量、差异合计，按钮〔驳回重盘〕〔我知悉，仍要确认〕）；弹窗里点驳回 = 结果作废回盘点页。覆盖率 100% 不弹窗直落。

### v0.3.1 修复记录（2026-10-22，用户验收发现）

1. **盘点未盘误算盘亏**：`finishStocktake` 此前把未盘 SKU 按实盘 0 计入对账（5 个未盘 = -22 件假盘亏）。修复：只对已盘 SKU 出差异，`uncheckedSku` 单独报数，结果页加黄条提示「未盘 ≠ 盘亏」
2. **确认差异不落账**：`StocktakeResult` 的「确认差异」按钮此前只弹 toast、库存纹丝不动。修复：新增 `applyStocktakeAdjust()`——生成 TZ 调整单，账面向实盘对齐（盘亏减可售/盘盈加可售；账实校准事件，合计随 Δ 变化，非守恒内部转移）
3. **调拨完成态假差异**：重进已入库调拨单详情，「已扫件数」显示 0、差异显示 -qty（扫码是页面本地态，重进即空）。修复：已完成单改用落账的 `receivedQty` 渲染「实到件数」；已扫/差异列仅调入方向显示
4. **收货页缺扫错演示**：`ReceiptDetail` 补「扫一条错误箱码（演示）」按钮 + 挂入 PendingList，三页口径统一（PRD 3.7）

### v0.4.0 退换货批次（2026-10-22）

按 PRD 5.6.1 / 5.6.2 / 3.4 实现，入口在「功能」页网格：

| 功能 | 页面 | 说明 |
|------|------|------|
| 退换货主页 | `views/returns/ReturnsHome.vue` | 验退入口 + 待复核角标 + 今日退货记录 + 次品登记入口 |
| 扫码验退 | `views/returns/ReturnScan.vue` | 扫码反查原销售单（SKU/批次/购买时间/原单号）→ 吊牌判断分流「入回原库存」/「归次品」两个大按钮；可选换货 = 一退一进两笔事件；查无原单 → 人工录入表单（强制勾选「标记待复核」才能提交） |
| 待复核清单 | `views/returns/ReturnReview.vue` | 待复核/已复核两 Tab，补录原单号解除标记（PRD 24h 口径） |
| 次品登记 | `views/defective/DefectiveList.vue` | 汇总头 + 状态筛选 + 浮动登记按钮（原因必填，可售→次品守恒转移）+ 促销处理（次品账扣减）+ 处理留痕 |

Mock 层（`src/mock/wms.js`）：
- `SALES` 模拟 POS 原销售单（4 条）；`scanReturn()` 确定性轮询 4 种场景（连衣裙有原单 → 衬衫有原单 → 大衣查无原单 → 开衫有原单），序号持久化 `wms_ret_seq_v1`
- `confirmReturn()`：吊牌完好 → 可售 +qty（外部流入）；破损 → 次品账 +qty 并自动生成次品登记（CP 单）；换货先校验换出库存再统一落账（防半截记账），换出可售 -qty
- `confirmManualReturn()`：强制待复核（`reviewFlag` 未勾直接 throw），入待复核清单（localStorage 持久化 `wms_review_list_v1`，重置演示数据会一并清理）
- `registerDefective()`：原因必填、可售不足拦截；`promoteDefective()`：留痕 trail + 次品账扣减
- 守恒口径：退货入库/次品归入为外部流入（Σ四科目增加），换货出库/促销处理为外部流出（Σ 减少）——与收货同理，「只随事件变动」而非恒不变

| 功能 | 页面 | 对应 PRD |
|------|------|----------|
| 首页看板 | `views/Home.vue` | — |
| 扫码入库 | `views/receipt/ReceiptList.vue`、`ReceiptDetail.vue`、`ScanInbound.vue`（快捷扫码，路由 `/receipt-scan`） | 5.1.1 扫码收货 / 5.1.2 收货差异处理 |
| 扫码盘点 | `views/stocktake/Stocktake.vue`、`StocktakeResult.vue` | 5.2.1 扫码盘点 / 5.2.2 差异自动对账 |
| 未匹配条码处置 | `components/PendingList.vue`（收货详情 / 快捷扫码 / 盘点三页共用） | 3.7 未匹配条码处置状态机 |
| 实时库存 | `views/Inventory.vue` | 5.3.1 实时库存查询 / 5.3.2 库存分类视图 |
| 调拨进度 | `views/Transfer.vue`、`views/transfer/TransferDetail.vue` | 5.4.1 调拨发起与查看 / 5.4.2 调拨扫码发货收货 |
| 退换货 | `views/returns/ReturnsHome.vue`、`ReturnScan.vue`、`ReturnReview.vue`、`views/defective/DefectiveList.vue` | 5.6.1 扫码验退与入库 / 5.6.2 次品登记 |

**尚未实现**（PRD 后续批次）：差异追溯报告（5.5）、快速盘点范围选择（5.2.3）、销售报表（5.8）、收货差异单列表页。

---

## 常用命令

```bash
npm install        # 首次安装依赖
npm run dev        # dev server（实际端口 5173，见 vite.config.js）
npm run build      # 生产构建 → dist/（base: './' 相对路径，可部署根路径或任意子路径）
npm run preview    # 预览构建产物
```

**交付构建**：推荐走 skill 脚本 `build-demo.sh`（构建 + 打印 Nginx/Apache 发布说明）。本机 `bash` 不在 PATH，需用 Git Bash 调用，工作目录须在项目根：

```bash
"D:\XboxGames\AI\Git\bin\bash.exe" .claude/skills/demo-design/scripts/build-demo.sh jianan-wms-mobile
```

**关于测试 / Lint**：无 `npm test` / `npm run lint` / Prettier — 验证靠 `npm run dev` + 浏览器人工对照。

---

## 启动顺序（`src/main.js`）

1. `import 'vant/lib/index.css'` 全量引入样式
2. `import Vant from 'vant'` → `app.use(Vant)` 全量注册（demo 简便做法）
3. `import './mock'`（Promise 风格，不拦截 XHR）
4. `import './styles/global.css'` 全局样式（大按钮、差异高亮、同步时间戳等）
5. `app.use(router).mount('#app')`

---

## 高层架构

### 路由（`src/router/index.js`）

- `createWebHashHistory()` — 静态托管友好
- 一级 Tab 页（`meta.tabbar: true`）：`/home` `/inventory` `/transfer` `/profile`，带 `keep-alive`
- 二级页（`meta.tabbar: false`，`App.vue` 自动隐藏 Tabbar 并显示返回箭头）：
  - `/receipt`、`/receipt/:no` — 扫码入库
  - `/receipt-scan` — 快捷扫码入库（单件直入，`ScanInbound.vue`）
  - `/stocktake`、`/stocktake/result` — 扫码盘点
  - `/transfer/:no` — 调拨详情 / 扫码收货
- `meta.title` 经 `router.afterEach` 同步 `document.title`

### 根组件（`src/App.vue`）

- `<van-nav-bar fixed placeholder>`，标题取自 `route.meta.title`
- `<router-view>` 套 `<keep-alive :include>`（只缓存一级 Tab 页）
- `<van-tabbar route>` 按 `meta.tabbar` 决定是否渲染

### Mock 数据层（`src/mock/wms.js`，**核心**）

单文件，内存态数据，刷新页面复位；**例外**：未匹配条码清单 `pendingList` 与演示序列持久化到 localStorage（`wms_pending_list_v1` / `wms_unknown_seq_v1`），刷新、跨标签不丢、两页共享。所有接口 `async` + 200~600ms 模拟延迟。

- **商品主数据** `PRODUCTS`（12 个 SKU，货号-颜色-尺码）+ `BARCODE_MAP`（条码 → SKU）
- **库存账** `inventory`：`{ sku, sellable, inTransit, defective, holding }` 四科目，对齐 PRD v2.2 8.1.1；`inventoryTotal()` 提供守恒校验（开发调试断言用）
- **收货** `receipts`（两张单：ASN20261019001 三箱 / ASN20261020002 两箱）+ `receiveDiffs` 差异单
- **盘点** `stocktakeTask`（初始已盘 7/12 SKU，含 `snapshot` 冻结快照）+ `lastReconcile` 对账结果
- **未匹配条码** `pendingList`：`{ code, count, status, at }`，读写走 `listPending` / `addPending` / `resolvePending`（PRD 3.7）
- **调拨** `transfers`（3 单，覆盖 在途 / 已签收 / 已入库 三种状态；DB20261017002 在途池与库存初始数据守恒）

写操作会改内存库：`confirmReceipt` / `confirmScanInbound` 加可售库存、`receiveTransfer` 签收即入库 + 在途池清账 + 差额挂账、`finishStocktake` 产出归因结果。新增 `resetStocktake()`（重新开单并重新冻结快照）与 `resetDemoData()`（清 localStorage 两 key 并刷新，入口在「我的」页）。

### ⚠️ 对 PRD 8.1.2 的实现偏差声明（v0.3.0 拍板）

PRD 8.1.2 要求 `client_txn_id` 幂等表防重复提交。**Demo 不实现幂等表**：纯前端 Mock 无并发场景，补幂等表属形式主义。防重采用**单据状态机拦截**（PRD 3.6）：`confirmReceipt` 非「待收货」、`receiveTransfer` 非「已签收」直接 throw，终态单据不可重复执行。真实系统按 8.1.2 实现幂等表。

> `src/mock/index.js` 与 `src/mock/api.js` 是模板遗留的通用示例（Banner/九宫格/用户信息），**业务页面均不引用**，可删。

### 关键业务逻辑对齐 PRD

- **扫码入库**：箱码 → 箱内 SKU（`receipts[].boxes`）→ 逐行对比 `docQty` vs `actualQty`，差异行 `.diff-row` 红色高亮 → 确认后按实点入库，差异部分生成差异单挂账（PRD 5.1.2）；状态机防重，已入库单不可重复提交
- **快捷扫码入库**：定位为「散件补录」（无送货单的零散入库），与收货单核点路径明确区分，消除双入库路径歧义
- **扫码盘点**：同一 SKU 连续扫码累加；未知条码不静默丢弃，经 `scanForStocktake` 挂入共享 `pendingList`（PRD 5.2.1 / 3.7）；结束触发 `finishStocktake` → 差异 = 实盘 − **冻结快照账面**（PRD 5.16，盘点窗口内的账本变动不污染对账）→ `attribute()` 输出 R1/R2 归因 + 证据链 + 置信度（PRD 5.2.2）；已完成任务可「重新开单」并重新冻结快照
- **未匹配条码处置**（`components/PendingList.vue`，两页共用）：按码去重、同码累加 ×N；点「待核实」条目弹四选一（挂错/未建档/错发/损坏）→ 状态流转；「待补录 → 已补录 → 已追认」由按钮人工推进——**不自动追认入账**；挂起超 48h 升级提醒为静态文案（PRD 3.7）
- **实时库存**：搜索（货号/SKU/品名/颜色）+ 五页签（全部/可售/在途/次品/挂账），汇总头四科目（PRD 8.1.1）；页脚固定标注数据截止时间（PRD 5.3.1 断网降级口径）
- **调拨进度**：状态机 `已发起 → 已发货 → 在途 → 已签收 → 已入库`（PRD 3.5）；实到 ≠ 调拨单时**签收即入库**——按实到件数入可售账、在途池按应到数清账、差额进「待清理挂账量」科目、差异单照常生成但不阻塞入库（PRD v2.2 5.4.2 / 8.1.1）；状态机防重，非「已签收」不可重复点货

### 演示路径说明（扫码怎么演示）

真实设备靠扫码枪输入或相机识别。Demo 里每个扫码页都提供了**可点击的条码快捷标签**模拟扫描；「扫描」大按钮会自动依次扫下一个未扫对象。**错误路径**：收货单详情、快捷扫码、盘点三页均有「扫一条错误箱码/条码（演示）」按钮，命中未登记码即挂入共享待处理清单（PRD 3.7），演示"扫错不静默丢弃"。

---

## 开发过程约束（硬约束）

- **`npm run build` 不要在 Claude 自动化里跑**，验证靠 `npm run dev` 浏览器对照即可。例外：交付前构建验证、或浏览器实测需要 `dist/` 产物时可跑，推荐走 `build-demo.sh`（对齐 specs/common.md「交付前 `npm run build` 验证可构建」）。
- **`git add` / `git commit` / `git push` 只能由人发起**。完成任务后**只**保留 working tree 改动 + 给「建议 commit 信息」。
- 例外：用户**明确**说「帮我 commit」/「提交」/「push」时才走 commit 流程。

---

## v0.4.9（2026-10-27 用户验收反馈）

- **「再扫一件」合并成一步**（ReturnScan）：done 态点「再扫一件」直接调 onScan 扫下一件，不再回空态页再点大按钮——一次点击 = 扫码枪过一件货
- **人工录入自动填入**（ReturnScan noSale 分支）：查无原单时退货商品由条码自动识别填入（`scanReturn` 本就返回 product，之前表单弃用了），店员改选需 showConfirmDialog 二次确认（改错商品 24h 补录原单环节对账暴露）——「条码即商品」防选错
- 冒烟新增 D4b 断言（自动填入校验，注意 Vant 只读字段的值在 input.value 里，`text=` 选择器匹配不到）；34 项全绿
- 截图脚本 D 段同步改流程，shot 27 前等 2.4s 让上一扫 toast 消失；47 张重截 + 图解版 v2 重新生成

---

## 图解版指南截图工具链（2026-10-27 建）

- **`capture-guide.mjs`**：按指南 v1.2 全剧本（A 含差异 → P 分件处置 → C → D → D-3 次品 → B 连扫/盘平/护栏 → E）走一遍并截图，每步输出**干净版 + 红框标注版**双份到 `第5章~第8章/guide-images-v2{,-annotated}/`（47 张）。自带 localStorage 清空 + reload 复位，幂等可重跑。
- **`capture-guide-template.html`**：图解版 v2 模板，图片用 `{{IMG:名称}}` 占位。改文案/图位只改模板，再用 node 内嵌 base64 生成自包含 HTML（`简岸门店WMS-实操指南-图解版-v2.html`，7.7MB）。
- **界面再改版后的重截流程**：restart-dev.sh 起干净服务 → `node capture-guide.mjs`（47/47 全绿）→ 改模板 → 内嵌生成 v2 HTML → commit。截图必须抽查亲眼看（防 toast 时序/标注跑偏）。