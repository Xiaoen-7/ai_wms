<template>
  <div class="page">
    <van-cell-group inset class="tip">
      <van-cell
        icon="info-o"
        title="扫描箱外条码，系统按条码识别箱内 SKU 与数量并对照送货单核点"
        :border="false"
        class="tip-cell"
      />
    </van-cell-group>

    <div v-for="r in list" :key="r.receiptNo" class="card receipt-card" @click="open(r.receiptNo)">
      <div class="row1">
        <span class="no">{{ r.receiptNo }}</span>
        <van-tag :type="statusType(r.status)" size="medium" round>{{ r.status }}</van-tag>
      </div>
      <div class="supplier">{{ r.supplier }}</div>
      <div class="row3">
        <span>应收 <b>{{ r.totalDocQty }}</b> 件 · 共 {{ r.boxCount }} 箱</span>
        <span class="text-weak">到货 {{ r.arriveAt }}</span>
      </div>
      <van-progress
        :percentage="Math.round((r.scannedBoxes / r.boxCount) * 100)"
        stroke-width="5"
        style="margin-top: 10px"
        :show-pivot="false"
      />
      <div class="text-weak" style="margin-top: 6px">
        已扫 {{ r.scannedBoxes }} / {{ r.boxCount }} 箱
      </div>
    </div>

    <van-empty v-if="!list.length && loaded" description="暂无待收货单" />

    <div class="sync-footer">对接送货单，扫码即用 · 无需手工录 Excel</div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchReceipts } from '../../mock/wms'

const router = useRouter()
const list = ref([])
const loaded = ref(false)

function statusType(s) {
  if (s === '已入库') return 'success'
  if (s === '有差异') return 'danger'
  return 'warning'
}

function open(no) {
  router.push(`/receipt/${no}`)
}

onMounted(async () => {
  list.value = await fetchReceipts()
  loaded.value = true
})
</script>

<style scoped>
.tip {
  margin: 0 0 12px;
}
.tip-cell {
  font-size: 13px;
  color: var(--wms-text-weak);
}
.receipt-card {
  cursor: pointer;
}
.receipt-card:active {
  background: #fafbfc;
}
.row1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.no {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.3px;
}
.supplier {
  font-size: 14px;
  margin-top: 8px;
}
.row3 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--wms-text);
  margin-top: 6px;
}
</style>