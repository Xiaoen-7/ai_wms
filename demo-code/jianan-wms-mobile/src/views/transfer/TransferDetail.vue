<template>
  <div class="page">
    <!-- 单据信息 -->
    <div class="card">
      <div class="card-title">
        <span>{{ detail.transferNo }}</span>
        <van-tag :type="statusType(detail.status)" size="medium" round>{{ detail.status }}</van-tag>
      </div>
      <van-cell title="调出门店" :value="detail.fromStore" :border="false" />
      <van-cell title="调入门店" :value="detail.toStore" :border="false" />
      <van-cell title="发起时间" :value="detail.createdAt" :border="false" />
      <van-cell v-if="detail.expressNo" title="快递单号" :value="detail.expressNo" :border="false" />
      <van-cell title="总件数" :value="`${detail.totalQty} 件`" :border="false" />
    </div>

    <!-- 我接收 & 已签收待点货：扫码开箱点货（PRD 5.4.2） -->
    <div v-if="canReceive" class="card">
      <div class="card-title">
        <span>扫码开箱点货</span>
        <span class="text-weak">{{ receivedCount }} / {{ lines.length }} 个 SKU 已点</span>
      </div>

      <van-button
        class="big-btn scan-btn"
        type="primary"
        icon="scan"
        block
        :loading="scanning"
        @click="onScan"
      >
        {{ scanning ? '识别中…' : '扫描箱内商品条码' }}
      </van-button>

      <div class="text-weak" style="text-align: center; margin-top: 8px">
        演示可点下方条码模拟逐件扫描
      </div>
      <div class="demo-barcodes">
        <van-tag
          v-for="b in scanableBarcodes"
          :key="b.code"
          type="primary"
          plain
          size="large"
          @click="simulateScan(b.code)"
        >
          {{ b.label }}
        </van-tag>
      </div>
    </div>

    <!-- SKU 明细：调拨单 vs 实到（PRD 5.4.2 不一致强制差异单） -->
    <div class="card">
      <div class="card-title">
        <span>调拨明细</span>
        <template v-if="detail.direction === 'in'">
          <span v-if="hasDiff" class="text-danger">存在差异</span>
          <span v-else-if="canReceive || detail.status === '已入库'" class="text-weak">实到与调拨单一致</span>
        </template>
      </div>

      <div v-for="line in lines" :key="line.sku" class="line" :class="{ 'diff-row': isDiff(line) }">
        <div class="line-head">
          <span class="line-name">{{ line.name }}</span>
          <van-tag v-if="isDiff(line)" type="danger" size="medium">差异</van-tag>
        </div>
        <div class="line-sku">{{ line.code }} / {{ line.color }} / {{ line.size }}</div>

        <div class="line-qty">
          <div class="qty-col">
            <div class="qty-label">调拨单</div>
            <div class="qty-val">{{ line.qty }}</div>
          </div>
          <!-- 已扫/实到/差异三列仅调入方向有意义；已入库后展示落账的实到数而非空扫码态（v0.3.1 修复） -->
          <template v-if="detail.direction === 'in'">
            <div class="qty-col">
              <div class="qty-label">{{ canReceive ? '已扫件数' : '实到件数' }}</div>
              <div class="qty-val">{{ effMap[line.sku] || 0 }}</div>
            </div>
            <div class="qty-col">
              <div class="qty-label">差异</div>
              <div class="qty-val" :class="diffClass(line)">{{ signedDiff(line) }}</div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 在途货权说明（PRD 5.12.1，规则待确认项 4） -->
    <div v-if="detail.status === '在途'" class="hint">
      <van-icon name="info-o" />
      在途库存挂在「在途池」虚拟仓位，既不在调出店也不在调入店的可售库存中
    </div>

    <!-- 状态流水（PRD 3.5） -->
    <div class="card">
      <div class="card-title"><span>全程状态</span></div>
      <van-steps direction="vertical" :active="detail.timeline.length - 1" active-color="#1989fa">
        <van-step v-for="(s, i) in detail.timeline" :key="i">
          <div class="tl-status">{{ s.status }}</div>
          <div class="tl-note">{{ s.note }}</div>
          <div class="text-weak">{{ s.at }}</div>
        </van-step>
      </van-steps>
    </div>

    <div class="bottom-bar-spacer" />

    <div v-if="canReceive" class="bottom-bar">
      <van-button
        class="big-btn"
        type="primary"
        block
        :loading="submitting"
        :disabled="!allScanned"
        @click="onConfirmReceive"
      >
        {{ allScanned ? (hasDiff ? '确认收货（差额挂账入库）' : '确认收货并入库') : '请先完成扫码点货' }}
      </van-button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showDialog } from 'vant'
import {
  fetchTransferDetail,
  receiveTransfer,
  findProductByBarcode,
  BARCODE_MAP
} from '../../mock/wms'

const route = useRoute()
const router = useRouter()

const detail = ref({ timeline: [], lines: [] })
const scannedMap = ref({})
const scanning = ref(false)
const submitting = ref(false)

const lines = computed(() => detail.value.lines || [])
// 我接收的、且已签收但未入库 → 可执行扫码点货
const canReceive = computed(() => detail.value.direction === 'in' && detail.value.status === '已签收')

// 已入库后展示落账的实到数（v0.3.1 修复：此前重进页面扫码态为空，误显示 0/-qty 假差异）
const receivedMap = computed(() => {
  const m = {}
  for (const r of detail.value.receivedQty || []) m[r.sku] = r.receivedQty
  return m
})
const effMap = computed(() => (canReceive.value ? scannedMap.value : receivedMap.value))

const receivedCount = computed(
  () => lines.value.filter((l) => (effMap.value[l.sku] || 0) >= l.qty).length
)
const allScanned = computed(
  () => lines.value.length > 0 && lines.value.every((l) => (effMap.value[l.sku] || 0) > 0)
)
const hasDiff = computed(() => lines.value.some((l) => isDiff(l)))

const scanableBarcodes = computed(() =>
  lines.value.flatMap((l) => {
    const code = Object.keys(BARCODE_MAP).find((c) => BARCODE_MAP[c] === l.sku)
    return code ? [{ code, label: `${l.size}/${l.color}` }] : []
  })
)

function isDiff(line) {
  const scanned = effMap.value[line.sku] || 0
  return scanned > 0 && scanned !== line.qty
}
function signedDiff(line) {
  const d = (effMap.value[line.sku] || 0) - line.qty
  return d > 0 ? `+${d}` : String(d)
}
function diffClass(line) {
  const scanned = effMap.value[line.sku] || 0
  if (!scanned) return ''
  const d = scanned - line.qty
  if (d < 0) return 'text-danger'
  if (d > 0) return 'text-success'
  return ''
}
function statusType(s) {
  if (s === '已入库') return 'success'
  if (s === '差异挂账') return 'danger'
  if (s === '在途') return 'primary'
  if (s === '已签收') return 'warning'
  return 'default'
}

async function applyScan(code) {
  const p = findProductByBarcode(code)
  if (!p) {
    showToast('未匹配商品主数据')
    return
  }
  const line = lines.value.find((l) => l.sku === p.sku)
  if (!line) {
    showToast({ message: '该商品不在本调拨单内', position: 'bottom' })
    return
  }
  const cur = scannedMap.value[p.sku] || 0
  if (cur >= line.qty) {
    showToast({ message: `${p.name} 已扫满 ${line.qty} 件`, position: 'bottom' })
    return
  }
  scannedMap.value = { ...scannedMap.value, [p.sku]: cur + 1 }
  showToast({ message: `${p.name} ${p.color}/${p.size} × ${cur + 1}`, position: 'bottom' })
}

async function onScan() {
  // 演示：按顺序给下一个未扫满的 SKU 记一件
  const target = lines.value.find((l) => (scannedMap.value[l.sku] || 0) < l.qty)
  if (!target) {
    showToast('全部 SKU 已扫满')
    return
  }
  const code = Object.keys(BARCODE_MAP).find((c) => BARCODE_MAP[c] === target.sku)
  scanning.value = true
  await new Promise((r) => setTimeout(r, 420))
  await applyScan(code)
  scanning.value = false
}

async function simulateScan(code) {
  await applyScan(code)
}

async function onConfirmReceive() {
  if (hasDiff.value) {
    try {
      // 挂账口径（PRD v2.2 签收即入库）：差异不阻塞入库，按实到入账、差额进挂账科目
      await showDialog({
        title: '实到与调拨单不一致',
        message:
          '系统将按实到件数立即入库，差额转入「待清理挂账量」科目，并生成差异单由两端店长确认货权。入库不被差异阻塞。确认提交？',
        showCancelButton: true
      })
    } catch {
      return
    }
  }
  submitting.value = true
  try {
    const payload = lines.value.map((l) => ({ sku: l.sku, receivedQty: scannedMap.value[l.sku] || 0, qty: l.qty }))
    const res = await receiveTransfer(detail.value.transferNo, payload)
    if (res.diffNo) {
      const holdQty = (res.holdDiff || []).reduce((s, h) => s + h.holdQty, 0)
      showToast({
        message: `已按实到入库，差额 ${holdQty} 件挂账，差异单 ${res.diffNo}`,
        type: 'success'
      })
    } else {
      showToast({ message: '收货入库成功', type: 'success' })
    }
    setTimeout(() => router.replace('/transfer'), 1000)
  } catch (e) {
    showToast(e.message || '收货失败')
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  detail.value = await fetchTransferDetail(route.params.no)
})
</script>

<style scoped>
.scan-btn {
  background: linear-gradient(135deg, #1989fa, #4fa5ff) !important;
  border: none !important;
}
.demo-barcodes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 10px;
}
.line {
  padding: 12px 10px;
  border-radius: 8px;
  background: #f7f8fa;
  margin-bottom: 10px;
}
.line:last-child {
  margin-bottom: 0;
}
.line-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.line-name {
  font-size: 15px;
  font-weight: 600;
}
.line-sku {
  font-size: 12px;
  color: var(--wms-text-weak);
  margin-top: 4px;
}
.line-qty {
  display: flex;
  gap: 22px;
  margin-top: 10px;
}
.qty-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.qty-label {
  font-size: 11px;
  color: var(--wms-text-weak);
}
.qty-val {
  font-size: 17px;
  font-weight: 700;
}
.hint {
  margin: 0 12px 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #ecf9ff;
  color: #1989fa;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.tl-status {
  font-size: 14px;
  font-weight: 600;
}
.tl-note {
  font-size: 13px;
  color: var(--wms-text);
  margin: 3px 0;
}
</style>