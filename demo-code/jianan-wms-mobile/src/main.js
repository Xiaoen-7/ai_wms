import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/global.css'

// Vant 样式（全量引入，demo 简便做法；正式项目建议 unplugin-vue-components 按需引入）
import 'vant/lib/index.css'

// Vant 组件全量注册，便于 Demo 直接使用任意组件
import Vant from 'vant'

// 引入 mock 数据（Promise 风格，不拦截 XHR）
import './mock'

const app = createApp(App)

app.use(Vant)
app.use(router)

app.mount('#app')