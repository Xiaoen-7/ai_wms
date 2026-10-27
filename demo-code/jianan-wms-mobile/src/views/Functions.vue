<template>
  <div class="page">
    <!-- 主入口：扫码入库 -->
    <div class="hero" @click="router.push('/receipt-scan')">
      <div class="hero-icon">
        <van-icon name="scan" size="30" color="#fff" />
      </div>
      <div class="hero-text">
        <div class="hero-title">扫码入库</div>
        <div class="hero-desc">对准吊牌条码，核对数量即入库</div>
      </div>
      <van-icon name="arrow" class="hero-arrow" />
    </div>

    <!-- 其他功能 -->
    <div class="card">
      <div class="card-title"><span>全部功能</span></div>
      <div class="entry-grid">
        <div v-for="e in entries" :key="e.path" class="entry" @click="router.push(e.path)">
          <div class="entry-icon" :style="{ background: e.color }">
            <van-icon :name="e.icon" size="22" color="#fff" />
          </div>
          <div class="entry-name">{{ e.name }}</div>
          <div class="entry-desc">{{ e.desc }}</div>
        </div>
      </div>
    </div>

    <div class="sync-footer">本 Demo 为原型演示，数据全部来自 Mock</div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const entries = [
  { name: '收货单', desc: '按送货单核点', icon: 'OrdersO', color: '#1989fa', path: '/receipt' },
  { name: '扫码盘点', desc: '扫码累加 · 自动对账', icon: 'Records', color: '#07c160', path: '/stocktake' },
  { name: '实时库存', desc: '可售 / 在途 / 次品', icon: 'AppsO', color: '#ff976a', path: '/inventory' },
  { name: '调拨进度', desc: '全程状态 · 扫码收货', icon: 'Logistics', color: '#7232dd', path: '/transfer' },
  { name: '退换货', desc: '扫码验退 · 原单反查', icon: 'Exchange', color: '#ee0a24', path: '/returns' },
  { name: '次品登记', desc: '次品账 · 促销处理', icon: 'WarningO', color: '#ff644e', path: '/defective' }
]
</script>

<style scoped>
.hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 18px;
  margin-bottom: 12px;
  border-radius: var(--wms-radius);
  background: linear-gradient(135deg, #1989fa, #4fa5ff);
  box-shadow: 0 6px 16px rgba(25, 137, 250, 0.28);
  cursor: pointer;
}
.hero:active {
  opacity: 0.92;
}
.hero-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.hero-text {
  flex: 1;
}
.hero-title {
  font-size: 19px;
  font-weight: 700;
  color: #fff;
}
.hero-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  margin-top: 4px;
}
.hero-arrow {
  color: rgba(255, 255, 255, 0.9);
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
  width: 40px;
  height: 40px;
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