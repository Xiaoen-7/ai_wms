import { createRouter, createWebHashHistory } from 'vue-router'

/**
 * 路由结构：
 * /home                    首页看板（底部 Tab）
 * /inventory               实时库存（底部 Tab）
 * /transfer                调拨进度（底部 Tab）
 * /profile                 我的（底部 Tab）
 *
 * 二级页（无 Tabbar，由 App.vue 按 meta.tabbar 隐藏）：
 * /receipt                 扫码入库 - 待收货单列表
 * /receipt/:no             扫码入库 - 扫码收货详情
 * /receipt-scan            扫码入库 - 快捷扫码入库（单件直入）
 * /stocktake               扫码盘点
 * /stocktake/result        盘点对账结果
 * /transfer/:no            调拨单详情 / 扫码收货
 * /returns                 退换货 - 主页（验退入口 / 待复核 / 退货记录）
 * /returns/scan            退换货 - 扫码验退（原单反查 / 吊牌分流 / 人工录入）
 * /returns/review          退换货 - 待复核清单
 * /defective               次品登记（次品账 / 促销处理）
 */
const routes = [
  { path: '/', redirect: '/home' },

  {
    path: '/home',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { title: '首页', tabbar: true, keepAlive: true }
  },
  {
    path: '/inventory',
    name: 'Inventory',
    component: () => import('../views/Inventory.vue'),
    meta: { title: '实时库存', tabbar: true, keepAlive: true }
  },
  {
    path: '/transfer',
    name: 'Transfer',
    component: () => import('../views/Transfer.vue'),
    meta: { title: '调拨进度', tabbar: true, keepAlive: true }
  },
  {
    path: '/functions',
    name: 'Functions',
    component: () => import('../views/Functions.vue'),
    meta: { title: '功能', tabbar: true, keepAlive: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/Profile.vue'),
    meta: { title: '我的', tabbar: true, keepAlive: true }
  },

  {
    path: '/receipt',
    name: 'ReceiptList',
    component: () => import('../views/receipt/ReceiptList.vue'),
    meta: { title: '收货单', tabbar: false }
  },
  {
    path: '/receipt-scan',
    name: 'ScanInbound',
    component: () => import('../views/receipt/ScanInbound.vue'),
    meta: { title: '扫码入库', tabbar: false }
  },
  {
    path: '/receipt-diffs',
    name: 'ReceiptDiffs',
    component: () => import('../views/receipt/ReceiptDiffs.vue'),
    meta: { title: '收货差异', tabbar: false }
  },
  {
    path: '/receipt/:no',
    name: 'ReceiptDetail',
    component: () => import('../views/receipt/ReceiptDetail.vue'),
    meta: { title: '扫码收货', tabbar: false }
  },

  {
    path: '/stocktake',
    name: 'Stocktake',
    component: () => import('../views/stocktake/Stocktake.vue'),
    meta: { title: '扫码盘点', tabbar: false }
  },
  {
    path: '/stocktake/result',
    name: 'StocktakeResult',
    component: () => import('../views/stocktake/StocktakeResult.vue'),
    meta: { title: '盘点对账', tabbar: false }
  },

  {
    path: '/transfer/:no',
    name: 'TransferDetail',
    component: () => import('../views/transfer/TransferDetail.vue'),
    meta: { title: '调拨详情', tabbar: false }
  },

  {
    path: '/returns',
    name: 'ReturnsHome',
    component: () => import('../views/returns/ReturnsHome.vue'),
    meta: { title: '退换货', tabbar: false }
  },
  {
    path: '/returns/scan',
    name: 'ReturnScan',
    component: () => import('../views/returns/ReturnScan.vue'),
    meta: { title: '扫码验退', tabbar: false }
  },
  {
    path: '/returns/review',
    name: 'ReturnReview',
    component: () => import('../views/returns/ReturnReview.vue'),
    meta: { title: '待复核清单', tabbar: false }
  },
  {
    path: '/defective',
    name: 'DefectiveList',
    component: () => import('../views/defective/DefectiveList.vue'),
    meta: { title: '次品登记', tabbar: false }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.afterEach((to) => {
  if (to.meta?.title) {
    document.title = `${to.meta.title} - 简岸门店 WMS`
  }
})

export default router