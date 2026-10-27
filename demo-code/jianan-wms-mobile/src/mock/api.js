/**
 * 前端 Mock 接口封装
 * 本文件演示两种风格：
 * 1) 直接使用 mockjs.Random 生成数据，返回 Promise —— 用于简单列表/详情
 * 2) 使用 axios + mock 拦截器走 /api/* 真实 HTTP 请求 —— 用于需要演示拦截器
 *
 * 当前所有页面统一使用"直接生成"风格，模拟 200~500ms 网络延迟
 */
import Mock from 'mockjs'

// 模拟网络延迟
const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Banner
 */
export async function fetchBanners() {
  await delay(200)
  return [
    { id: 1, title: '新品上市', desc: '精选好物立即抢购', color: 'linear-gradient(135deg, #1989fa, #4fa5ff)' },
    { id: 2, title: '限时特惠', desc: '全场满 199 减 50', color: 'linear-gradient(135deg, #ee0a24, #ff5a6f)' },
    { id: 3, title: '会员专享', desc: '开通 VIP 享受更多权益', color: 'linear-gradient(135deg, #07c160, #4dd599)' }
  ]
}

/**
 * 九宫格入口
 */
export async function fetchEntries() {
  await delay(150)
  return [
    { id: 1, name: '推荐', icon: 'star-o' },
    { id: 2, name: '订单', icon: 'orders-o' },
    { id: 3, name: '收藏', icon: 'like-o' },
    { id: 4, name: '客服', icon: 'service-o' },
    { id: 5, name: '设置', icon: 'setting-o' },
    { id: 6, name: '地址', icon: 'location-o' },
    { id: 7, name: '消息', icon: 'envelop-o' },
    { id: 8, name: '更多', icon: 'apps-o' }
  ]
}

/**
 * 推荐商品（分页）
 */
export async function fetchRecommendList({ page = 1, pageSize = 8 } = {}) {
  await delay(300)
  const total = 26
  const items = []
  for (let i = 0; i < pageSize; i++) {
    const id = (page - 1) * pageSize + i + 1
    if (id > total) break
    items.push({
      id,
      title: Mock.Random.ctitle(4, 8),
      desc: Mock.Random.cparagraph(1, 2),
      price: Mock.Random.float(10, 999, 2, 2),
      thumb: Mock.Random.image('200x200', '#1989fa', '#fff', 'Good')
    })
  }
  return { items, total, page, pageSize }
}

/**
 * 用户信息
 */
export async function fetchUserInfo() {
  await delay(200)
  return {
    id: Mock.Random.integer(10000, 99999),
    name: Mock.Random.cname(),
    avatar: Mock.Random.image('120x120', '#1989fa', '#fff', 'User')
  }
}

/**
 * 用户统计数据
 */
export async function fetchUserStats() {
  await delay(200)
  return {
    orders: Mock.Random.integer(1, 50),
    favorites: Mock.Random.integer(5, 200),
    coupons: Mock.Random.integer(1, 12)
  }
}
