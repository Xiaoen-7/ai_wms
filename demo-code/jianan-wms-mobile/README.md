# 移动端 Demo (Vue3 + Vite + Vant4)

极简的移动端 H5 Demo，**不依赖任何真实后端**，所有数据由 `mockjs` 生成。

## 技术栈

- Vue 3 (Composition API + `<script setup>`)
- Vite 5
- Vant 4 (Vue3 移动端 UI 库)
- Vue Router 4
- Mockjs

## 功能

- ✅ 底部三 Tab：首页 / 功能 / 我的
- ✅ 首页：Banner 轮播 + 搜索 + 九宫格入口 + 推荐列表（下拉刷新/上拉加载）
- ✅ 功能页：表单 + 弹窗 + 通知 + Tag + 空状态
- ✅ 我的页：用户信息 + 统计数据 + 功能列表
- ✅ 全部接口由 Mock.js 生成数据

## 目录结构

```
mobile/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.js              # 入口
    ├── App.vue              # 根组件（含 Tabbar）
    ├── router/
    │   └── index.js         # 路由配置
    ├── mock/
    │   ├── index.js         # mockjs 拦截器（演示风格 A）
    │   └── api.js           # Promise 风格接口（演示风格 B，页面所用）
    └── views/
        ├── Home.vue
        ├── Features.vue
        └── Profile.vue
```

## 启动

```bash
# 安装依赖
npm install

# 开发
npm run dev

# 构建
npm run build

# 预览构建产物
npm run preview
```

打开 http://localhost:5173 即可。

## 切换为真实接口

将 `src/mock/api.js` 中的 `fetchXxx` 实现替换为 `axios.get('/api/xxx')`，
再删除 `src/main.js` 中的 `import './mock'` 即可。
