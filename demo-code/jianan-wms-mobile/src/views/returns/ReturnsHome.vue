<template>
  <div class="page">
    <!-- 主入口：扫码验退 -->
    <div class="hero" @click="router.push('/returns/scan')">
      <div class="hero-icon">
        <van-icon name="exchange" size="30" color="#fff" />
      </div>
      <div class="hero-text">
        <div class="hero-title">扫码验退</div>
        <div class="hero-desc">扫吊牌条码，反查原销售单，验后入回库存</div>
      </div>
      <van-icon name="arrow" class="hero-arrow" />
    </div>

    <!-- 待复核清单（PRD 5.6.1：独立入口与角标提醒） -->
    <div class="card review-entry" @click="router.push('/returns/review')">
      <div class="review-left">
        <van-icon name="clock-o" size="20" color="#ff976a" />
        <span class="review-title">待复核清单</span>
        <span class="text-weak">人工录入的退货，补原单后解除</span>
      </div>
      <van-badge v-if="reviewCount > 0" :content="reviewCount" />
      <van-icon v-else name="arrow" class="text-weak" />
    </div>

    <!-- 今日退货记录 -->
    <div class="card">
      <div class="card-title"><span>今日退货记录</span></div>
      <div v-for="r in logs" :key="r.id" class="log-item">
        <div class="log-row1">
          <span class="log-no">{{ r.id }}</span>
          <van-tag :type="logTagType(r)" size="medium" round>{{ logResult(r) }}</van-tag>
        </div>
        <div class="log-goods">{{ r.name }} {{ r.color }}/{{ r.size }} × {{ r.qty }}</div>
        <div class="text-weak">
          <template v-if="r.saleNo">原单 {{ r.saleNo }}</template>
          <template v-else>人工录入（待复核）</template>
          <template v-if="r.exchangeSku"> · 换出 {{ exchangeLabel(r.exchangeSku) }}</template>
          · {{ r.at }}
        </div>
      </div>
      <van-empty v-if="!logs.length" description="今天还没有退货记录，扫一件试试" />
    </div>

    <div class="sync-footer">退货扫码反查原销售单 · 差异有据可查</div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchReturnLogs, countOpenReview, findProductBySku } from '../../mock/wms'

const router = useRouter()
const logs = ref([])
const reviewCount = ref(0)

function logResult(r) {
  if (r.manual) return '人工录入'
  if (r.exchangeSku) return '换货'
  return r.tagOk ? '入回原库存' : '归次品'
}

function logTagType(r) {
  if (r.manual) return 'warning'
  if (r.exchangeSku) return 'primary'
  return r.tagOk ? 'success' : 'danger'
}

function exchangeLabel(sku) {
  const p = findProductBySku(sku)
  return p ? `${p.name} ${p.color}/${p.size}` : sku
}

onMounted(async () => {
  logs.value = await fetchReturnLogs()
  reviewCount.value = countOpenReview()
})
</script>

<style scoped>
.hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 18px;
  margin-bottom: 12px;
  border-radius: var(--wms-radius);
  background: linear-gradient(135deg, #ee0a24, #ff644e);
  box-shadow: 0 6px 16px rgba(238, 10, 36, 0.24);
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

.review-entry,
.defective-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}
.review-entry:active,
.defective-entry:active {
  background: #fafbfc;
}
.review-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.review-title {
  font-size: 15px;
  font-weight: 600;
}

.log-item {
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}
.log-item:last-of-type {
  border-bottom: none;
}
.log-row1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.log-no {
  font-size: 13px;
  font-weight: 600;
}
.log-goods {
  font-size: 14px;
  margin-bottom: 2px;
}
</style>
