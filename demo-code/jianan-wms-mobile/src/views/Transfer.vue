<template>
  <div class="page">
    <!-- 筛选 -->
    <van-tabs v-model:active="direction" @change="load">
      <van-tab title="全部" name="all" />
      <van-tab title="我发起的" name="out" />
      <van-tab title="我接收的" name="in" />
    </van-tabs>

    <van-dropdown-menu active-color="#1989fa">
      <van-dropdown-item v-model="statusFilter" :options="statusOptions" @change="load" />
    </van-dropdown-menu>

    <!-- 调拨单列表 -->
    <div
      v-for="t in list"
      :key="t.transferNo"
      class="card transfer-card"
      @click="router.push(`/transfer/${t.transferNo}`)"
    >
      <div class="tc-head">
        <span class="tc-no">{{ t.transferNo }}</span>
        <van-tag :type="statusType(t.status)" size="medium" round>{{ t.status }}</van-tag>
      </div>

      <div class="tc-route">
        <span class="store">{{ t.fromStore }}</span>
        <van-icon name="arrow" color="#c8c9cc" />
        <span class="store">{{ t.toStore }}</span>
      </div>

      <div class="tc-meta">
        <van-tag :type="t.direction === 'out' ? 'primary' : 'success'" plain size="medium">
          {{ t.direction === 'out' ? '我发出' : '我接收' }}
        </van-tag>
        <span class="text-weak">{{ t.totalQty }} 件 · {{ t.createdAt }}</span>
      </div>

      <div v-if="t.expressNo" class="tc-express">
        <van-icon name="logistics" />
        {{ t.expressNo }}
      </div>

      <!-- 状态进度条（PRD 3.5 状态机） -->
      <div class="tc-steps">
        <div
          v-for="(s, i) in STEPS"
          :key="s"
          class="step"
          :class="{ done: stepIndex(t.status) >= i, current: stepIndex(t.status) === i }"
        >
          <div class="step-dot" />
          <div class="step-label">{{ s }}</div>
        </div>
      </div>
    </div>

    <van-empty v-if="!list.length && loaded" description="暂无调拨单" />

    <div class="sync-footer">全程状态与两端门店实时同步 · 无需电话确认单号</div>
  </div>
</template>

<script setup>
import { onActivated, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchTransfers } from '../mock/wms'

const router = useRouter()

const direction = ref('all')
const statusFilter = ref('all')
const list = ref([])
const loaded = ref(false)

// PRD 3.5 调拨在途状态机
const STEPS = ['已发起', '已发货', '在途', '已签收', '已入库']

const statusOptions = [
  { text: '全部状态', value: 'all' },
  { text: '已发起', value: '已发起' },
  { text: '已发货', value: '已发货' },
  { text: '在途', value: '在途' },
  { text: '已签收', value: '已签收' },
  { text: '已入库', value: '已入库' },
  { text: '差异挂账', value: '差异挂账' }
]

function statusType(s) {
  if (s === '已入库') return 'success'
  if (s === '差异挂账') return 'danger'
  if (s === '在途') return 'primary'
  if (s === '已签收') return 'warning'
  return 'default'
}

function stepIndex(status) {
  const i = STEPS.indexOf(status)
  // 待发货/已签收待点货等中间态归到对应节点
  if (status === '差异挂账') return 4
  return i < 0 ? 0 : i
}

async function load() {
  list.value = await fetchTransfers({ direction: direction.value, status: statusFilter.value })
  loaded.value = true
}

onMounted(load)
// Tab 页 keep-alive：激活时重拉，保证调拨收发货后列表状态联动刷新（v0.4.7）
onActivated(load)
</script>

<style scoped>
.transfer-card {
  cursor: pointer;
}
.transfer-card:active {
  background: #fafbfc;
}
.tc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tc-no {
  font-size: 16px;
  font-weight: 700;
}
.tc-route {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 14px;
}
.store {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tc-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}
.tc-express {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--wms-text-weak);
  margin-top: 8px;
}
.tc-steps {
  display: flex;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px dashed #ebedf0;
}
.step {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}
.step-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #dcdee0;
  position: relative;
  z-index: 1;
}
.step.done .step-dot {
  background: var(--wms-primary);
}
.step.current .step-dot {
  box-shadow: 0 0 0 4px rgba(25, 137, 250, 0.18);
}
.step-label {
  font-size: 11px;
  color: var(--wms-text-weak);
  margin-top: 6px;
}
.step.done .step-label {
  color: var(--wms-primary);
}
</style>