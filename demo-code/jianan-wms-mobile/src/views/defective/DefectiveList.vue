<template>
  <div class="page">
    <!-- 汇总头（PRD 5.6.2 原型：汇总头） -->
    <div class="card summary">
      <div class="sum-item">
        <div class="sum-num text-danger">{{ summary.open }}</div>
        <div class="text-weak">待处理（件）</div>
      </div>
      <div class="sum-item">
        <div class="sum-num">{{ summary.done }}</div>
        <div class="text-weak">已促销处理（件）</div>
      </div>
    </div>

    <van-tabs v-model:active="activeTab" sticky>
      <van-tab title="全部" name="all" />
      <van-tab title="待处理" name="待处理" />
      <van-tab title="已促销处理" name="已促销处理" />
    </van-tabs>

    <div v-for="d in list" :key="d.id" class="card">
      <div class="row1">
        <span class="no">{{ d.id }}</span>
        <van-tag :type="d.status === '待处理' ? 'danger' : 'success'" size="medium" round>
          {{ d.status }}
        </van-tag>
      </div>
      <div class="goods">{{ d.name }} {{ d.color }}/{{ d.size }} × {{ d.qty }}</div>
      <div class="text-weak">原因：{{ d.reason }} · 登记于 {{ d.at }}</div>
      <!-- 处理留痕（PRD 5.6.2：状态每次变更留痕可查） -->
      <div class="trail">
        <div v-for="(t, i) in d.trail" :key="i" class="text-weak trail-line">
          · [{{ t.at }}] {{ t.status }}：{{ t.note }}
        </div>
      </div>
      <van-button
        v-if="d.status === '待处理'"
        size="small"
        type="warning"
        plain
        style="margin-top: 8px"
        @click="onPromote(d)"
      >
        促销处理（总部季度低价清货）
      </van-button>
    </div>

    <van-empty v-if="!list.length" description="暂无次品记录" />

    <!-- 浮动登记入口（PRD 5.6.2 原型：登记入口为浮动按钮） -->
    <div class="fab" @click="showRegister = true">
      <van-icon name="plus" size="24" color="#fff" />
    </div>

    <!-- 登记弹层：原因必填 -->
    <van-popup v-model:show="showRegister" position="bottom" round>
      <div class="reg-form">
        <div class="card-title" style="margin-bottom: 4px">登记次品</div>
        <div class="text-weak" style="margin-bottom: 8px">
          门店内发现的次品（如陈列磨损）：从可售划入次品账，数量守恒
        </div>
        <van-field
          v-model="regSkuLabel"
          is-link
          readonly
          label="商品"
          placeholder="点选商品 SKU"
          @click="showPicker = true"
        />
        <van-field label="数量">
          <template #input>
            <van-stepper v-model="regQty" min="1" max="9" />
          </template>
        </van-field>
        <van-field
          v-model="regReason"
          rows="2"
          autosize
          type="textarea"
          maxlength="40"
          show-word-limit
          label="原因（必填）"
          placeholder="如：陈列磨损 / 污渍 / 线头"
        />
        <van-button class="big-btn" type="danger" block style="margin-top: 10px" :loading="submitting" @click="onRegister">
          确认登记
        </van-button>
        <div style="height: 8px"></div>
      </div>
    </van-popup>

    <van-popup v-model:show="showPicker" position="bottom" round>
      <van-picker :columns="skuColumns" @confirm="onPickerConfirm" @cancel="showPicker = false" />
    </van-popup>

    <div class="sync-footer">次品账每次变动都留痕 · 对接总部季度促销</div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { showToast } from 'vant'
import { fetchDefectives, registerDefective, promoteDefective, PRODUCTS } from '../../mock/wms'

const activeTab = ref('all')
const list = ref([])
const summary = ref({ open: 0, done: 0 })

const showRegister = ref(false)
const showPicker = ref(false)
const submitting = ref(false)
const regSku = ref(null)
const regQty = ref(1)
const regReason = ref('')

const skuColumns = computed(() =>
  PRODUCTS.map((p) => ({ text: `${p.name} ${p.color}/${p.size}`, value: p.sku }))
)
const regSkuLabel = computed(() => {
  if (!regSku.value) return ''
  const p = PRODUCTS.find((x) => x.sku === regSku.value)
  return p ? `${p.name} ${p.color}/${p.size}` : ''
})

function onPickerConfirm({ selectedValues }) {
  regSku.value = selectedValues[0]
  showPicker.value = false
}

async function load() {
  const res = await fetchDefectives({ status: activeTab.value })
  list.value = res.list
  summary.value = res.summary
}

watch(activeTab, load)

async function onRegister() {
  if (!regSku.value) {
    showToast('请先选择商品')
    return
  }
  submitting.value = true
  try {
    const res = await registerDefective({ sku: regSku.value, qty: regQty.value, reason: regReason.value })
    showRegister.value = false
    regSku.value = null
    regQty.value = 1
    regReason.value = ''
    showToast(`已登记 ${res.id}：可售划入次品账`)
    await load()
  } catch (e) {
    showToast(e.message || '登记失败')
  } finally {
    submitting.value = false
  }
}

async function onPromote(d) {
  try {
    await promoteDefective(d.id)
    showToast(`已促销处理，次品账扣减 ${d.qty} 件`)
    await load()
  } catch (e) {
    showToast(e.message || '操作失败')
  }
}

onMounted(load)
</script>

<style scoped>
.summary {
  display: flex;
  padding: 16px 0;
}
.sum-item {
  flex: 1;
  text-align: center;
}
.sum-num {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
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
.trail {
  margin-top: 6px;
  padding: 6px 8px;
  background: #f7f8fa;
  border-radius: 6px;
}
.trail-line {
  line-height: 1.7;
}
.fab {
  position: fixed;
  right: 18px;
  bottom: 34px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--wms-danger);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 16px rgba(238, 10, 36, 0.32);
  cursor: pointer;
  z-index: 15;
}
.fab:active {
  opacity: 0.9;
}
.reg-form {
  padding: 16px;
}
</style>
