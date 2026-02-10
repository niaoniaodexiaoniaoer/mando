<template>
  <div class="mo-login-container">
    <div v-if="!showCamera" class="mo-login-content">
      <div class="mo-logo">M&O</div>
      <div class="mo-form">
        <div class="mo-input-group">
          <input 
            type="text" 
            v-model="username" 
            placeholder="姓名首字母或手机号" 
            class="mo-input"
          >
        </div>
        <div class="mo-input-group">
          <input 
            type="password" 
            v-model="password" 
            placeholder="默认密码为手机后6位" 
            class="mo-input"
          >
        </div>
        <button @click="handleVerify" class="mo-login-btn">登 录</button>
      </div>
    </div>

    <div v-else class="camera-layer">
      <div class="camera-header">
        <h3>人像合规采集</h3>
        <p>请将头部置于虚线框内</p>
      </div>
      
      <div class="video-box">
        <video ref="videoRef" autoplay playsinline muted></video>
        <div class="face-guide"></div>
      </div>

      <div class="camera-footer">
        <button @click="captureAndLogin" class="capture-btn" :disabled="isUploading">
          {{ isUploading ? '上传中...' : '确认登录' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

const router = useRouter();
const username = ref('');
const password = ref('');
const showCamera = ref(false);
const videoRef = ref(null);
const isUploading = ref(false);
const userInfo = ref(null);

// 1. 验证账号
const handleVerify = async () => {
  try {
    const res = await axios.post('/api/auth/verify-account', {
      username: username.value,
      password: password.value
    });
    if (res.data.success) {
      userInfo.value = res.data.user;
      showCamera.value = true;
      startCamera();
    } else {
      alert(res.data.message);
    }
  } catch (error) {
    alert('请求失败');
  }
};

// 2. 开启相机
const startCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' }
    });
    setTimeout(() => {
      if (videoRef.value) videoRef.value.srcObject = stream;
    }, 100);
  } catch (err) {
    alert('无法调用摄像头，请检查权限');
  }
};

// 3. 停止相机
const stopCamera = () => {
  if (videoRef.value?.srcObject) {
    videoRef.value.srcObject.getTracks().forEach(t => t.stop());
  }
};

// 4. 采集照片并完成登录
const captureAndLogin = async () => {
  if (isUploading.value) return;
  isUploading.value = true;

  try {
    // 拍照转换
    const video = videoRef.value;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));

    // --- 获取 GPS 坐标 ---
    let locationStr = '等待获取...'; 
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 6000, 
          enableHighAccuracy: true 
        });
      });
      locationStr = `经度:${position.coords.longitude.toFixed(6)}, 纬度:${position.coords.latitude.toFixed(6)}`;
    } catch (e) {
      console.warn('GPS 采集失败:', e.message);
      locationStr = `获取位置失败 (${e.message || '超时或无权限'})`;
    }

    // 构建提交表单
    const formData = new FormData();
    formData.append('photo', blob);
    formData.append('user_id', userInfo.value.id);
    formData.append('username', userInfo.value.username);
    formData.append('real_name', userInfo.value.real_name);
    formData.append('status', 'SUCCESS');
    formData.append('location', locationStr); 

    // 发送登录请求
    const res = await axios.post('/api/auth/finalize-login', formData);
    
    if (res.data.success) {
      // 登录成功，清理资源
      stopCamera();
      
      // 存储用户信息和 Token (如果后端返回了的话)
      localStorage.setItem('user', JSON.stringify(res.data.user));
      
      // 获取角色并转为大写判断
      const userRole = res.data.user.role_key ? res.data.user.role_key.toUpperCase() : '';
      
      if (userRole === 'ADMIN') {
        router.push('/admin');
      } else {
        // 对应 index.js 中配置的 LB 用户路径
        router.push('/mobile/home');
      }
    } else {
      alert('登录验证失败: ' + (res.data.message || '原因未知'));
    }
  } catch (error) {
    console.error('Login Error:', error);
    alert('系统错误: ' + (error.response?.data?.message || error.message));
  } finally {
    isUploading.value = false;
  }
};
</script>

<style scoped>
/* 样式部分保持不变 */
.mo-login-container { min-height: 100vh; background: #fff; display: flex; align-items: center; justify-content: center; padding: 20px; }
.mo-login-content { width: 100%; max-width: 320px; }
.mo-logo { font-size: 42px; font-weight: 900; text-align: center; margin-bottom: 80px; letter-spacing: -2px; color: #000; }
.mo-form { display: flex; flex-direction: column; gap: 15px; }
.mo-input { width: 100%; height: 50px; border: none; border-bottom: 1px solid #eee; font-size: 16px; outline: none; transition: border-color 0.3s; }
.mo-input:focus { border-bottom-color: #000; }
.mo-login-btn { margin-top: 30px; height: 50px; background: #000; color: #fff; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
.camera-layer { position: fixed; inset: 0; background: #000; z-index: 1000; display: flex; flex-direction: column; }
.camera-header { padding: 50px 20px 30px; text-align: center; color: #fff; }
.camera-header h3 { font-size: 20px; margin: 0; }
.camera-header p { font-size: 14px; opacity: 0.6; margin-top: 10px; }
.video-box { flex: 1; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
video { width: 100%; height: 100%; object-fit: cover; }
.face-guide { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -55%); width: 260px; height: 320px; border: 2px dashed rgba(255,255,255,0.5); border-radius: 130px / 160px; }
.camera-footer { padding: 40px 20px 60px; display: flex; justify-content: center; }
.capture-btn { width: 80px; height: 80px; border-radius: 50%; background: #fff; border: 5px solid rgba(255,255,255,0.3); cursor: pointer; font-size: 14px; font-weight: 600; color: #000; }
.capture-btn:disabled { opacity: 0.5; }
</style>