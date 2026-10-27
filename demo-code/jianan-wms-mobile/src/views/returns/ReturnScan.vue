<template>
  <div class="page">
    <!-- 扫码区 -->
    <div class="card" v-if="step === 'idle'">
      <van-button class="big-btn scan-btn" type="danger" icon="scan" block :loading="scanning" @click="onScan">
        {{ scanning ? '识别中…' : '扫码验退（扫顾客带回的吊牌条码）' }}
      </van-button>
      <div class="text-weak" style="text-align: center; margin-top: 8px">
        连续扫码按顺序轮换演示场景：连衣裙有原单 → 衬衫有原单 → 大衣查无原单 → 开衫有原单
      </div>
      <div class="text-weak" style="text-align: center; margin-top: 4px">
        流程：扫码反查原销售单 → 判吊牌/包装 → 完好入回原库存，破损归次品
      </div>
    </div>

    <!-- 有原单：展示原销售单信息卡（PRD 5.6.1 原型） -->
    <template v-if="step === 'matched'">
      <div class="card">
        <div class="card-title"><span>原销售单信息</span><van-tag type="primary" round size="medium">反查成功</van-tag></div>
        <van-cell title="原单号" :value="sale.saleNo" :border="false" />
        <van-cell title="商品" :value="`${product.name} ${product.color}/${product.size}`" :border="false" />
        <van-cell title="批次" :value="sale.batch" :border="false" />
        <van-cell title="购买时间" :value="sale.soldAt" :border="false" />
        <van-cell title="退货条码" :value="code" :border="false" />
      </div>

      <!-- 吊牌/包装判断（PRD 3.4 分流判断） -->
      <div class="card">
        <div class="card-title"><span>吊牌 / 包装状态</span></div>
        <van-radio-group v-model="tagChoice" direction="horizontal">
          <van-radio name="ok">吊牌完好 / 包装未拆</van-radio>
          <van-radio name="broken">破损或已拆封</van-radio>
        </van-radio-group>
        <div class="text-weak" style="margin-top: 8px">
          完好 → 按原 SKU 入回可售库存；破损 → 强制归次品，不能进可售库存
        </div>
      </div>

      <!-- 换货（PRD 5.6.1 边界：一退一进两笔事件） -->
      <div class="card">
        <div class="card-title"><span>换货（可选）</span></div>
        <van-cell center title="顾客同时换一件" :border="false">
          <template #right-icon>
            <van-switch v-model="exchangeOn" size="22" />
          </template>
        </van-cell>
        <div v-if="exchangeOn" style="margin-top: 6px">
          <van-field
            v-model="exchangeLabel"
            is-link
            readonly
            label="换出商品"
            placeholder="点选顾客要换的 SKU"
            @click="showPicker = true"
          />
          <div class="text-weak" style="padding: 0 16px 6px">
            换货 = 一退一进：原 SKU 入回/归次品，新 SKU 从可售扣 1 件交予顾客
          </div>
        </div>
      </div>

      <!-- 分流大按钮（PRD 5.6.1：两个大按钮） -->
      <van-button
        class="big-btn"
        :type="tagChoice === 'ok' ? 'success' : 'warning'"
        block
        :loading="submitting"
        style="margin-bottom: 10px"
        @click="onConfirm(tagChoice === 'ok')"
      >
        {{ tagChoice === 'ok' ? '入回原库存' : '归次品' }}
      </van-button>
    </template>

    <!-- 查无原单：人工录入（PRD 5.6.1 异常场景） -->
    <template v-if="step === 'noSale'">
      <div class="card">
        <div class="card-title">
          <span>人工录入</span>
          <van-tag type="warning" round size="medium">查无原单</van-tag>
        </div>
        <van-cell title="退货条码" :value="code" :border="false" />
        <div class="text-weak" style="padding: 0 16px 8px">
          条码认识商品，但 POS 查不到原销售单（如电子小票字迹模糊/非本店销售）。请人工录入并强制标记待复核。
        </div>
        <van-field
          v-model="manualSkuLabel"
          is-link
          readonly
          label="退货商品"
          placeholder="点选商品 SKU"
          @click="showPicker = true"
        />
        <div class="text-weak" style="padding: 0 16px 6px">
          {{ manualAuto ? '已按条码自动识别（条码即商品），如与实物不符可点选修改（需二次确认）' : '已人工修改商品，提交后将强制待复核核对' }}
        </div>
        <van-field label="数量">
          <template #input>
            <van-stepper v-model="manualQty" min="1" max="9" />
          </template>
        </van-field>
        <van-field
          v-model="manualReason"
          rows="2"
          autosize
          type="textarea"
          maxlength="60"
          show-word-limit
          label="备注"
          placeholder="凭人工印象补充：顾客描述/小票情况等"
        />
      </div>

      <div class="bottom-bar">
        <van-checkbox v-model="reviewFlag" shape="square" style="margin-bottom: 8px">
          标记待复核（必勾，24h 内补原单可解除）
        </van-checkbox>
        <van-button class="big-btn" type="primary" block :loading="submitting" @click="onManualSubmit">
          提交人工录入
        </van-button>
      </div>
      <div class="bottom-bar-spacer"></div>
    </template>

    <!-- 完成：事件流水回执 -->
    <template v-if="step === 'done'">
      <div class="card">
        <div class="card-title">
          <span>退货单 {{ resultNo }}</span>
          <van-tag type="success" round size="medium">已落账</van-tag>
        </div>
        <div v-for="(e, i) in resultEvents" :key="i" class="event-item">
          <van-tag :type="e.type === '换货出库' ? 'primary' : e.type === '次品登记' ? 'danger' : 'success'" plain>
            {{ e.type }}
          </van-tag>
          <span class="event-note">{{ e.note }}</span>
        </div>
      </div>
      <van-button class="big-btn" type="danger" plain block style="margin-bottom: 10px" :loading="scanning" @click="onScan">
        {{ scanning ? '扫码中…' : '再扫一件' }}
      </van-button>
      <van-button class="big-btn" type="default" block @click="router.replace('/returns')">返回退换货</van-button>
    </template>

    <!-- SKU 选择器 -->
    <van-popup v-model:show="showPicker" position="bottom" round>
      <van-picker
        :columns="skuColumns"
        @confirm="onPickerConfirm"
        @cancel="showPicker = false"
      />
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { scanReturn, confirmReturn, confirmManualReturn, PRODUCTS } from '../../mock/wms'

const router = useRouter()

const step = ref('idle') // idle | matched | noSale | done
const scanning = ref(false)
const submitting = ref(false)

const code = ref('')
const product = ref(null)
const sale = ref(null)

const tagChoice = ref('ok')
const exchangeOn = ref(false)
const exchangeSku = ref(null)
const showPicker = ref(false)
const pickerTarget = ref('exchange') // exchange | manual

const manualSku = ref(null)
const manualQty = ref(1)
const manualReason = ref('')
const reviewFlag = ref(false)
const manualAuto = ref(false) // 退货商品是否由条码自动识别填入

const resultNo = ref('')
const resultEvents = ref([])

const labelOf = (sku) => {
  const p = PRODUCTS.find((x) => x.sku === sku)
  return p ? `${p.name} ${p.color}/${p.size}` : ''
}

const skuColumns = computed(() =>
  PRODUCTS.map((p) => ({ text: `${p.name} ${p.color}/${p.size}`, value: p.sku }))
)
const exchangeLabel = computed(() => {
  if (!exchangeSku.value) return ''
  const p = PRODUCTS.find((x) => x.sku === exchangeSku.value)
  return p ? `${p.name} ${p.color}/${p.size}` : ''
})
const manualSkuLabel = computed(() => labelOf(manualSku.value))

async function onPickerConfirm({ selectedValues }) {
  showPicker.value = false
  if (pickerTarget.value === 'exchange') {
    exchangeSku.value = selectedValues[0]
    return
  }
  // 人工录入：条码自动识别的商品，店员改选需二次确认（防选错；改错商品会在补录原单环节暴露）
  const next = selectedValues[0]
  if (manualAuto.value && manualSku.value && next !== manualSku.value) {
    try {
      await showConfirmDialog({
        title: '确认修改退货商品',
        message: `条码 ${code.value} 自动识别为「${labelOf(manualSku.value)}」。\n确认改为「${labelOf(next)}」？\n（改错商品会在 24h 补录原单环节对账暴露）`
      })
    } catch {
      return // 取消：保留自动识别的商品
    }
    manualAuto.value = false
  }
  manualSku.value = next
}

async function onScan() {
  scanning.value = true
  // 复位上一件的状态（再扫一件 = 直接扫下一件，不再回空态页）
  code.value = ''
  product.value = null
  sale.value = null
  tagChoice.value = 'ok'
  exchangeOn.value = false
  exchangeSku.value = null
  manualSku.value = null
  manualQty.value = 1
  manualReason.value = ''
  reviewFlag.value = false
  manualAuto.value = false
  try {
    const r = await scanReturn()
    if (!r.product) {
      showToast('未匹配商品主数据')
      step.value = 'idle'
      return
    }
    code.value = r.code
    product.value = r.product
    sale.value = r.sale
    if (r.sale) {
      step.value = 'matched'
      pickerTarget.value = 'exchange'
    } else {
      // 条码即商品：查无原单时自动带出条码映射的 SKU，店员无需手选
      manualSku.value = r.product.sku
      manualQty.value = 1
      manualAuto.value = true
      step.value = 'noSale'
      pickerTarget.value = 'manual'
    }
  } finally {
    scanning.value = false
  }
}

async function onConfirm(tagOk) {
  if (exchangeOn.value && !exchangeSku.value) {
    showToast('已开启换货，请先选择换出商品')
    return
  }
  submitting.value = true
  try {
    const res = await confirmReturn({
      sku: product.value.sku,
      saleNo: sale.value?.saleNo || null,
      tagOk,
      qty: 1,
      exchangeSku: exchangeOn.value ? exchangeSku.value : null
    })
    resultNo.value = res.returnNo
    resultEvents.value = res.events
    step.value = 'done'
    showToast(`退货单 ${res.returnNo} 已落账`)
  } catch (e) {
    showToast(e.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

async function onManualSubmit() {
  if (!manualSku.value) {
    showToast('请先选择退货商品')
    return
  }
  if (!reviewFlag.value) {
    showToast('人工录入必须勾选「标记待复核」后才能提交')
    return
  }
  submitting.value = true
  try {
    const res = await confirmManualReturn({
      sku: manualSku.value,
      qty: manualQty.value,
      reason: manualReason.value,
      reviewFlag: reviewFlag.value
    })
    resultNo.value = res.returnNo
    resultEvents.value = [
      { type: '退货入库', note: '人工录入入回可售库存' },
      { type: '待复核', note: `已挂入待复核清单（${res.reviewId}），24h 内补原单可解除标记` }
    ]
    step.value = 'done'
    showToast(`已提交，强制标记待复核`)
  } catch (e) {
    showToast(e.message || '操作失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.scan-btn {
  background: var(--wms-danger);
  border-color: var(--wms-danger);
}
.event-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}
.event-item:last-of-type {
  border-bottom: none;
}
.event-note {
  font-size: 13px;
  flex: 1;
}
</style>
