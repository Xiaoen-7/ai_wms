<template>
  <div class="page" v-if="result">
    <!-- 概览 -->
    <div class="card summary">
      <div class="sum-item">
        <div class="sum-num">{{ result.diffCount }}</div>
        <div class="sum-label">差异 SKU</div>
      </div>
      <div class="sum-item">
        <div class="sum-num text-danger">{{ result.lossQty }}</div>
        <div class="sum-label">盘亏件数</div>
      </div>
      <div class="sum-item">
        <div class="sum-num text-success">+{{ result.gainQty }}</div>
        <div class="sum-label">盘盈件数</div>
      </div>
      <div class="sum-item">
        <div class="sum-num">{{ checkedRate }}%</div>
        <div class="sum-label">盘点覆盖率</div>
      </div>
    </div>

    <div class="text-weak" style="text-align: center; margin-bottom: 12px">
      {{ result.taskNo }} · 完成于 {{ result.finishedAt }}
    </div>

    <!-- 未盘提示（v0.3.1：未盘 ≠ 盘亏，不计入差异） -->
    <div v-if="result.uncheckedSku" class="unchecked-tip">
      <van-icon name="info-o" />
      有 {{ result.uncheckedSku }} 个 SKU 未盘，未计入差异；如需完整对账请「驳回重盘」
    </div>

    <!-- 盘平 -->
    <div v-if="!result.diffCount" class="card">
      <van-empty description="盘平，无差异">
        <template #image>
          <van-icon name="checked" size="72" color="#07c160" />
        </template>
        <van-button round type="primary" size="small" @click="router.replace('/stocktake')">
          返回盘点
        </van-button>
      </van-empty>
    </div>

    <!-- 差异明细 + 归因（PRD 5.2.2） -->
    <template v-else>
      <div class="card">
        <div class="card-title">
          <span>账面 vs 实盘</span>
          <span class="text-weak">仅显示差异行</span>
        </div>

        <div class="guide-tip">
          <van-icon name="info-o" />
          下方归因由系统自动分析，供店长参考：认可结论就点「确认差异」落账修正；不认可点「驳回重盘」重新扫
        </div>

        <div v-for="l in result.lines" :key="l.sku" class="diff-card">
          <div class="diff-head">
            <span class="diff-name">{{ l.name }}</span>
            <span :class="l.diffQty < 0 ? 'text-danger' : 'text-success'">
              {{ l.diffQty > 0 ? '盘盈 +' : '盘亏 ' }}{{ l.diffQty }}
            </span>
          </div>
          <div class="diff-sku">{{ l.code }} / {{ l.color }} / {{ l.size }}</div>

          <div class="qty-compare">
            <div class="qc">
              <span class="qc-label">账面</span>
              <span class="qc-val">{{ l.bookQty }}</span>
            </div>
            <van-icon name="arrow" color="#c8c9cc" />
            <div class="qc">
              <span class="qc-label">实盘</span>
              <span class="qc-val">{{ l.actualQty }}</span>
            </div>
            <div class="qc">
              <span class="qc-label">差异</span>
              <span class="qc-val" :class="l.diffQty < 0 ? 'text-danger' : 'text-success'">
                {{ l.diffQty > 0 ? '+' : '' }}{{ l.diffQty }}
              </span>
            </div>
          </div>

          <!-- 人话结论常驻；规则/证据/置信度默认折叠（店员看结论，分析依据按需展开） -->
          <div v-if="l.diffQty !== 0" class="plain-line" :class="l.diffQty < 0 ? 'text-danger' : 'text-success'">
            {{ plainConclusion(l) }}
          </div>
          <template v-if="l.attribution">
            <div v-if="expandedAttr[l.sku]" class="attr">
              <div class="attr-head">
                <van-tag type="warning" size="medium">{{ l.attribution.rule }}</van-tag>
                <span class="attr-conclusion">{{ l.attribution.conclusion }}</span>
              </div>
              <div class="attr-evidence">
                <van-icon name="records-o" />
                证据链：{{ l.attribution.evidence.join('；') }}
              </div>
              <div class="attr-conf">
                <span class="text-weak">置信度</span>
                <van-progress
                  :percentage="Math.round(l.attribution.confidence * 100)"
                  stroke-width="5"
                  :show-pivot="false"
                  color="#ff976a"
                  style="flex: 1; margin-left: 8px"
                />
                <span class="conf-num">{{ Math.round(l.attribution.confidence * 100) }}%</span>
              </div>
            </div>
            <div class="attr-toggle" @click="toggleAttr(l.sku)">
              {{ expandedAttr[l.sku] ? '收起归因依据' : '查看归因依据（规则 / 证据 / 置信度）' }}
              <van-icon :name="expandedAttr[l.sku] ? 'arrow-up' : 'arrow-down'" />
            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- 全部 SKU 明细（可展开） -->
    <div class="card">
      <van-collapse v-model="activeNames">
        <van-collapse-item title="查看全部 SKU 对账明细" :name="1">
          <div v-for="l in result.allLines" :key="l.sku" class="all-row">
            <div>
              <div class="all-name">{{ l.name }}</div>
              <div class="text-weak">{{ l.code }} / {{ l.color }} / {{ l.size }}</div>
            </div>
            <div style="text-align: right">
              <div>{{ l.bookQty }} → {{ l.actualQty }}</div>
              <div :class="l.diffQty === 0 ? 'text-weak' : l.diffQty < 0 ? 'text-danger' : 'text-success'">
                {{ l.diffQty === 0 ? '盘平' : (l.diffQty > 0 ? '+' : '') + l.diffQty }}
              </div>
            </div>
          </div>
        </van-collapse-item>
      </van-collapse>
    </div>

    <div class="bottom-bar-spacer" />

    <!-- 店长确认 / 驳回（PRD 5.2.2） -->
    <div v-if="result.diffCount" class="bottom-bar bar-row">
      <van-button class="big-btn" block plain type="danger" @click="onReject">驳回重盘</van-button>
      <van-button class="big-btn" block type="primary" :loading="confirming" @click="onConfirm">
        确认差异
      </van-button>
    </div>
  </div>

  <van-empty v-else description="暂无对账结果，请先完成盘点" />
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showDialog, showConfirmDialog } from 'vant'
import { fetchLastReconcile, applyStocktakeAdjust, resumeStocktake } from '../../mock/wms'

const router = useRouter()
const result = ref(null)
const activeNames = ref([])
const confirming = ref(false)
/** 归因依据折叠态（按 SKU 记录，v0.3.1 店员可读性改造） */
const expandedAttr = ref({})

function toggleAttr(sku) {
  expandedAttr.value = { ...expandedAttr.value, [sku]: !expandedAttr.value[sku] }
}

/** 店员视角的人话结论：只说差多少、像什么原因、确认后会怎样 */
function plainConclusion(l) {
  const n = Math.abs(l.diffQty)
  if (l.diffQty < 0) return `实盘比账面少 ${n} 件：像是有销售没扣库存或货品丢失，确认后按盘亏扣减`
  return `实盘比账面多 ${n} 件：疑似退货入错款或漏记入库，确认后按盘盈补记`
}

const checkedRate = computed(() => {
  if (!result.value || !result.value.totalSku) return 0
  return Math.round((result.value.checkedSku / result.value.totalSku) * 100)
})

async function onConfirm() {
  // v0.4.1 护栏（覆盖率 < 100% 强制确认）：防"半轮盘点 + 一键落账"把账本砍掉。
  // 数字本身只是减法永远"对"，但没盘完的对账结果没有资格被静默确认。
  const r = result.value
  if (r && r.uncheckedSku > 0) {
    const diffTxt = [
      r.lossQty ? `盘亏 ${Math.abs(r.lossQty)} 件` : '',
      r.gainQty ? `盘盈 ${r.gainQty} 件` : ''
    ]
      .filter(Boolean)
      .join('、')
    let confirmed = true
    try {
      await showConfirmDialog({
        title: '本轮没盘完，确认要落账吗？',
        message: `本轮只盘了 ${r.checkedSku}/${r.totalSku} 个 SKU，未盘的 ${r.uncheckedSku} 个不会被修改。\n已盘差异合计 ${diffTxt}，确认后账本照此修正。\n想完整对账请选【驳回重盘】。`,
        showCancelButton: true,
        confirmButtonText: '我知悉，仍要确认',
        cancelButtonText: '驳回重盘'
      })
    } catch {
      confirmed = false
    }
    if (!confirmed) {
      // 弹窗里点【驳回重盘】：对账结果作废、库存不动，任务回「盘点中」，已盘保留，回盘点页继续扫
      await resumeStocktake()
      showToast({ message: '已驳回，回去继续扫码，已盘记录已保留', position: 'bottom' })
      setTimeout(() => router.replace('/stocktake'), 800)
      return
    }
  }
  confirming.value = true
  try {
    // v0.3.1：确认差异真正落账（生成调整单，账面向实盘对齐）
    const res = await applyStocktakeAdjust()
    showToast({ message: `调整单 ${res.adjustNo} 已落账（${res.applied} 个 SKU）`, type: 'success' })
    setTimeout(() => router.replace('/home'), 900)
  } catch (e) {
    showToast(e.message || '落账失败')
  } finally {
    confirming.value = false
  }
}

async function onReject() {
  await showDialog({
    title: '驳回重盘',
    message: '本次对账结果作废、库存保持不动，回到盘点页重新扫码再对一次。已盘记录保留，确定驳回？',
    showCancelButton: true
  })
  // v0.4.6：恢复任务到「盘点中」，否则回盘点页后连扫/结束按钮全灰
  await resumeStocktake()
  showToast({ message: '已驳回，回去继续扫码，已盘记录已保留', position: 'bottom' })
  setTimeout(() => router.replace('/stocktake'), 800)
}

onMounted(async () => {
  result.value = await fetchLastReconcile()
})
</script>

<style scoped>
.summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  text-align: center;
}
.sum-num {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
}
.sum-label {
  font-size: 12px;
  color: var(--wms-text-weak);
  margin-top: 2px;
}

.diff-card {
  padding: 12px;
  border-radius: 8px;
  background: #f7f8fa;
  margin-bottom: 10px;
}
.diff-card:last-child {
  margin-bottom: 0;
}
.diff-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 15px;
}
.diff-sku {
  font-size: 12px;
  color: var(--wms-text-weak);
  margin-top: 3px;
}
.qty-compare {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}
.qc {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.qc-label {
  font-size: 11px;
  color: var(--wms-text-weak);
}
.qc-val {
  font-size: 17px;
  font-weight: 700;
}
.attr {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e0e2e6;
}
.attr-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.attr-conclusion {
  font-size: 13px;
  font-weight: 600;
}
.attr-evidence {
  font-size: 12px;
  color: var(--wms-text-weak);
  margin-top: 6px;
  display: flex;
  align-items: flex-start;
  gap: 4px;
}
.attr-conf {
  display: flex;
  align-items: center;
  margin-top: 8px;
  font-size: 12px;
}
.conf-num {
  margin-left: 8px;
  font-weight: 600;
  color: #ff976a;
}
.plain-line {
  margin-top: 10px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
}
.attr-toggle {
  margin-top: 8px;
  font-size: 12px;
  color: var(--wms-text-weak);
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.all-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f2f3f5;
  font-size: 14px;
}
.all-row:last-child {
  border-bottom: none;
}
.all-name {
  font-weight: 600;
}
.unchecked-tip {
  margin: 0 12px 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fffbe8;
  color: #ed6a0c;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.guide-tip {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #ecf9ff;
  color: #1989fa;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 1.4;
}
.bar-row {
  display: flex;
  gap: 10px;
}
</style>