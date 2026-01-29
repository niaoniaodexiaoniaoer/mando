<template>
  <div class="mando-app">
    <header class="mo-header">
      <div class="logo">M&O</div>
      <div class="subtitle">基础设施运维管理系统 v1.0</div>
    </header>

    <main class="mo-content">
      <section v-if="currentStep === 'login'" class="mo-card">
        <h2>系统登录</h2>
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
          <button @click="handleLogin" class="mo-btn primary">验证身份</button>
        </div>
      </section>

      <section v-if="currentStep === 'workflow'" class="mo-card">
        <header class="workflow-header">
          <div class="user-status">
            <span class="status-dot"></span>
            <strong>{{ loginForm.user }}</strong>
          </div>
          <button @click="handleLogout" class="logout-link">安全退出</button>
        </header>
        <h2 style="text-align: left; margin-bottom: 20px;">任务选择</h2>
        <div class="workflow-grid">
          <div @click="handleTask('日常任务')" class="flow-item">
            <div class="icon">📋</div><span>日常任务</span>
          </div>
          <div @click="handleTask('柴机维保')" class="flow-item">
            <div class="icon">⚙️</div><span>柴机维保</span>
          </div>
          <div @click="handleTask('擦窗机维保')" class="flow-item">
            <div class="icon">🏗️</div><span>擦窗机维保</span>
          </div>
          <div @click="handleTask('旋转门维保')" class="flow-item">
            <div class="icon">🚪</div><span>旋转门维保</span>
          </div>
        </div>
      </section>

      <section v-if="currentStep === 'camera'" class="mo-card">
        <h2>现场存证</h2>
        <div class="video-container">
          <video ref="videoPlayer" autoplay playsinline class="mo-video"></video>
        </div>
        <button @click="captureAndSubmit" class="mo-btn success">拍摄并进入安全教育</button>
      </section>

      <section v-if="currentStep === 'safety'" class="mo-card">
        <h2>安全教育视频</h2>
        <p style="font-size:12px; color:#ef4444; margin-bottom:10px;">* 必须完整观看视频方可签署告知书</p>
        <div class="video-container">
          <iframe 
            width="100%" height="100%" 
            src="https://www.youtube.com/embed/E7HsXbtcHhM?enablejsapi=1&rel=0" 
            frameborder="0" allowfullscreen
          ></iframe>
        </div>
        <button @click="currentStep = 'signature'" class="mo-btn primary">我已观看并去签署告知书</button>
      </section>

      <section v-if="currentStep === 'signature'" class="mo-card">
        <h2>技术安全交底签署</h2>
        <p style="font-size:12px; color:#666; margin-bottom:10px;">请在下方空白处横向签署姓名</p>
        <div class="sig-wrapper">
          <canvas 
            ref="sigCanvas" 
            @touchstart="startDrawing" 
            @touchmove="draw" 
            @touchend="stopDrawing"
            class="sig-canvas"
          ></canvas>
        </div>
        <div class="mo-btn-group" style="display:flex; gap:10px; margin-top:15px;">
          <button @click="clearCanvas" class="mo-btn" style="background:#6b7280; color:white;">重写</button>
          <button @click="submitSignature" class="mo-btn success">确认提交并生成PDF</button>
        </div>
      </section>

      <section v-if="currentStep === 'result'" class="mo-card result">
        <div class="success-icon">✓</div>
        <h2>流程已开启</h2>
        <div class="detail-list">
          <div class="item"><strong>人员:</strong> {{ loginForm.user }}</div>
          <div class="item"><strong>任务:</strong> {{ activeTask }}</div>
          <div class="item"><strong>PDF凭证:</strong> <a :href="signedPdfUrl" target="_blank">查看签署文件</a></div>
        </div>
        <button @click="currentStep = 'workflow'" class="mo-btn primary">返回工作台</button>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

const currentStep = ref('login')
const activeTask = ref('')
const loginForm = reactive({ user: '张三', pass: '' })
const location = reactive({ lat: 0, lng: 0 })
const signedPdfUrl = ref('')
const finalPhoto = ref('')
const userTags = ref([])
const videoPlayer = ref(null)
const sigCanvas = ref(null)
let streamInstance = null
let isDrawing = false

const USER_CONFIG = {
  '张三': { tags: ['系统设置', '全量审计', '卡园监控', '集电港监控', '科技园监控'] },
  '李四': { tags: ['卡园监控', '资产管理'] },
  '王五': { tags: ['科技园监控', '资产管理'] }
}

onMounted(() => {
  const isAuth = localStorage.getItem('mando_auth')
  if (isAuth === 'true') {
    loginForm.user = localStorage.getItem('mando_user')
    userTags.value = JSON.parse(localStorage.getItem('mando_tags') || '[]')
    currentStep.value = 'workflow'
  }
})

const handleLogin = () => {
  if (loginForm.pass !== 'admin') return alert('口令错误')
  localStorage.setItem('mando_auth', 'true')
  localStorage.setItem('mando_user', loginForm.user)
  userTags.value = USER_CONFIG[loginForm.user].tags
  localStorage.setItem('mando_tags', JSON.stringify(userTags.value))
  currentStep.value = 'workflow'
}

const handleLogout = () => {
  localStorage.clear(); currentStep.value = 'login'; loginForm.pass = ''
}

const handleTask = (name) => {
  activeTask.value = name
  navigator.geolocation.getCurrentPosition((pos) => {
    location.lat = pos.coords.latitude; location.lng = pos.coords.longitude
    currentStep.value = 'camera'
    startCamera()
  }, () => alert('请授权位置信息'))
}

const startCamera = async () => {
  try {
    streamInstance = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
    setTimeout(() => { if (videoPlayer.value) videoPlayer.value.srcObject = streamInstance }, 200)
  } catch (e) { alert('开启摄像头失败') }
}

const captureAndSubmit = async () => {
  const canvas = document.createElement('canvas')
  canvas.width = videoPlayer.value.videoWidth; canvas.height = videoPlayer.value.videoHeight
  const ctx = canvas.getContext('2d')
  ctx.translate(canvas.width, 0); ctx.scale(-1, 1); ctx.drawImage(videoPlayer.value, 0, 0)
  finalPhoto.value = canvas.toDataURL('image/jpeg', 0.8)

  if (streamInstance) streamInstance.getTracks().forEach(t => t.stop())
  currentStep.value = 'safety' // 拍照后进入安全教育
}

// 签名逻辑实现
const startDrawing = (e) => {
  isDrawing = true
  const ctx = sigCanvas.value.getContext('2d')
  ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#000'
  const rect = sigCanvas.value.getBoundingClientRect()
  ctx.beginPath()
  ctx.moveTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top)
}

const draw = (e) => {
  if (!isDrawing) return
  const ctx = sigCanvas.value.getContext('2d')
  const rect = sigCanvas.value.getBoundingClientRect()
  ctx.lineTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top)
  ctx.stroke()
}

const stopDrawing = () => { isDrawing = false }

const clearCanvas = () => {
  const ctx = sigCanvas.value.getContext('2d')
  ctx.clearRect(0, 0, sigCanvas.value.width, sigCanvas.value.height)
}

const submitSignature = async () => {
  const sigBase64 = sigCanvas.value.toDataURL('image/png')
  try {
    const res = await fetch('/api/save-signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: loginForm.user,
        task: activeTask.value,
        signatureBase64: sigBase64
      })
    })
    const data = await res.json()
    if (data.success) {
      signedPdfUrl.value = data.pdf_url
      currentStep.value = 'result'
    }
  } catch (e) { alert('生成PDF失败') }
}
</script>

<style>
/* 继承之前的样式并新增签名样式 */
:root { --primary: #2563eb; --success: #16a34a; --bg: #f3f4f6; --dark: #1f2937; }
body { margin: 0; background: var(--bg); font-family: -apple-system, sans-serif; }
.mo-header { background: var(--dark); color: white; padding: 20px; text-align: center; }
.mo-content { padding: 15px; }
.mo-card { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 20px; }
.mo-select, .mo-input { width: 100%; padding: 12px; margin-bottom: 16px; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; font-size: 16px; }
.mo-btn { width: 100%; padding: 15px; border-radius: 8px; border: none; font-weight: bold; font-size: 16px; cursor: pointer; }
.mo-btn.primary { background: var(--primary); color: white; }
.mo-btn.success { background: var(--success); color: white; }

.video-container { width: 100%; aspect-ratio: 9/16; background: #000; border-radius: 12px; overflow: hidden; margin-bottom: 20px; }
.mo-video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }

.sig-wrapper { width: 100%; height: 200px; background: #f9fafb; border: 2px dashed #d1d5db; border-radius: 8px; touch-action: none; }
.sig-canvas { width: 100%; height: 100%; }

.workflow-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
.status-dot { width: 8px; height: 8px; background: var(--success); border-radius: 50%; display: inline-block; margin-right: 5px; }
.logout-link { background: none; border: none; color: #ef4444; font-size: 14px; }
.workflow-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.flow-item { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.flow-item .icon { font-size: 30px; }
.mo-tag { background: #e0e7ff; color: #4338ca; padding: 4px 10px; border-radius: 12px; font-size: 11px; margin: 2px; display: inline-block; }
</style>