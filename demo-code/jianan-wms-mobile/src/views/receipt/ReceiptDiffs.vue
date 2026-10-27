<template>
  <div class="page">
    <div class="page-head">
      <div class="page-title">收货差异</div>
      <div class="text-weak">实点 ≠ 送货单的单据在此挂账，与供应商核实后确认</div>
    </div>

    <van-empty
      v-if="!list.length"
      image-size="80"
      description="暂无差异单——全部按送货单如数入库"
    />

    <div v-for="d in list" :key="d.diffNo" class="card diff-card">
      <div class="diff-head">
        <div>
          <div class="diff-no">{{ d.diffNo }}</div>
          <div class="text-weak diff-meta">
            {{ d.supplier }} · {{ d.source || '收货单核点' }}<template v-if="d.receiptNo && d.receiptNo !== '-'">
              · 单据 {{ d.receiptNo }}</template
            >
          </div>
        </div>
        <van-tag :type="d.status === '待确认' ? 'warning' : 'success'" size="medium" round>
          {{ d.status }}
        </van-tag>
      </div>

      <div v-for="(l, i) in d.lines" :key="i" class="diff-line">
        <div>
          <div class="line-name">{{ l.name }}</div>
          <div class="text-weak line-sku">{{ l.code }} / 送货单 {{ l.docQty }} 件 · 实点 {{ l.actualQty }} 件</div>
        </div>
        <div class="line-diff" :class="l.diffQty < 0 ? 'text-danger' : 'text-success'">
          {{ l.diffQty > 0 ? '+' : '' }}{{ l.diffQty }} 件
        </div>
      </div>

      <div class="diff-foot">
        <span class="text-weak">{{ d.createdAt }}<template v-if="d.confirmedAt"> · 确认于 {{ d.confirmedAt }}</template></span>
        <van-button
          v-if="d.status === '待确认'"
          size="small"
          type="primary"
          round
          :loading="confirming === d.diffNo"
          @click="onConfirm(d.diffNo)"
        >
          确认差异
        </van-button>
      </div>
    </div>

    <div class="sync-footer" v-if="list.length">差异按实点入库后的差额生成 · 本 Demo 数据为 Mock</div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { showToast } from 'vant'
import { fetchReceiveDiffs, confirmReceiveDiff } from '../../mock/wms'

const list = ref([])
const confirming = ref('')

async function reload() {
  list.value = await fetchReceiveDiffs()
}

async function onConfirm(diffNo) {
  confirming.value = diffNo
  try {
    await confirmReceiveDiff(diffNo)
    showToast({ message: '差异已确认，挂账留痕', type: 'success' })
    await reload()
  } catch (e) {
    showToast(e.message || '确认失败')
  } finally {
    confirming.value = ''
  }
}

onMounted(reload)
</script>

<style scoped>
.page-head {
  padding: 4px 2px 10px;
}
.page-title {
  font-size: 19px;
  font-weight: 700;
}
.diff-card {
  margin-bottom: 12px;
}
.diff-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;
}
.diff-no {
  font-size: 15px;
  font-weight: 700;
}
.diff-meta {
  font-size: 12px;
  margin-top: 3px;
}
.diff-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: #f7f8fa;
  border-radius: 8px;
  padding: 9px 11px;
  margin-bottom: 6px;
}
.line-name {
  font-size: 14px;
  font-weight: 600;
}
.line-sku {
  font-size: 12px;
  margin-top: 2px;
}
.line-diff {
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
}
.diff-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 12px;
}
</style>
