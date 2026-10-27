<template>
  <div class="page">
    <div class="profile-head">
      <van-image round width="64" height="64" fit="cover" :src="avatar" />
      <div class="info">
        <div class="name">{{ CURRENT_STORE.manager }}</div>
        <div class="role">店长 · {{ CURRENT_STORE.name }}</div>
      </div>
    </div>

    <van-cell-group inset style="margin-bottom: 12px">
      <van-cell title="扫码入库" icon="scan" is-link to="/receipt" />
      <van-cell title="扫码盘点" icon="records" is-link to="/stocktake" />
      <van-cell title="实时库存" icon="apps-o" is-link to="/inventory" />
      <van-cell title="调拨进度" icon="logistics" is-link to="/transfer" />
    </van-cell-group>

    <van-cell-group inset>
      <van-cell title="门店编码" :value="CURRENT_STORE.id" />
      <van-cell title="数据同步" value="实时 · 秒级最终一致" />
      <van-cell title="系统版本" value="Demo v0.4.9" />
    </van-cell-group>

    <van-cell-group inset style="margin-top: 12px">
      <!-- 重置演示数据（v0.3.0）：清空持久化状态并刷新，演示翻车后一键复原 -->
      <van-cell
        title="重置演示数据"
        icon="replay"
        is-link
        @click="onResetDemo"
      />
    </van-cell-group>

    <div class="sync-footer">
      本 Demo 为原型演示，数据全部来自 Mock，不对接真实后端
    </div>
  </div>
</template>

<script setup>
import { showConfirmDialog, showToast } from 'vant'
import { CURRENT_STORE, resetDemoData } from '../mock/wms'

const avatar = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#1989fa"/><text x="32" y="40" font-size="26" fill="#fff" text-anchor="middle" font-family="sans-serif">张</text></svg>'
)

async function onResetDemo() {
  try {
    await showConfirmDialog({
      title: '重置演示数据',
      message: '将清空未匹配条码清单等持久化数据，并刷新页面回到初始状态。确定继续？'
    })
    showToast('正在重置…')
    await resetDemoData()
  } catch {
    /* 用户取消 */
  }
}
</script>

<style scoped>
.profile-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 4px 20px;
}
.name {
  font-size: 19px;
  font-weight: 700;
}
.role {
  font-size: 13px;
  color: var(--wms-text-weak);
  margin-top: 4px;
}
</style>