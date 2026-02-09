<template>
  <div class="mo-login-container">
    <div class="mo-login-content">
      <div class="mo-logo">M&O</div>
      <div class="mo-form">
        <div class="mo-input-group">
          <input type="text" v-model="username" placeholder="请输入用户名" class="mo-input">
        </div>
        <div class="mo-input-group">
          <input type="password" v-model="password" placeholder="请输入密码" class="mo-input">
        </div>
        <button @click="handleLogin" class="mo-login-btn">登 录</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const username = ref('')
const password = ref('')
const router = useRouter()

const handleLogin = async () => {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value })
    });
    
    const data = await response.json();
    if (data.success) {
      // 1. 核心：将包含 role_key 的用户信息存入本地缓存，供路由守卫校验
      localStorage.setItem('user', JSON.stringify(data.user));
      
      console.log('登录成功，用户信息:', data.user);

      // 2. 动态跳转逻辑
      if (data.user.role_key === 'ADMIN') {
        // 如果是管理员，进入 PC 端管理后台
        router.push('/admin');
      } else {
        // 其他角色进入移动端首页
        router.push('/mobile/home');
      }
    } else {
      alert(data.message || '登录失败');
    }
  } catch (error) {
    console.error('请求失败:', error);
    alert('服务器连接失败');
  }
}
</script>

<style scoped>
.mo-login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}
.mo-login-content {
  width: 85%;
  max-width: 350px;
}
.mo-logo {
  font-size: 42px;
  font-weight: 900;
  text-align: center;
  margin-bottom: 80px;
  letter-spacing: -2px;
  color: #000;
}
.mo-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.mo-input {
  width: 100%;
  padding: 15px 0;
  border: none;
  border-bottom: 1px solid #eee;
  font-size: 16px;
  outline: none;
  transition: border-color 0.3s;
}
.mo-input:focus {
  border-bottom-color: #000;
}
.mo-login-btn {
  margin-top: 40px;
  background: #000;
  color: #fff;
  border: none;
  padding: 18px;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 10px 20px rgba(0,0,0,0.1);
}
.mo-login-btn:active {
  transform: scale(0.98);
}
</style>