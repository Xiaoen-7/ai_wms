<template>
  <div class="page">
    <!-- 任务头 -->
    <div class="card">
      <div class="card-title">
        <span>{{ task.taskNo }}</span>
        <van-tag :type="task.status === '已完成' ? 'success' : 'warning'" size="medium" round>
          {{ task.status }}
        </van-tag>
      </div>
      <van-cell title="盘点范围" :value="task.scope" :border="false" />
      <van-cell title="开始时间" :value="task.startedAt" :border="false" />
      <van-cell title="已盘 SKU" :border="false">
        <template #value>
          <span class="progress-text">{{ scannedCount }} / {{ task.totalSku }}</span>
        </template>
      </van-cell>
      <van-progress
        :percentage="percent"
        stroke-width="8"
        :color="percent === 100 ? '#07c160' : '#1989fa'"
        style="margin-top: 8px"
      />
    </div>

    <!-- 扫码大按钮 + 连扫模式（v0.4.4：扫的是货架，不是账本） -->
    <div class="card">
      <van-button
        class="big-btn scan-btn"
        type="success"
        icon="scan"
        block
        :loading="scanning"
        :disabled="batching"
        @click="onScan"
      >
        {{ scanning ? '识别中…' : '扫码盘点（扫下一件）' }}
      </van-button>
      <van-button
        class="big-btn batch-btn"
        type="primary"
        plain
        block
        :disabled="scanning || task.status === '已完成'"
        @click="onToggleBatch"
      >
        {{ batching ? `停止连扫（本轮已扫 ${batchCount} 件）` : '连扫模式（模拟扫码枪连发）' }}
      </van-button>
      <div class="text-weak" style="text-align: center; margin-top: 8px">
        每次点击 = 扫码枪过一件货，同一 SKU 自动累加；货架上有几件就扫得出几件，扫完会提示；盲盘不显示账面，盘盈盘亏对账时见分晓
      </div>
      <div class="demo-barcodes">
        <van-tag
          v-for="b in demoBarcodes"
          :key="b.code"
          type="success"
          plain
          size="large"
          :disabled="batching"
          @click="simulateScan(b.code)"
        >
          {{ b.label }}
        </van-tag>
      </div>
      <van-button
        class="unknown-btn"
        size="small"
        plain
        block
        type="danger"
        :disabled="batching"
        @click="onScanUnknown"
      >
        扫一条未登记条码（演示）
      </van-button>
    </div>

    <!-- 已盘清单 -->
    <div class="card">
      <div class="card-title">
        <span>已盘清单</span>
        <span class="text-weak">共 {{ list.length }} 个 SKU</span>
      </div>

      <van-empty v-if="!list.length" description="还没有扫码记录，请开始扫码" image-size="80" />

      <div v-for="item in list" :key="item.sku" class="scan-row">
        <div>
          <div class="scan-name">{{ item.name }}</div>
          <div class="scan-sku">{{ item.code }} / {{ item.color }} / {{ item.size }}</div>
        </div>
        <div class="scan-qty">{{ item.qty }}</div>
      </div>
    </div>

    <!-- 未知条码挂起（PRD 5.2.1：不静默丢弃；PRD 3.7 处置状态机，与扫码入库共享清单） -->
    <PendingList ref="pendingListRef" />

    <div class="bottom-bar-spacer" />

    <div class="bottom-bar">
      <!-- 重新开单（PRD 5.16：新一轮盘点重新冻结快照）——已完成态显示 -->
      <van-button
        v-if="task.status === '已完成'"
        class="big-btn"
        type="warning"
        plain
        block
        :loading="resetting"
        style="margin-bottom: 10px"
        @click="onReset"
      >
        重新开单
      </van-button>
      <van-button class="big-btn" type="primary" block :loading="finishing" :disabled="task.status === '已完成'" @click="onFinish">
        结束盘点并自动对账
      </van-button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import PendingList from '../../components/PendingList.vue'
import {
  fetchStocktakeTask,
  scanForStocktake,
  finishStocktake,
  resetStocktake,
  findProductByBarcode,
  scanUnknownInbound,
  shelfQtyOf,
  BARCODE_MAP,
  PRODUCTS
} from '../../mock/wms'

const router = useRouter()

const task = ref({
  taskNo: '',
  scope: '',
  startedAt: '',
  status: '',
  scanned: {},
  totalSku: 0
})
const scannedMap = ref({})
const scanning = ref(false)
const finishing = ref(false)
const resetting = ref(false)
/** 未匹配条码清单组件（PRD 3.7，与扫码入库页共享同一份数据） */
const pendingListRef = ref(null)

const scannedCount = computed(() => Object.keys(scannedMap.value).length)
const percent = computed(() => {
  if (!task.value.totalSku) return 0
  return Math.round((scannedCount.value / task.value.totalSku) * 100)
})

const list = computed(() =>
  Object.entries(scannedMap.value).map(([sku, qty]) => {
    const p = findProductByBarcode(
      Object.keys(BARCODE_MAP).find((k) => BARCODE_MAP[k] === sku)
    ) || { sku, code: sku.split('-')[0], name: '未知商品', color: '-', size: '-' }
    return { sku, qty, ...p }
  })
)

// 演示用条码：取前 4 个商品做快捷扫码
const demoBarcodes = computed(() =>
  Object.keys(BARCODE_MAP)
    .slice(0, 4)
    .map((code) => {
      const p = findProductByBarcode(code)
      return { code, label: `${p.size}/${p.color}` }
    })
)

async function applyScan(code, { silent = false } = {}) {
  const res = await scanForStocktake(code, scannedMap.value)
  if (!res.matched) {
    // 已在 mock 中挂入共享清单，这里只刷新展示与提示（避免重复入账）
    pendingListRef.value?.reload()
    showToast({
      message: res.dup
        ? `同一未登记码再次命中，已累加 ×${res.pending.count}`
        : '未匹配商品主数据，已挂入待处理',
      position: 'bottom'
    })
    return true
  }
  // v0.4.4 货架实况约束：货架上有几件就扫得出几件，扫满后再扫同一码物理上扫不出货
  if (res.shelfDone) {
    if (!silent) {
      showToast({
        message: `「${res.product.name} ${res.product.color}${res.product.size}」货架上已扫不出更多（本轮已扫 ${res.shelf} 件）`,
        position: 'bottom'
      })
    }
    return false
  }
  scannedMap.value = { ...scannedMap.value, [res.product.sku]: res.count }
  if (!silent) {
    showToast({
      message: `${res.product.name} ${res.product.color}/${res.product.size} × ${res.count}`,
      position: 'bottom'
    })
  }
  return true
}

/**
 * 扫「货架上的下一件」（v0.4.4 货架实况语义）：
 * 按主数据顺序找到第一个还没扫满货架实况的 SKU，对其扫码 +1。
 * 全部扫满（货架扫完）返回 false。真实设备上这就是扫码枪沿货架逐件过的过程。
 */
async function scanNext({ silent = false } = {}) {
  const nextSku = PRODUCTS.map((p) => p.sku).find(
    (sku) => (scannedMap.value[sku] || 0) < shelfQtyOf(sku)
  )
  if (!nextSku) {
    if (!silent) showToast({ message: '货架上已全部扫完', position: 'bottom' })
    return false
  }
  const code = Object.keys(BARCODE_MAP).find((k) => BARCODE_MAP[k] === nextSku)
  return applyScan(code, { silent })
}

/** 演示扫未登记条码：与扫码入库页共用同一序列（确定性可复现，非概率） */
async function onScanUnknown() {
  const { code } = await scanUnknownInbound()
  await applyScan(code)
  // v0.4.3：扫完自动滚到未匹配条码清单，让"挂入待处理"看得见（此前 toast 一闪而过、清单在页尾）
  await nextTick()
  pendingListRef.value?.$el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
}

async function onScan() {
  // 真实设备：扫码枪输入 / 相机识别。演示扫"货架上的下一件"（v0.4.4 货架实况语义）
  scanning.value = true
  await new Promise((r) => setTimeout(r, 500))
  await scanNext()
  scanning.value = false
}

// ---- 连扫模式（v0.4.4）：模拟扫码枪连发，每 160ms 逐件过枪口 ----
// 替代原"一键扫满"思路：连扫不偷看账本，逐件可见、可随时停止，
// 扫到底的结果 = 货架实况，真实盘盈盘亏在对账页自然暴露。
const batching = ref(false)
const batchCount = ref(0)
let batchTimer = null

async function batchLoop() {
  if (!batching.value) return
  const ok = await scanNext({ silent: true })
  // v0.4.5：停止后飞行中的这一件不再计入"本轮连扫 N 件"（数据已落账不受影响）
  if (!batching.value) return
  if (!ok) {
    stopBatch(true)
    return
  }
  batchCount.value += 1
  // v0.4.5：160ms → 400ms（加上扫码识别延迟每件约 0.6 秒），看得清单数字逐件跳
  batchTimer = setTimeout(batchLoop, 400)
}

function startBatch() {
  batching.value = true
  batchCount.value = 0
  batchLoop()
}

function stopBatch(finished = false) {
  batching.value = false
  if (batchTimer) {
    clearTimeout(batchTimer)
    batchTimer = null
  }
  showToast({
    message: finished
      ? `连扫完成：本轮连扫 ${batchCount.value} 件，货架已全部扫完`
      : `连扫已停止：本轮连扫 ${batchCount.value} 件`,
    position: 'bottom'
  })
}

function onToggleBatch() {
  if (batching.value) stopBatch()
  else startBatch()
}

onUnmounted(() => {
  batching.value = false
  if (batchTimer) clearTimeout(batchTimer)
})

async function simulateScan(code) {
  await applyScan(code)
}

async function onFinish() {
  if (scannedCount.value === 0) {
    showToast('尚未扫码，无法对账')
    return
  }
  finishing.value = true
  try {
    await finishStocktake(scannedMap.value)
    router.push('/stocktake/result')
  } catch (e) {
    showToast(e.message || '对账失败')
  } finally {
    finishing.value = false
  }
}

/** 重新开单：清空实盘数、回到「盘点中」，mock 层按当前账本重新冻结快照（PRD 5.16） */
async function onReset() {
  try {
    // 店员界面只说规则结果，不说"快照"这类实现术语
    await showConfirmDialog({
      title: '重新开单',
      message: '将清空本次已盘记录，从当前库存重新开始一轮盘点；上一轮的对账结果不受影响。确定重新开单？',
      showCancelButton: true
    })
  } catch {
    return
  }
  resetting.value = true
  try {
    await resetStocktake()
    const t = await fetchStocktakeTask()
    task.value = t
    scannedMap.value = {}
    showToast('已重新开单，以当前库存重新计账')
  } finally {
    resetting.value = false
  }
}

onMounted(async () => {
  const t = await fetchStocktakeTask()
  task.value = t
  scannedMap.value = { ...t.scanned }
})
</script>

<style scoped>
.scan-btn {
  background: linear-gradient(135deg, #07c160, #4dd599) !important;
  border: none !important;
}
.batch-btn {
  margin-top: 10px;
}
.demo-barcodes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 10px;
}
.progress-text {
  font-weight: 700;
  color: var(--wms-primary);
}
.scan-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #f2f3f5;
}
.scan-row:last-child {
  border-bottom: none;
}
.scan-name {
  font-size: 14px;
  font-weight: 600;
}
.scan-sku {
  font-size: 12px;
  color: var(--wms-text-weak);
  margin-top: 3px;
}
.scan-qty {
  font-size: 20px;
  font-weight: 700;
  color: var(--wms-success);
}
</style>