<template>
  <div class="page">
    <!-- 搜索栏（PRD 5.3.1：货号/SKU/关键字） -->
    <van-search
      v-model="keyword"
      placeholder="搜索货号 / SKU / 品名 / 颜色"
      show-action
      @search="load"
      @clear="load"
    >
      <template #action>
        <span @click="load">搜索</span>
      </template>
    </van-search>

    <!-- 分类页签（PRD 5.3.2 + 8.1.1 四科目） -->
    <van-tabs v-model:active="activeTab" sticky offset-top="46" @change="load">
      <van-tab title="全部" name="all" />
      <van-tab title="可售" name="sellable" />
      <van-tab title="在途" name="inTransit" />
      <van-tab title="次品" name="defective" />
      <van-tab title="挂账" name="holding" />
    </van-tabs>

    <!-- 汇总头（四科目，PRD v2.2 8.1.1） -->
    <div class="summary">
      <div class="sum-item">
        <div class="sum-num">{{ summary.sellable }}</div>
        <div class="sum-label">可售</div>
      </div>
      <div class="sum-item">
        <div class="sum-num" style="color: #ff976a">{{ summary.inTransit }}</div>
        <div class="sum-label">在途</div>
      </div>
      <div class="sum-item">
        <div class="sum-num" style="color: #ee0a24">{{ summary.defective }}</div>
        <div class="sum-label">次品</div>
      </div>
      <div class="sum-item">
        <div class="sum-num" style="color: #969799">{{ summary.holding }}</div>
        <div class="sum-label">挂账</div>
      </div>
    </div>

    <!-- 库存列表 -->
    <div v-if="list.length" class="card list-card">
      <div v-for="item in list" :key="item.sku" class="inv-row">
        <div class="inv-main">
          <div class="inv-name">{{ item.name }}</div>
          <div class="inv-sku">{{ item.code }} / {{ item.color }} / {{ item.size }}</div>
          <div class="inv-sku">SKU {{ item.sku }} · ¥{{ item.price }}</div>
        </div>
        <div class="inv-qty">
          <div class="qty-block">
            <span class="qty-num" :class="{ zero: item.sellable === 0 }">{{ item.sellable }}</span>
            <span class="qty-tag">可售</span>
          </div>
          <div v-if="item.inTransit > 0" class="qty-block">
            <span class="qty-num" style="color: #ff976a">{{ item.inTransit }}</span>
            <span class="qty-tag">在途</span>
          </div>
          <div v-if="item.defective > 0" class="qty-block">
            <span class="qty-num" style="color: #ee0a24">{{ item.defective }}</span>
            <span class="qty-tag">次品</span>
          </div>
          <div v-if="item.holding > 0" class="qty-block">
            <span class="qty-num" style="color: #969799">{{ item.holding }}</span>
            <span class="qty-tag">挂账</span>
          </div>
        </div>
      </div>
    </div>

    <van-empty v-else-if="loaded" description="未找到该货号，请检查后重试" />

    <div class="sync-footer">
      库存数据截至 {{ syncedAt }} · 来源：门店本地账
      <div style="margin-top: 4px">断网时展示最后已知数并标注截止时间，不冒充实时</div>
    </div>
  </div>
</template>

<script setup>
import { onActivated, onMounted, ref } from 'vue'
import { fetchInventory } from '../mock/wms'

const keyword = ref('')
const activeTab = ref('all')
const list = ref([])
const syncedAt = ref('--:--')
const loaded = ref(false)
const summary = ref({ sellable: 0, inTransit: 0, defective: 0, holding: 0 })

async function load() {
  const res = await fetchInventory({ keyword: keyword.value, status: activeTab.value })
  list.value = res.list
  syncedAt.value = res.syncedAt
  summary.value = res.summary
  loaded.value = true
}

onMounted(load)
// Tab 页 keep-alive：激活时重拉，保证入库/盘点落账后四科目联动刷新（v0.4.7）
onActivated(load)
</script>

<style scoped>
.summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  text-align: center;
  background: #fff;
  padding: 12px 0;
  margin-bottom: 12px;
}
.sum-num {
  font-size: 22px;
  font-weight: 700;
  color: var(--wms-success);
}
.sum-label {
  font-size: 12px;
  color: var(--wms-text-weak);
  margin-top: 2px;
}

.list-card {
  padding: 4px 14px;
}
.inv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f2f3f5;
}
.inv-row:last-child {
  border-bottom: none;
}
.inv-main {
  flex: 1;
  min-width: 0;
}
.inv-name {
  font-size: 15px;
  font-weight: 600;
}
.inv-sku {
  font-size: 12px;
  color: var(--wms-text-weak);
  margin-top: 3px;
}
.inv-qty {
  display: flex;
  gap: 14px;
  text-align: center;
}
.qty-block {
  display: flex;
  flex-direction: column;
  min-width: 38px;
}
.qty-num {
  font-size: 19px;
  font-weight: 700;
  color: var(--wms-success);
}
.qty-num.zero {
  color: #c8c9cc;
}
.qty-tag {
  font-size: 11px;
  color: var(--wms-text-weak);
}
</style>