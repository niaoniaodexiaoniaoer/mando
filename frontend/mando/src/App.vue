<template>
  <div class="mando-app">
    <header class="mo-header">
      <div class="logo">M&O</div>
      <div class="subtitle">基础设施运维管理系统 v1.0</div>
    </header>

    <main class="mo-content">
      <section v-if="currentStep === 'login'" class="mo-card">
        <h2>人员签到</h2>
        <div class="mo-form">
          <div class="field">
            <label>值班人员</label>
            <select v-model="loginForm.user" class="mo-select">
              <option value="张三">张三 (Admin)</option>
              <option value="李四">李四 (UserA)</option>
              <option value="王五">王五 (UserB)</option>
            </select>
          </div>
          <div class="field">
            <label>认证口令</label>
            <input type="password" v-model="loginForm.pass" class="mo-input" placeholder="默认 admin">
          </div>
          <button @click="handleLogin" class="mo-btn primary">验证身份并获取位置</button>
        </div>
      </section>

      <section v-if="currentStep === 'camera'" class="mo-card">
        <h2>真人识别埋点</h2>
        <div class="video-container">
          <video ref="videoPlayer" autoplay playsinline class="mo-video"></video>
        </div>
        <button @click="captureAndSubmit" class="mo-btn success">立即拍摄并提交</button>
      </section>

      <section v-if="currentStep === 'result'" class="mo-card result">
        <div class="success-icon">✓</div>
        <h2>签到成功</h2>
        <div class="detail-list">
          <div class="item"><strong>人员:</strong> {{ loginForm.user }}</div>
          <div class="item"><strong>时间:</strong> {{ checkinTime }}</div>
          <div class="item"><strong>坐标:</strong> {{ location.lat.toFixed(4) }}, {{ location.lng.toFixed(4) }}</div>
        </div>
        <div class="mo-tags-section">
          <h4>权限标签：</h4>
          <div class="tag-container">
            <span v-for="tag in userTags" :key="tag" class="mo-tag">{{ tag }}</span>
          </div>
        </div>
        <img :src="finalPhoto" class="mo-photo" />
        <button @click="goToWorkflow" class="mo-btn primary" style="margin-top:20px">进入工作台</button>
      </section>

      <section v-if="currentStep === 'workflow'" class="mo-card">
        <header class="workflow-header">
          <div class="user-status">
            <span class="status-dot"></span>
            <strong>{{ loginForm.user }}</strong> (已签到)
          </div>
          <button @click="handleLogout" class="logout-link">退出重启</button>
        </header>

        <h2 style="text-align: left; margin-bottom: 20px;">任务选择</h2>
        <div class="workflow-grid">
          <div @click="handleTask('日常任务')" class="flow-item">
            <div class="icon">📋</div>
            <span>日常任务</span>
          </div>
          <div @click="handleTask('柴机维保')" class="flow-item">
            <div class="icon">⚙️</div>
            <span>柴机维保</span>
          </div>
          <div @click="handleTask('擦窗机维保')" class="flow-item">
            <div class="icon">🏗️</div>
            <span>擦窗机维保</span>
          </div>
          <div @click="handleTask('旋转门维保')" class="flow-item">
            <div class="icon">🚪</div>
            <span>旋转门维保</span>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

// 状态控制
const currentStep = ref('login')
const loginForm = reactive({ user: '张三', pass: '' })
const location = reactive({ lat: 0, lng: 0 })
const deviceInfo = reactive({ os: '', browser: '' })
const checkinTime = ref('')
const finalPhoto = ref('')
const userTags = ref([])
const videoPlayer = ref(null)
let streamInstance = null

// 用户配置
const USER_CONFIG = {
  '张三': { tags: ['系统设置', '全量审计', '卡园监控', '集电港监控', '科技园监控'] },
  '李四': { tags: ['卡园监控', '资产管理'] },
  '王五': { tags: ['科技园监控', '资产管理'] }
}

// 拦截逻辑：如果没有签到信息，强制回登录页
onMounted(() => {
  const isAuth = sessionStorage.getItem('mando_authenticated')
  if (!isAuth) {
    currentStep.value = 'login'
  }
})

const getFingerprint = () => {
  const ua = navigator.userAgent
  deviceInfo.os = /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Android/i.test(ua) ? 'Android' : 'PC'
  deviceInfo.browser = /MicroMessenger/i.test(ua) ? 'WeChat' : /Chrome/i.test(ua) ? 'Chrome' : 'Browser'
}

const handleLogin = () => {
  if (loginForm.pass !== 'admin') return alert('口令错误')
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      location.lat = pos.coords.latitude
      location.lng = pos.coords.longitude
      getFingerprint()
      userTags.value = USER_CONFIG[loginForm.user].tags
      currentStep.value = 'camera'
      startCamera()
    },
    () => alert('请授权位置信息，否则无法签到')
  )
}

const startCamera = async () => {
  try {
    streamInstance = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
    setTimeout(() => { if (videoPlayer.value) videoPlayer.value.srcObject = streamInstance }, 200)
  } catch (e) { alert('开启摄像头失败') }
}

const captureAndSubmit = async () => {
  const canvas = document.createElement('canvas')
  canvas.width = videoPlayer.value.videoWidth
  canvas.height = videoPlayer.value.videoHeight
  const ctx = canvas.getContext('2d')
  ctx.translate(canvas.width, 0); ctx.scale(-1, 1)
  ctx.drawImage(videoPlayer.value, 0, 0)
  
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
  finalPhoto.value = dataUrl
  checkinTime.value = new Date().toLocaleString()

  try {
    const blob = await (await fetch(dataUrl)).blob()
    const fd = new FormData()
    fd.append('photo', blob, 'chk.jpg')
    fd.append('user_name', loginForm.user)
    fd.append('lat', location.lat); fd.append('lng', location.lng)
    fd.append('os', deviceInfo.os); fd.append('browser', deviceInfo.browser)
    fd.append('checkin_time', checkinTime.value)
    await fetch('/api/checkin', { method: 'POST', body: fd })
    
    // 标记为已认证
    sessionStorage.setItem('mando_authenticated', 'true')
  } catch (err) { console.error('同步失败') }

  if (streamInstance) streamInstance.getTracks().forEach(t => t.stop())
  currentStep.value = 'result'
}

const goToWorkflow = () => { currentStep.value = 'workflow' }

const handleLogout = () => {
  sessionStorage.removeItem('mando_authenticated')
  currentStep.value = 'login'
  loginForm.pass = ''
}

const handleTask = (name) => {
  alert(`流程跳转中：${name}\n(下一阶段将开发此表单)`)
}
</script>

<style>
:root { --primary: #2563eb; --success: #16a34a; --bg: #f3f4f6; --dark: #1f2937; }
body { margin: 0; background: var(--bg); font-family: -apple-system, sans-serif; }
.mo-header { background: var(--dark); color: white; padding: 20px; text-align: center; }
.mo-content { padding: 15px; }
.mo-card { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 20px; }
.mo-select, .mo-input { width: 100%; padding: 12px; margin-bottom: 16px; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; font-size: 16px; }
.mo-btn { width: 100%; padding: 15px; border-radius: 8px; border: none; font-weight: bold; font-size: 16px; cursor: pointer; }
.mo-btn.primary { background: var(--primary); color: white; }
.mo-btn.success { background: var(--success); color: white; }

/* 视频与照片 */
.video-container { width: 100%; aspect-ratio: 3/4; background: #000; border-radius: 12px; overflow: hidden; margin-bottom: 20px; }
.mo-video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
.mo-photo { width: 100%; border-radius: 8px; margin-top: 15px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }

/* 标签与详情 */
.detail-list { background: #f9fafb; padding: 12px; border-radius: 8px; text-align: left; font-size: 14px; margin-bottom: 15px; }
.mo-tags-section { border-top: 1px dashed #ddd; padding-top: 10px; text-align: left; }
.tag-container { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.mo-tag { background: #e0e7ff; color: #4338ca; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; }

/* Workflow 专属样式 */
.workflow-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
.user-status { font-size: 14px; display: flex; align-items: center; }
.status-dot { width: 8px; height: 8px; background: var(--success); border-radius: 50%; margin-right: 6px; }
.logout-link { background: none; border: none; color: #ef4444; font-size: 14px; cursor: pointer; }
.workflow-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.flow-item { 
  background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 20px;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02); transition: all 0.2s;
}
.flow-item:active { transform: scale(0.95); background: #f9fafb; }
.flow-item .icon { font-size: 32px; }
.flow-item span { font-weight: 600; color: var(--dark); font-size: 14px; }
</style>