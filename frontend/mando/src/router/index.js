import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: () => import('../views/Login.vue') },
  { path: '/admin', component: () => import('../views/admin/Dashboard.vue')},
  { path: '/mobile/home', component: () => import('../views/mobile/Home.vue') }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (to.path.startsWith('/admin')) {
    // 强制转大写判断，防止大小写不一致导致的权限问题
    if (user.role_key && user.role_key.toUpperCase() === 'ADMIN') {
      next();
    } else {
      alert('权限不足');
      next('/login');
    }
  } else {
    next();
  }
});

export default router;