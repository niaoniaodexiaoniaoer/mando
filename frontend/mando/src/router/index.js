import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', redirect: '/login' },
  { 
    path: '/login', 
    component: () => import('../views/Login.vue') 
  },
  { 
    path: '/admin', 
    component: () => import('../views/admin/Dashboard.vue'),
    // 之后可以在这里添加导航守卫，限制仅管理员进入
  },
  { 
    path: '/mobile/home', 
    component: () => import('../views/mobile/Home.vue') 
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;