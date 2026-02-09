<template>
  <div class="home-container">
    <h1>登录成功</h1>
    <p>欢迎来到 M&O 移动端首页</p>
    <button @click="$router.push('/login')">退出登录</button>
  </div>
</template>

<style scoped>
.home-container {
  padding: 20px;
  text-align: center;
  font-family: sans-serif;
}
h1 { color: #2563eb; }
button {
  margin-top: 20px;
  padding: 10px 20px;
  background: #000;
  color: #fff;
  border: none;
  border-radius: 4px;
}
</style>