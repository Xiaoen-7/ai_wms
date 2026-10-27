<template>
  <div class="page">
    <!-- 送货单信息 -->
    <div class="card">
      <div class="card-title">
        <span>{{ detail.receiptNo }}</span>
        <van-tag :type="detail.status === '已入库' ? 'success' : 'warning'" size="medium" round>
          {{ detail.status }}
        </van-tag>
      </div>
      <van-cell title="供应商" :value="detail.supplier" :border="false" />
      <van-cell title="到货时间" :value="detail.arriveAt" :border="false" />
    </div>

    <!-- 扫码区 -->
    <div class="card">
      <div class="card-title">
        <span>扫描箱外条码</span>
        <span class="text-weak">已扫 {{ scannedBoxes }} / {{ lines.length }} 箱</span>
      </div>

      <van-button
        class="big-btn scan-btn"
        type="primary"
        icon="scan"
        block
        :loading="scanning"
        @click="onScan"
      >
        {{ scanning ? '识别中…' : '扫描箱外条码' }}
      </van-button>

      <div class="text-weak" style="text-align: center; margin-top: 8px">
        演示可点下方条码直接模拟扫描
      </div>

      <div class="demo-barcodes">
        <van-tag
          v-for="b in lines.filter((l) => !l.scanned)"
          :key="b.boxCode"
          type="primary"
          plain
          size="large"
          @click="simulateScan(b.boxCode)"
        >
          {{ b.boxCode }}
        </van-tag>
        <span v-if="!lines.some((l) => !l.scanned)" class="text-weak">全部箱已完成扫描</span>
      </div>

      <van-button
        class="unknown-btn"
        size="small"
        plain
        block
        :loading="scanningUnknown"
        @click="onScanUnknownBox"
      >
        扫一条错误箱码（演示）
      </van-button>
    </div>

    <!-- 未登记箱码挂起（PRD 5.1.1：不静默丢弃；PRD 3.7 处置状态机，三页共享清单） -->
    <PendingList ref="pendingListRef" />

    <!-- 待收清单：逐行对比送货单，差异行红色高亮（PRD 5.1.1） -->
    <div class="card">
      <div class="card-title">
        <span>箱内 SKU 清单</span>
        <span v-if="diffCount" class="text-danger">差异 {{ diffCount }} 行</span>
        <span v-else class="text-weak">与送货单一致</span>
      </div>

      <div v-for="line in lines" :key="line.boxCode" class="line" :class="{ 'diff-row': isDiff(line) }">
        <div class="line-head">
          <span class="line-name">{{ line.name }}</span>
          <van-tag v-if="!line.scanned" size="medium" plain>待扫描</van-tag>
          <van-tag v-else-if="isDiff(line)" type="danger" size="medium">数量不符</van-tag>
          <van-tag v-else type="success" size="medium" plain>已核对</van-tag>
        </div>
        <div class="line-sku">
          {{ line.code }} / {{ line.color }} / {{ line.size }}
        </div>
        <div class="line-qty">
          <div class="qty-col">
            <div class="qty-label">送货单</div>
            <div class="qty-val">{{ line.docQty }}</div>
          </div>
          <div class="qty-col">
            <div class="qty-label">实点数量</div>
            <van-stepper
              v-model="line.actualQty"
              :min="0"
              :max="999"
              integer
              :disabled="!line.scanned"
              input-width="52px"
              button-size="30px"
              @change="onQtyChange(line)"
            />
          </div>
          <div class="qty-col">
            <div class="qty-label">差异</div>
            <div class="qty-val" :class="diffClass(line)">{{ signedDiff(line) }}</div>
          </div>
        </div>
        <div class="line-box text-weak">箱码 {{ line.boxCode }} · 单价 ¥{{ line.price }}</div>
      </div>
    </div>

    <div v-if="diffCount" class="diff-tip">
      <van-icon name="warning-o" />
      存在差异时，系统按实点入库，差异部分生成差异单挂账待供应商确认
    </div>

    <div class="bottom-bar-spacer" />

    <div class="bottom-bar">
      <van-button
        class="big-btn"
        type="primary"
        block
        :loading="submitting"
        :disabled="!canSubmit"
        @click="onConfirm"
      >
        {{
          processed
            ? detail.status === '有差异'
              ? '本单已入库 · 差异挂账待确认'
              : '本单已入库'
            : canSubmit
              ? '确认入库'
              : '请先扫描全部箱码'
        }}
      </van-button>
    </div>

    <!-- 差异单弹层（PRD 5.1.2） -->
    <van-dialog
      v-model:show="showDiff"
      title="已生成收货差异单"
      confirm-button-text="推送供应商确认"
      show-cancel-button
      cancel-button-text="稍后处理"
      @confirm="onPushSupplier"
      @cancel="onDiffLater"
    >
      <div v-if="diffResult" class="dialog-body">
        <van-cell title="差异单号" :value="diffResult.diffNo" :border="false" />
        <van-cell title="关联收货单" :value="diffResult.receiptNo" :border="false" />
        <van-cell title="状态" :value="diffResult.status" :border="false" />
        <div class="diff-lines">
          <div v-for="l in diffResult.lines" :key="l.sku" class="diff-line">
            <span>{{ l.name }} {{ l.code }}</span>
            <span class="text-danger">
              单 {{ l.docQty }} / 实 {{ l.actualQty }} / 差 {{ l.diffQty }}
            </span>
          </div>
        </div>
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import PendingList from '../../components/PendingList.vue'
import { confirmReceipt, fetchReceiptDetail, addPending, scanUnknownInbound, BARCODE_MAP } from '../../mock/wms'

const route = useRoute()
const router = useRouter()

const detail = ref({ receiptNo: '', supplier: '', arriveAt: '', status: '', lines: [] })
const scanning = ref(false)
const scanningUnknown = ref(false)
const submitting = ref(false)
const showDiff = ref(false)
const diffResult = ref(null)
/** 未匹配箱码清单组件（PRD 3.7，三页共享同一份数据） */
const pendingListRef = ref(null)

const lines = computed(() => detail.value.lines || [])
const scannedBoxes = computed(() => lines.value.filter((l) => l.scanned).length)
const canSubmit = computed(
  () =>
    detail.value?.status === '待收货' &&
    lines.value.length > 0 &&
    scannedBoxes.value === lines.value.length
)
/** 单据已处理（已入库/有差异）后禁止重复确认入库（v0.4.7） */
const processed = computed(() => detail.value && detail.value.status !== '待收货')

const diffCount = computed(() => lines.value.filter((l) => l.scanned && isDiff(l)).length)

function isDiff(line) {
  if (!line.scanned) return false
  return Number(line.actualQty) !== Number(line.docQty)
}
function signedDiff(line) {
  const d = Number(line.actualQty) - Number(line.docQty)
  return d > 0 ? `+${d}` : String(d)
}
function diffClass(line) {
  if (!line.scanned) return ''
  const d = Number(line.actualQty) - Number(line.docQty)
  if (d < 0) return 'text-danger'
  if (d > 0) return 'text-success'
  return ''
}

/**
 * 扫描箱外条码：真实设备由扫码枪输入或相机识别，此处按顺序扫下一箱。
 * 箱码 → 箱内 SKU 的映射在真实系统中由供应商箱码体系维护（PRD 待确认项 2）。
 */
async function onScan() {
  const next = lines.value.find((l) => !l.scanned)
  if (!next) {
    showToast('全部箱码已扫描完成')
    return
  }
  scanning.value = true
  await new Promise((r) => setTimeout(r, 700))
  next.scanned = true
  scanning.value = false
  showToast(`识别成功：${next.name} ${next.color}/${next.size}`)
}

function simulateScan(boxCode) {
  const line = lines.value.find((l) => l.boxCode === boxCode)
  if (!line || line.scanned) return
  line.scanned = true
  showToast(`识别成功：${line.name}`)
}

/**
 * 演示扫到未登记箱码（供应商贴错箱标 / 非本单箱）：
 * 与快捷扫码、盘点两页一致，挂入共享待处理清单而非静默丢弃（PRD 3.7）
 */
async function onScanUnknownBox() {
  if (scanning.value || scanningUnknown.value) return
  scanningUnknown.value = true
  try {
    const { code } = await scanUnknownInbound()
    const { item, dup } = addPending(code)
    pendingListRef.value?.reload()
    showToast({
      message: dup
        ? `同一未登记箱码再次命中：${code}，已累加 ×${item.count}`
        : `未登记箱码：${code}，已挂入待处理`,
      position: 'bottom'
    })
  } catch (e) {
    showToast(e.message || '扫码失败，请重试')
  } finally {
    scanningUnknown.value = false
  }
}

// PRD 5.1.1：实点与送货单不一致 → 拦截入库并生成差异记录。
// Demo 中允许继续，但会生成差异单挂在收货单上（见 PRD 5.1.2 供应商确认前按实点入库）。
function onQtyChange(line) {
  if (isDiff(line)) {
    showToast({ message: `${line.name} 与送货单不符，将生成差异单`, position: 'bottom' })
  }
}

async function onConfirm() {
  submitting.value = true
  try {
    const res = await confirmReceipt(detail.value.receiptNo, lines.value)
    if (res.diff) {
      diffResult.value = res.diff
      showDiff.value = true
      detail.value.status = '有差异'
    } else {
      showToast({ message: `入库成功，新增 ${res.addedQty} 件`, type: 'success' })
      detail.value.status = '已入库'
      setTimeout(() => router.replace('/receipt'), 900)
    }
  } catch (e) {
    showToast(e.message || '入库失败')
  } finally {
    submitting.value = false
  }
}

function onPushSupplier() {
  showToast({ message: '差异单已推送供应商，可稍后在差异页确认', type: 'success' })
  router.replace('/receipt-diffs')
}

/** 「稍后处理」：差异单已在等确认，直接送去差异页（v0.4.7：此前停留本页无去向） */
function onDiffLater() {
  router.replace('/receipt-diffs')
}

onMounted(async () => {
  detail.value = await fetchReceiptDetail(route.params.no)
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
.unknown-btn {
  height: 34px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--wms-text-weak);
  border-color: #ebedf0;
  background: #f7f8fa;
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
  align-items: center;
  gap: 14px;
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
.line-box {
  margin-top: 8px;
}
.diff-tip {
  margin: 0 12px 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fffbe8;
  color: #ed6a0c;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.dialog-body {
  max-height: 46vh;
  overflow-y: auto;
  padding: 4px 0;
}
.diff-lines {
  padding: 8px 16px 0;
}
.diff-line {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  padding: 6px 0;
  border-bottom: 1px dashed #ebedf0;
}
</style>