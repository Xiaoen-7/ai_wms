<template>
  <div class="page">
    <!-- 扫码主按钮 -->
    <div class="card scan-card">
      <div class="scan-actions">
        <van-button
          class="big-btn scan-btn"
          type="primary"
          icon="scan"
          block
          :loading="scanning"
          loading-text="扫码识别中…"
          @click="onScan"
        >
          {{ scanned ? '继续扫码' : '扫码入库' }}
        </van-button>
        <van-button
          class="unknown-btn"
          size="small"
          plain
          block
          :loading="scanningUnknown"
          @click="onScanUnknown"
        >
          扫一条未登记条码（演示）
        </van-button>
      </div>
      <div class="scan-tip">
        <van-icon name="info-o" />
        散件补录：适用于无送货单的零散入库（退换货回仓、样品回收等）；成箱到货请走「收货单」按单核点
      </div>
    </div>

    <!-- 未登记条码挂起（PRD 5.1.1：不静默丢弃；PRD 3.7 处置状态机，与盘点页共享清单） -->
    <PendingList ref="pendingListRef" />

    <!-- 商品卡片：扫码命中后弹出 -->
    <van-popup
      v-model:show="showCard"
      round
      position="bottom"
      :style="{ paddingBottom: '10px' }"
      @closed="onCardClosed"
    >
      <div class="sheet">
        <div class="sheet-head">
          <span class="sheet-title">扫码结果</span>
          <van-tag type="warning" size="medium" round>待核对</van-tag>
        </div>

        <div v-if="current" class="goods">
          <div class="goods-name">{{ current.name }}</div>
          <div class="goods-attrs">
            <van-tag plain type="primary" size="medium">{{ current.color }}</van-tag>
            <van-tag plain type="primary" size="medium">{{ current.size }} 码</van-tag>
          </div>
          <van-cell title="SKU 编码" :value="current.sku" :border="false" class="sku-cell" />
          <div class="goods-qty">
            <div class="qty-block">
              <div class="qty-label">送货单应收</div>
              <div class="qty-doc">{{ current.docQty }} <span>件</span></div>
            </div>
            <div class="qty-block right">
              <div class="qty-label">本次实收</div>
              <van-stepper
                v-model="qty"
                :min="1"
                :max="current.docQty * 2"
                integer
                input-width="52px"
                button-size="32px"
                @change="onQtyChange"
              />
            </div>
          </div>
        </div>

        <div class="sheet-footer">
          <van-button
            class="big-btn"
            type="primary"
            block
            :loading="submitting"
            @click="onConfirm"
          >
            确认入库
          </van-button>
        </div>
      </div>
    </van-popup>

    <!-- 今日入库列表 -->
    <div class="card">
      <div class="card-title">
        <span>今日入库</span>
        <span class="text-weak">共 {{ logs.length }} 单 · {{ totalQty }} 件</span>
      </div>

      <div v-for="log in logs" :key="log.id" class="log-row">
        <div class="log-main">
          <div class="log-name">{{ log.name }}</div>
          <div class="log-sub">{{ log.sku }}</div>
          <div class="log-sub">{{ log.color }} / {{ log.size }} 码</div>
        </div>
        <div class="log-right">
          <div class="log-qty">+{{ log.qty }}</div>
          <div class="log-sub">{{ log.at }}</div>
        </div>
      </div>

      <van-empty v-if="!logs.length" image-size="72" description="今日还没有入库记录" />
    </div>

    <div class="sync-footer">扫码即入库，库存实时同步 · 本 Demo 数据为 Mock</div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { showToast } from 'vant'
import PendingList from '../../components/PendingList.vue'
import {
  confirmScanInbound,
  fetchScanInboundLogs,
  listPending,
  scanInbound,
  scanUnknownInbound,
  addPending
} from '../../mock/wms'

const scanning = ref(false)
const scanningUnknown = ref(false)
const submitting = ref(false)
const showCard = ref(false)
const scanned = ref(false)
const current = ref(null)
const qty = ref(1)
const logs = ref([])
/** 未匹配条码清单组件（PRD 3.7，与盘点页共享同一份数据） */
const pendingListRef = ref(null)

const totalQty = computed(() => logs.value.reduce((s, l) => s + l.qty, 0))

/** 模拟扫码：随机命中一条到货 SKU，弹出商品卡片 */
async function onScan() {
  if (scanningUnknown.value) return
  scanning.value = true
  try {
    current.value = await scanInbound()
    qty.value = current.value.docQty
    showCard.value = true
    scanned.value = true
    // PRD 3.7 规则 1：同码曾挂起时关联提示（不自动追认，仍由店长在清单中确认）
    const hit = listPending().find((p) => p.code === current.value.code)
    if (hit) {
      showToast({ message: `该条码曾于 ${hit.at} 挂起（${hit.status}），请到待处理清单核实`, position: 'bottom' })
    }
  } catch (e) {
    showToast(e.message || '扫码失败，请重试')
  } finally {
    scanning.value = false
  }
}

/** 模拟扫到未登记条码（吊牌挂错款等），挂入待处理清单而非静默丢弃 */
async function onScanUnknown() {
  if (scanning.value || scanningUnknown.value) return
  scanningUnknown.value = true
  try {
    const { code } = await scanUnknownInbound()
    const { item, dup } = addPending(code)
    pendingListRef.value?.reload()
    showToast({
      message: dup
        ? `同一未登记码再次命中：${code}，已累加 ×${item.count}`
        : `未匹配商品主数据：${code}，已挂入待处理`,
      position: 'bottom'
    })
  } catch (e) {
    showToast(e.message || '扫码失败，请重试')
  } finally {
    scanningUnknown.value = false
  }
}

/** 实收与应收不一致时提前提示，避免店员误入 */
function onQtyChange(v) {
  if (!current.value) return
  if (Number(v) !== current.value.docQty) {
    showToast({
      message: `实收 ${v} 件与送货单应收 ${current.value.docQty} 件不符`,
      position: 'bottom'
    })
  }
}

async function onConfirm() {
  if (!current.value) return
  submitting.value = true
  try {
    const log = await confirmScanInbound({ sku: current.value.sku, qty: qty.value })
    showCard.value = false
    showToast({
      message: log.diffNo ? `入库成功，差额已生成差异单 ${log.diffNo}` : '入库成功',
      type: 'success'
    })
    logs.value.unshift(log)
  } catch (e) {
    showToast(e.message || '入库失败')
  } finally {
    submitting.value = false
  }
}

function onCardClosed() {
  current.value = null
}

onMounted(async () => {
  logs.value = await fetchScanInboundLogs()
})
</script>

<style scoped>
.scan-card {
  padding: 16px 14px 12px;
}
.scan-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.unknown-btn {
  height: 34px;
  font-size: 12px;
  color: var(--wms-text-weak);
  border-color: #ebedf0;
  background: #f7f8fa;
}
.scan-btn {
  background: linear-gradient(135deg, #1989fa, #4fa5ff) !important;
  border: none !important;
  box-shadow: 0 6px 16px rgba(25, 137, 250, 0.28);
}
.scan-tip {
  display: flex;
  align-items: center;
  gap: 5px;
  justify-content: center;
  margin-top: 10px;
  font-size: 12px;
  color: var(--wms-text-weak);
  line-height: 1.4;
}

/* 商品卡片 */
.sheet {
  padding: 18px 16px 12px;
}
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.sheet-title {
  font-size: 17px;
  font-weight: 700;
}
.goods {
  border-radius: var(--wms-radius);
  background: #f7f8fa;
  padding: 14px;
}
.goods-name {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
}
.goods-attrs {
  display: flex;
  gap: 8px;
  margin: 10px 0 6px;
}
.sku-cell {
  padding: 4px 0 10px;
  font-size: 13px;
  color: var(--wms-text-weak);
  background: transparent;
}
.sku-cell :deep(.van-cell__value) {
  color: var(--wms-text);
  font-size: 13px;
}
.goods-qty {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  border-top: 1px dashed #ebedf0;
  padding-top: 12px;
}
.qty-block.right {
  text-align: right;
}
.qty-label {
  font-size: 12px;
  color: var(--wms-text-weak);
  margin-bottom: 6px;
}
.qty-doc {
  font-size: 26px;
  font-weight: 700;
  color: var(--wms-primary);
  line-height: 1.1;
}
.qty-doc span {
  font-size: 13px;
  font-weight: 400;
  color: var(--wms-text-weak);
}
.sheet-footer {
  margin-top: 16px;
}

/* 今日入库列表 */
.log-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 0;
  border-bottom: 1px solid #f2f3f5;
}
.log-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.log-name {
  font-size: 15px;
  font-weight: 600;
}
.log-sub {
  font-size: 12px;
  color: var(--wms-text-weak);
  margin-top: 3px;
}
.log-right {
  text-align: right;
  flex-shrink: 0;
}
.log-qty {
  font-size: 19px;
  font-weight: 700;
  color: var(--wms-success);
}
</style>