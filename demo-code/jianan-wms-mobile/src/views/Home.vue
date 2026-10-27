<template>
  <div class="page">
    <!-- 门店头 -->
    <div class="store-head">
      <div>
        <div class="store-name">{{ overview.store.name }}</div>
        <div class="store-sub">店长 {{ overview.store.manager }} · 数据 {{ overview.syncedAt }}</div>
      </div>
      <van-tag :type="online ? 'success' : 'warning'" round size="medium">
        {{ online ? '实时同步' : '离线待同步' }}
      </van-tag>
    </div>

    <!-- 待办 -->
    <div class="card">
      <div class="card-title">
        <span>今日待办</span>
        <span class="text-weak">共 {{ todoTotal }} 项</span>
      </div>
      <div class="todo-grid">
        <div class="todo-item" @click="router.push('/receipt')">
          <div class="todo-num">{{ overview.todos.receipt }}</div>
          <div class="todo-label">待收货</div>
        </div>
        <div class="todo-item" @click="router.push('/stocktake')">
          <div class="todo-num">{{ overview.todos.stocktake }}</div>
          <div class="todo-label">待盘点</div>
        </div>
        <div class="todo-item" @click="router.push('/transfer')">
          <div class="todo-num">{{ overview.todos.transfer }}</div>
          <div class="todo-label">在途调拨</div>
        </div>
        <div class="todo-item" @click="router.push('/receipt-diffs')">
          <div class="todo-num" :class="{ 'text-danger': overview.todos.diff > 0 }">
            {{ overview.todos.diff }}
          </div>
          <div class="todo-label">待确认差异</div>
        </div>
        <div class="todo-item" @click="router.push('/returns/review')">
          <div class="todo-num" :class="{ 'todo-num-warn': overview.todos.review > 0 }">
            {{ overview.todos.review }}
          </div>
          <div class="todo-label">退货待复核</div>
        </div>
        <div class="todo-item" @click="router.push('/defective')">
          <div class="todo-num" :class="{ 'text-danger': overview.todos.defective > 0 }">
            {{ overview.todos.defective }}
          </div>
          <div class="todo-label">次品待处理</div>
        </div>
      </div>
    </div>

    <!-- 四大功能入口 -->
    <div class="card">
      <div class="card-title"><span>核心功能</span></div>
      <div class="entry-grid">
        <div v-for="e in entries" :key="e.path" class="entry" @click="router.push(e.path)">
          <div class="entry-icon" :style="{ background: e.color }">
            <van-icon :name="e.icon" size="24" color="#fff" />
          </div>
          <div class="entry-name">{{ e.name }}</div>
          <div class="entry-desc">{{ e.desc }}</div>
        </div>
      </div>
    </div>

    <!-- 今日概况 -->
    <div class="card">
      <div class="card-title"><span>今日概况</span></div>
      <van-cell title="今日入库" :value="`${overview.today.inbound} 件`" />
      <van-cell title="今日出库" :value="`${overview.today.outbound} 件`" />
      <van-cell
        title="今日退货"
        is-link
        :to="'/returns'"
        :value="`${overview.today.returns || 0} 件`"
      />
      <van-cell title="盘点进度">
        <template #value>
          <span>{{ overview.today.stocktakeProgress }} / {{ overview.today.stocktakeTotal }} SKU</span>
        </template>
      </van-cell>
      <van-progress
        :percentage="Math.round((overview.today.stocktakeProgress / overview.today.stocktakeTotal) * 100)"
        stroke-width="6"
        style="margin-top: 10px"
      />
    </div>

    <!-- 提醒 -->
    <div class="card">
      <div class="card-title"><span>异常提醒</span></div>
      <van-notice-bar
        v-for="(w, i) in overview.warnings"
        :key="i"
        :text="w.text"
        :color="w.level === 'warning' ? '#ed6a0c' : '#1989fa'"
        :background="w.level === 'warning' ? '#fffbe8' : '#ecf9ff'"
        :left-icon="w.level === 'warning' ? 'warning-o' : 'info-o'"
        style="margin-bottom: 8px; border-radius: 8px"
      />
    </div>

    <div class="sync-footer">库存数据截止 {{ overview.syncedAt }} · 本 Demo 数据为 Mock</div>
  </div>
</template>

<script setup>
import { computed, onActivated, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchHomeOverview } from '../mock/wms'

const router = useRouter()
const online = ref(true)

const overview = ref({
  store: { name: '简岸·旗舰店', manager: '张姐' },
  syncedAt: '--:--',
  todos: { receipt: 0, transfer: 0, stocktake: 0, diff: 0, review: 0, defective: 0 },
  today: { inbound: 0, outbound: 0, returns: 0, stocktakeProgress: 0, stocktakeTotal: 0 },
  warnings: []
})

const todoTotal = computed(() => {
  const t = overview.value.todos
  return t.receipt + t.transfer + t.stocktake + t.diff + t.review + (t.defective > 0 ? 1 : 0)
})

const entries = [
  { name: '扫码入库', desc: '箱码识别 · 差异入库', icon: 'Scan', color: '#1989fa', path: '/receipt' },
  { name: '扫码盘点', desc: '扫码累加 · 自动对账', icon: 'Records', color: '#07c160', path: '/stocktake' },
  { name: '实时库存', desc: '可售 / 在途 / 次品', icon: 'AppsO', color: '#ff976a', path: '/inventory' },
  { name: '调拨进度', desc: '全程状态 · 扫码收货', icon: 'Logistics', color: '#7232dd', path: '/transfer' }
]

async function loadOverview() {
  overview.value = await fetchHomeOverview()
}
onMounted(loadOverview)
// Tab 页被 keep-alive 缓存：激活时重拉数据，保证入库/差异/盘点落账后待办联动刷新（v0.4.7）
onActivated(loadOverview)
</script>

<style scoped>
.store-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 14px;
}
.store-name {
  font-size: 19px;
  font-weight: 700;
}
.store-sub {
  font-size: 12px;
  color: var(--wms-text-weak);
  margin-top: 4px;
}

.todo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.todo-item {
  text-align: center;
  padding: 10px 4px;
  border-radius: 8px;
  background: #f7f8fa;
  cursor: pointer;
}
.todo-item:active {
  background: #eef0f3;
}
.todo-num {
  font-size: 22px;
  font-weight: 700;
  color: var(--wms-primary);
  line-height: 1.2;
}
.todo-label {
  font-size: 12px;
  color: var(--wms-text-weak);
  margin-top: 4px;
}
.todo-num-warn {
  color: var(--wms-danger);
}

.entry-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.entry {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 14px;
  border-radius: 10px;
  background: #f7f8fa;
  cursor: pointer;
}
.entry:active {
  background: #eef0f3;
}
.entry-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}
.entry-name {
  font-size: 15px;
  font-weight: 600;
}
.entry-desc {
  font-size: 12px;
  color: var(--wms-text-weak);
  margin-top: 3px;
}
</style>