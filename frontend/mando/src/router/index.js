import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', redirect: '/login' },
  { 
    path: '/login', 
    component: () => import('../views/Login.vue') 
  },
  { 
    path: '/admin', 
    component: () => import('../views/admin/Dashboard.vue')
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

// 全局路由守卫：保护管理后台
router.beforeEach((to, from, next) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (to.path.startsWith('/admin')) {
    if (user.role_key === 'ADMIN') {
      next();
    } else {
      alert('权限不足，仅限管理员访问');
      next('/login');
    }
  } else {
    next();
  }
});

export default router;