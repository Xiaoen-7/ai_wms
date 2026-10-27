<template>
  <div class="page">
    <van-cell-group inset class="tip">
      <van-cell
        icon="info-o"
        title="人工录入的退货没有原单背书，先入账、后核实——24 小时内补到原单即可解除标记"
        :border="false"
        class="tip-cell"
      />
    </van-cell-group>

    <van-tabs v-model:active="activeTab" sticky>
      <van-tab title="待复核" :badge="openCount || ''">
        <div v-for="r in openList" :key="r.id" class="card">
          <div class="row1">
            <span class="no">{{ r.id }}</span>
            <van-tag type="warning" size="medium" round>{{ r.status }}</van-tag>
          </div>
          <div class="goods">{{ goodsLabel(r.sku) }} × {{ r.qty }}</div>
          <div class="text-weak">登记时间 {{ r.at }} · {{ r.reason }}</div>
          <van-button
            size="small"
            type="primary"
            plain
            style="margin-top: 8px"
            @click="onResolve(r)"
          >
            补录原单，解除标记
          </van-button>
        </div>
        <van-empty v-if="!openList.length" description="没有待复核条目" />
      </van-tab>

      <van-tab title="已复核">
        <div v-for="r in doneList" :key="r.id" class="card">
          <div class="row1">
            <span class="no">{{ r.id }}</span>
            <van-tag type="success" size="medium" round>{{ r.status }}</van-tag>
          </div>
          <div class="goods">{{ goodsLabel(r.sku) }} × {{ r.qty }}</div>
          <div class="text-weak">
            已补原单 {{ r.resolvedSaleNo }} · {{ r.resolvedAt }}
          </div>
        </div>
        <van-empty v-if="!doneList.length" description="还没有已复核记录" />
      </van-tab>
    </van-tabs>

    <div class="sync-footer">查无原单不拦账，但必须留复核痕迹 · 数据可追溯</div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { showConfirmDialog, showToast } from 'vant'
import { fetchReviewList, resolveReview, findProductBySku } from '../../mock/wms'

const activeTab = ref(0)
const list = ref([])

const openList = computed(() => list.value.filter((r) => r.status === '待复核'))
const doneList = computed(() => list.value.filter((r) => r.status === '已复核'))
const openCount = computed(() => openList.value.length)

function goodsLabel(sku) {
  const p = findProductBySku(sku)
  return p ? `${p.name} ${p.color}/${p.size}` : sku
}

async function onResolve(r) {
  try {
    const res = await showConfirmDialog({
      title: '补录原单号',
      messageAlign: 'left',
      message: `为 ${r.id}（${goodsLabel(r.sku)} × ${r.qty}）补录原销售单号后，将解除待复核标记。`,
      showCancelButton: true
    })
    if (res !== 'confirm') return
  } catch {
    return
  }
  // Vant confirm 不带输入框，用 prompt 式二次弹层：直接用原生输入简化演示
  const saleNo = window.prompt('请输入原销售单号（如 XS202610210077）')
  if (!saleNo) return
  try {
    await resolveReview(r.id, saleNo)
    list.value = fetchReviewList()
    showToast('已补原单，解除待复核标记')
  } catch (e) {
    showToast(e.message || '操作失败')
  }
}

onMounted(() => {
  list.value = fetchReviewList()
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
.row1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.no {
  font-size: 13px;
  font-weight: 600;
}
.goods {
  font-size: 15px;
  margin-bottom: 2px;
}
</style>
