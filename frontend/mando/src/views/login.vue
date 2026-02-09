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
      // 登录成功，跳转到移动端首页
      console.log('登录成功:', data.user);
      router.push('/mobile/home');
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
  letter-spacing: 6px;
}
.mo-input-group {
  margin-bottom: 25px;
  border-bottom: 2px solid #000;
}
.mo-input {
  width: 100%;
  height: 50px;
  border: none;
  outline: none;
  font-size: 18px;
  padding: 0 5px;
}
.mo-login-btn {
  width: 100%;
  height: 55px;
  background: #000;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 18px;
  font-weight: bold;
  margin-top: 40px;
  box-shadow: 0 10px 20px rgba(0,0,0,0.1);
}
.mo-login-btn:active { transform: scale(0.97); }
</style>