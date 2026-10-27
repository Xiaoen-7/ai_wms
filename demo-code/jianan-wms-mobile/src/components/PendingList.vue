<template>
  <div v-if="items.length" class="card pending">
    <div class="card-title">
      <span class="text-danger">未匹配商品主数据</span>
      <span class="text-weak">{{ openCount }} 条待处理</span>
    </div>

    <div
      v-for="p in items"
      :key="p.code"
      class="p-row"
      :class="{ done: PENDING_TERMINAL.includes(p.status) }"
      @click="onRow(p)"
    >
      <div class="p-main">
        <span class="p-code">{{ p.code }}</span>
        <span v-if="p.count > 1" class="p-times">×{{ p.count }}</span>
        <van-tag :type="tagType(p.status)" size="small">{{ p.status }}</van-tag>
      </div>
      <div class="p-side">
        <van-button
          v-if="p.status === '待核实'"
          size="mini"
          plain
          type="danger"
          @click.stop="onRow(p)"
        >
          处置 ›
        </van-button>
        <van-button
          v-else-if="p.status === '待补录'"
          size="mini"
          plain
          type="primary"
          @click.stop="advance(p)"
        >
          模拟已补录
        </van-button>
        <van-button
          v-else-if="p.status === '已补录'"
          size="mini"
          plain
          type="primary"
          @click.stop="advance(p)"
        >
          确认回补
        </van-button>
        <span v-else class="p-at">{{ p.at }}</span>
      </div>
    </div>

    <div class="p-note">
      按码去重、同码累加 ×N；店长核实处置（PRD 3.7），挂起超 48 小时未核实自动升级提醒总部
    </div>

    <van-action-sheet
      v-model:show="showActions"
      title="处置未匹配条码"
      :description="active ? `${active.code} · 已扫 ${active.count} 件` : ''"
      :actions="ACTIONS"
      cancel-text="取消"
      close-on-click-overlay
      @select="onSelect"
    />

    <!-- 分件处置（v0.4.8）：同码多件可只核其中几件，剩余件数留在原条目继续待核实 -->
    <van-dialog
      v-model:show="showQty"
      title="分件处置"
      show-cancel-button
      @confirm="confirmQty"
    >
      <div class="qty-body">
        <div class="text-weak qty-tip">
          该码共挂起 {{ active?.count }} 件，本次按「{{ pendingAction?.status }}」处置：
        </div>
        <van-stepper v-model="pendingQty" :min="1" :max="active?.count || 1" integer />
        <div class="text-weak qty-tip">未处置的件数留在原条目，继续待核实</div>
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { showToast } from 'vant'
import { countOpenPending, listPending, resolvePending, PENDING_TERMINAL } from '../mock/wms'

const items = ref([])
const showActions = ref(false)
const active = ref(null)
/** 分件处置（v0.4.8） */
const showQty = ref(false)
const pendingQty = ref(1)
const pendingAction = ref(null)

/** PRD 3.7 待核实 → 四选一处置出口 */
const ACTIONS = [
  { name: '吊牌挂错款，已换回正确吊牌', subname: '标记已纠正，重扫正常商品即可入库', status: '已纠正' },
  { name: '条码有效但主数据未建档', subname: '转待补录，提交总部商品岗补录', status: '待补录' },
  { name: '非本店商品 / 供应商错发', subname: '关闭条目并转收货差异流程（5.1.2）', status: '已关闭' },
  { name: '条码损坏，无法识别', subname: '作废并记录原因', status: '已作废' }
]

const openCount = computed(() => countOpenPending(items.value))

function tagType(s) {
  return (
    {
      待核实: 'danger',
      待补录: 'warning',
      已补录: 'primary',
      已纠正: 'success',
      已追认: 'success',
      已关闭: 'default',
      已作废: 'default'
    }[s] || 'default'
  )
}

/** 父页扫码后调用，刷新清单 */
function reload() {
  items.value = listPending()
}

function onRow(p) {
  if (p.status !== '待核实') return
  active.value = p
  showActions.value = true
}

function onSelect(action) {
  if (!active.value) return
  // v0.4.8 同码多件：先选本次处置件数（1 件直接走原流程）
  if (active.value.count > 1) {
    pendingAction.value = action
    pendingQty.value = 1
    showQty.value = true
    return
  }
  applyResolve(action, 1)
}

function confirmQty() {
  if (!active.value || !pendingAction.value) return
  applyResolve(pendingAction.value, pendingQty.value)
}

function applyResolve(action, qty) {
  const res = resolvePending(active.value.code, action.status, qty)
  showActions.value = false
  reload()
  const msg = res.remaining !== undefined
    ? `已处置 ${qty} 件 → ${action.status}；剩余 ${res.remaining} 件继续待核实`
    : `已处置：${action.name} → ${action.status}`
  showToast({ message: msg, position: 'bottom' })
}

/** 中间态推进（PRD 3.7：待补录 → 已补录 → 已追认，均为人工确认） */
function advance(p) {
  const next = p.status === '待补录' ? '已补录' : '已追认'
  resolvePending(p.code, next)
  reload()
  showToast({
    message:
      next === '已补录'
        ? '模拟总部已补录主数据，条目转「已补录」'
        : '已确认回补挂起时段的记录入账，条目关闭',
    position: 'bottom'
  })
}

onMounted(reload)
defineExpose({ reload })
</script>

<style scoped>
.pending {
  border: 1px solid #ffe1e1;
}
.p-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 0;
  border-bottom: 1px solid #f2f3f5;
}
.p-row:last-of-type {
  border-bottom: none;
}
.p-main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.p-code {
  font-family: 'DIN Alternate', Consolas, monospace;
  font-size: 14px;
  font-weight: 600;
}
.p-times {
  font-size: 13px;
  font-weight: 700;
  color: #ee0a24;
}
.p-row.done {
  opacity: 0.7;
}
.p-row.done .p-code {
  font-weight: 400;
  color: var(--wms-text-weak);
}
.p-side {
  flex-shrink: 0;
}
.p-at {
  font-size: 11px;
  color: var(--wms-text-weak);
}
.qty-body {
  padding: 16px;
  text-align: center;
}
.qty-tip {
  margin: 8px 0;
  font-size: 12px;
}
.p-note {
  margin-top: 8px;
  font-size: 12px;
  color: var(--wms-text-weak);
  line-height: 1.5;
}
</style>
