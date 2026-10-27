/**
 * Mock 数据总入口
 * 这里使用 mockjs 直接拦截 XMLHttpRequest，模拟服务端接口
 * 也提供 src/mock/api.js 中的 Promise 函数供页面直接调用（不经过 axios）
 */
import Mock from 'mockjs'

// ============== Banner 列表 ==============
Mock.mock(/\/api\/banners$/, 'get', () => {
  return {
    code: 0,
    message: 'success',
    data: [
      { id: 1, title: '新品上市', desc: '精选好物立即抢购', color: 'linear-gradient(135deg, #1989fa, #4fa5ff)' },
      { id: 2, title: '限时特惠', desc: '全场满 199 减 50', color: 'linear-gradient(135deg, #ee0a24, #ff5a6f)' },
      { id: 3, title: '会员专享', desc: '开通 VIP 享受更多权益', color: 'linear-gradient(135deg, #07c160, #4dd599)' }
    ]
  }
})

// ============== 九宫格入口 ==============
Mock.mock(/\/api\/entries$/, 'get', () => {
  return {
    code: 0,
    data: [
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
})

// ============== 推荐列表（分页） ==============
Mock.mock(/\/api\/recommend\?.*/, 'get', (options) => {
  // 解析 query
  const url = new URL(options.url, 'http://localhost')
  const page = parseInt(url.searchParams.get('page') || '1', 10)
  const pageSize = parseInt(url.searchParams.get('pageSize') || '8', 10)
  const total = 26
  const items = []
  for (let i = 0; i < pageSize; i++) {
    const id = (page - 1) * pageSize + i + 1
    if (id > total) break
    items.push(Mock.mock({
      id,
      title: '@ctitle(4, 8)',
      desc: '@cparagraph(1, 2)',
      price: '@float(10, 999, 2, 2)',
      thumb: '@image("200x200", "#1989fa", "#fff", "Good")'
    }))
  }
  return { code: 0, data: { items, total, page, pageSize } }
})

// ============== 用户信息 ==============
Mock.mock(/\/api\/user\/info$/, 'get', () => {
  return {
    code: 0,
    data: Mock.mock({
      id: '@integer(10000, 99999)',
      name: '@cname',
      avatar: '@image("120x120", "#1989fa", "#fff", "User")'
    })
  }
})

// ============== 用户统计 ==============
Mock.mock(/\/api\/user\/stats$/, 'get', () => {
  return {
    code: 0,
    data: {
      orders: Mock.Random.integer(1, 50),
      favorites: Mock.Random.integer(5, 200),
      coupons: Mock.Random.integer(1, 12)
    }
  }
})

// 调试信息（生产环境可移除）
if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.log('[Mock] 已启动 - 所有 /api/* 请求将被拦截')
}

export default Mock
