<template>
  <div class="app-wrapper">
    <!-- 顶部导航条：二级页可返回 -->
    <van-nav-bar
      :title="pageTitle"
      :left-arrow="showBack"
      fixed
      placeholder
      safe-area-inset-top
      @click-left="onBack"
    />

    <main class="app-main" :class="{ 'has-tabbar': showTabbar }">
      <router-view v-slot="{ Component }">
        <keep-alive :include="keepAliveNames">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </main>

    <van-tabbar v-if="showTabbar" route safe-area-inset-bottom>
      <van-tabbar-item to="/home" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item to="/inventory" icon="AppsO">库存</van-tabbar-item>
      <van-tabbar-item to="/transfer" icon="Logistics">调拨</van-tabbar-item>
      <van-tabbar-item to="/functions" icon="grid-o">功能</van-tabbar-item>
      <van-tabbar-item to="/profile" icon="UserO">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const pageTitle = computed(() => route.meta?.title || '简岸门店 WMS')
const showTabbar = computed(() => route.meta?.tabbar === true)
// 一级 Tab 页返回根；二级页用浏览器后退
const showBack = computed(() => !showTabbar.value)

const keepAliveNames = ['Home', 'Inventory', 'Transfer', 'Functions', 'Profile']

function onBack() {
  if (window.history.length > 1) router.back()
  else router.replace('/home')
}
</script>

<style scoped>
.app-wrapper {
  min-height: 100vh;
  background: #f7f8fa;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1;
}

.app-main.has-tabbar {
  padding-bottom: 50px;
}
</style>