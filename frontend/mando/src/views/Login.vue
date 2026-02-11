<template>
  <div class="mo-login-container">
    <div v-if="!showCamera" class="mo-login-content">
      <div class="top-background"></div>

      <header class="header">
        <div class="logo-wrapper">
          <img src="https://img-mando.610612.xyz/logo.png" alt="Logo" class="mo-logo-img" />
        </div>
      </header>

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

      <footer class="footer">
        <p class="location-text" v-if="locationInfo">
          <span class="loc-icon">📍</span> {{ locationInfo }}
        </p>
      </footer>
    </div>

    <div v-else class="camera-layer">
      <div class="camera-header">
        <h3>人像合规采集</h3>
        <p>请将头部置于虚线框内</p>
      </div>
      
      <div class="video-box">
        <div class="video-mask">
          <video ref="videoRef" autoplay playsinline muted></video>
          <div class="face-guide"></div>
        </div>
      </div>

      <div class="camera-footer">
        <button @click="captureAndLogin" class="capture-btn" :disabled="isUploading">
          {{ isUploading ? '正在上传...' : '确认拍摄并登录' }}
        </button>
      </div>
    </div>

    <canvas ref="canvasRef" style="display: none"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const username = ref('')
const password = ref('')
const showCamera = ref(false)
const videoRef = ref(null)
const canvasRef = ref(null)
const isUploading = ref(false)
const locationInfo = ref('正在定位...')

// 获取地理位置
const getGeoLocation = () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        locationInfo.value = `经度:${pos.coords.longitude.toFixed(6)}, 纬度:${pos.coords.latitude.toFixed(6)}`
      },
      (err) => {
        locationInfo.value = "位置获取失败"
      },
      { timeout: 10000 }
    )
  }
}

// 验证账号密码
const handleVerify = async () => {
  if (!username.value || !password.value) {
    alert('请输入账号和密码')
    return
  }
  
  try {
    const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/verify-account`, {
      username: username.value,
      password: password.value
    })

    if (res.data.success) {
      showCamera.value = true
      initCamera()
    } else {
      alert(res.data.message)
    }
  } catch (err) {
    alert('验证失败，请检查网络')
  }
}

// 初始化摄像头
const initCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 640 },
      audio: false
    })
    
    // 给一点延迟确保 video 元素已渲染
    setTimeout(() => {
      if (videoRef.value) {
        videoRef.value.srcObject = stream
      }
    }, 100)
  } catch (err) {
    alert('无法调用摄像头，请检查权限')
    showCamera.value = false
  }
}

// 拍照并登录
const captureAndLogin = async () => {
  if (isUploading.value) return
  isUploading.value = true

  const video = videoRef.value
  const canvas = canvasRef.value
  
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  canvas.getContext('2d').drawImage(video, 0, 0)

  canvas.toBlob(async (blob) => {
    const formData = new FormData()
    formData.append('username', username.value)
    formData.append('status', 'SUCCESS') 
    formData.append('location', locationInfo.value)
    formData.append('photo', blob, 'face.jpg')

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/finalize-login`, formData)
      
      if (res.data.success) {
        localStorage.setItem('user', JSON.stringify(res.data.user))
        router.push('/home')
      } else {
        alert(res.data.message)
      }
    } catch (err) {
      alert('登录失败，请重试')
    } finally {
      isUploading.value = false
    }
  }, 'image/jpeg', 0.8)
}

onMounted(() => {
  getGeoLocation()
})
</script>

<style scoped>
.mo-login-container {
  width: 100%;
  height: 100vh;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  position: relative;
}

/* 1. 顶部背景图：固定高度，宽度自适应 */
.top-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 260px; /* 根据设计稿微调高度 */
  background-image: url('https://img-mando.610612.xyz/top_bg.png');
  background-size: 100% auto;
  background-repeat: no-repeat;
  background-position: top center;
  z-index: 1;
}

.mo-login-content {
  position: relative;
  z-index: 10;
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 40px;
}

.header {
  margin-top: 100px; /* Logo 距离顶部 100px */
  margin-bottom: 40px;
  display: flex;
  justify-content: center;
}

/* 2. Logo 样式：固定宽高 */
.mo-logo-img {
  width: 180px; 
  height: auto;
  display: block;
}

.subtitle {
  text-align: center;
  color: #999;
  font-size: 14px;
  margin-top: 10px;
}

.mo-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-top: 20px;
}

.mo-input {
  width: 100%;
  height: 50px;
  border: none;
  border-bottom: 1px solid #eee;
  font-size: 16px;
  outline: none;
  background: transparent;
  padding: 0;
}

/* 3. 按钮样式：HEX:46D180，文字白色 */
.mo-login-btn {
  margin-top: 40px;
  height: 54px;
  background-color: #46D180;
  color: #ffffff;
  border: none;
  border-radius: 12px;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(70, 209, 128, 0.2);
}

.mo-login-btn:active {
  opacity: 0.9;
}

/* 摄像头相关样式 */
.camera-layer {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.camera-header {
  padding: 60px 20px 30px;
  text-align: center;
  color: #fff;
}

.video-box {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-mask {
  position: relative;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid rgba(255,255,255,0.2);
}

video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera-footer {
  padding: 40px;
}

.capture-btn {
  width: 100%;
  height: 56px;
  background: #fff;
  color: #000;
  border: none;
  border-radius: 28px;
  font-size: 17px;
  font-weight: 600;
}

.footer {
  margin-top: auto;
  padding-bottom: env(safe-area-inset-bottom, 30px);
}

.location-text {
  color: #bbb;
  font-size: 11px;
  text-align: center;
}
</style>