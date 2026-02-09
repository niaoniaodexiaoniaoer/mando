<template>
  <div class="mando-app">
    <header class="mo-header">
      <div class="logo">M&O</div>
      <div class="subtitle">基础设施运维管理系统 v1.3</div>
    </header>

    <main class="mo-content">
      <section v-if="currentStep === 'login'" class="mo-card">
        <h2>系统登录</h2>
        <div class="mo-form">
          <div class="field">
            <label>值班人员</label>
            <select v-model="loginForm.user" class="mo-select">
              <option v-for="(cfg, name) in USER_CONFIG" :key="name" :value="name">{{ name }}</option>
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
          <div class="user-status"><span class="status-dot"></span><strong>{{ loginForm.user }}</strong></div>
          <button @click="handleLogout" class="logout-link">安全退出</button>
        </header>
        <div class="workflow-grid">
          <div v-for="(info, type) in TASK_TYPES" :key="type" @click="initWorkOrder(type)" class="flow-item">
            <div class="icon">{{ info.icon }}</div><span>{{ info.label }}</span>
          </div>
        </div>
      </section>

      <section v-if="currentStep === 'camera'" class="mo-card">
        <h2>入场存证拍照</h2>
        <div class="video-container">
          <video ref="videoPlayer" autoplay playsinline class="mo-video"></video>
        </div>
        <button @click="captureAndSubmit" class="mo-btn success">拍摄并进入安全教育</button>
      </section>

      <section v-if="currentStep === 'safety'" class="mo-card">
        <h2>安全教育：{{ activeTaskLabel }}</h2>
        <div class="video-container">
          <iframe width="100%" height="100%" src="https://www.youtube.com/embed/E7HsXbtcHhM?enablejsapi=1" frameborder="0"></iframe>
        </div>
        <button @click="currentStep = 'signature'" class="mo-btn primary">去签署交底告知书</button>
      </section>

      <section v-if="currentStep === 'signature'" class="mo-card">
        <h2>电子签名确认</h2>
        <div class="sig-wrapper">
          <canvas ref="sigCanvas" @touchstart="startDrawing" @touchmove="draw" @touchend="stopDrawing" class="sig-canvas"></canvas>
        </div>
        <div class="mo-btn-group" style="display:flex; gap:10px; margin-top:15px;">
          <button @click="clearCanvas" class="mo-btn" style="background:#6b7280; color:white;">重写</button>
          <button @click="submitSignature" class="mo-btn success">确认并开启任务</button>
        </div>
      </section>

      <section v-if="currentStep === 'task_grid'" class="mo-card">
        <header class="workflow-header">
          <strong>{{ activeTaskLabel }} - 实施看板</strong>
          <button @click="currentStep = 'workflow'" class="logout-link">返回</button>
        </header>
        <div class="task-grid">
          <div v-for="sub in subTasks" :key="sub.id" 
               class="task-card" :class="sub.status.toLowerCase()"
               @click="openSubTask(sub)">
            <div class="task-title">{{ sub.sub_name }}</div>
            <div class="task-status-tag">{{ sub.status }}</div>
            <div class="task-meta">已传照片: {{ sub.log_data.photos.length }}</div>
          </div>
        </div>
        <button v-if="isAllCompleted" @click="finishAll" class="mo-btn success" style="margin-top:20px">全部完工并填写总结</button>
      </section>

      <div v-if="activeSub" class="mo-drawer">
        <div class="mo-card">
          <h3>{{ activeSub.sub_name }} - 维护记录</h3>
          <textarea v-model="subForm.remark" class="mo-input" placeholder="输入现场情况描述..."></textarea>
          <div class="photo-uploader">
            <input type="file" multiple accept="image/*" @change="handleSubPhotos" id="sub-photo-input" hidden>
            <label for="sub-photo-input" class="mo-btn" style="background:#eee; color:#333; margin-bottom:10px; display:block; text-align:center;">📷 拍摄/上传照片</label>
            <div class="photo-preview">
              <img v-for="p in activeSub.log_data.photos" :key="p" :src="p" class="thumb">
            </div>
          </div>
          <div class="mo-btn-group" style="display:flex; gap:10px;">
            <button @click="activeSub = null" class="mo-btn" style="flex:1">取消</button>
            <button @click="updateSubTask('COMPLETED')" class="mo-btn success" style="flex:1">确认完工</button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'

// --- 配置常量 ---
const USER_CONFIG = {
  '张三': { tags: ['管理员', '全量审计'] },
  '李四': { tags: ['卡园监控', '现场主管'] },
  '王五': { tags: ['厂商人员', '维保实施'] }
}
const TASK_TYPES = {
  'window': { label: '擦窗机维保', icon: '🏗️', subs: ['A楼擦窗机', 'B楼擦窗机', 'C楼擦窗机'] },
  'door': { label: '旋转门维保', icon: '🚪', subs: ['1号旋转门', '2号旋转门', '3号旋转门', '4号旋转门'] },
  'diesel': { label: '柴机维保', icon: '⚙️', subs: Array.from({length: 9}, (_, i) => `${i+1}号发电机组`) }
}

// --- 状态变量 ---
const currentStep = ref('login')
const activeOrderId = ref(null)
const activeTaskType = ref('')
const subTasks = ref([])
const activeSub = ref(null)
const loginForm = reactive({ user: '张三', pass: '' })
const userTags = ref([])
const sigCanvas = ref(null)
const videoPlayer = ref(null)
const subForm = reactive({ remark: '', files: [] })
let streamInstance = null
let isDrawing = false

const activeTaskLabel = computed(() => TASK_TYPES[activeTaskType.value]?.label || '')
const isAllCompleted = computed(() => subTasks.value.length > 0 && subTasks.value.every(s => s.status === 'COMPLETED'))

// --- 逻辑函数 ---
onMounted(() => {
  if (localStorage.getItem('mando_auth') === 'true') {
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

const handleLogout = () => { localStorage.clear(); currentStep.value = 'login' }

// 初始化主工单
const initWorkOrder = async (type) => {
  activeTaskType.value = type
  try {
    const res = await fetch('/api/work-orders/start', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        type, creator: loginForm.user, assignee: '王五',
        subTasks: TASK_TYPES[type].subs
      })
    })
    const data = await res.json()
    activeOrderId.value = data.orderId
    currentStep.value = 'camera'
    startCamera()
  } catch (e) { alert('开启工单失败') }
}

const startCamera = async () => {
  streamInstance = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
  setTimeout(() => { if (videoPlayer.value) videoPlayer.value.srcObject = streamInstance }, 200)
}

const captureAndSubmit = () => {
  if (streamInstance) streamInstance.getTracks().forEach(t => t.stop())
  currentStep.value = 'safety'
}

// 签名与PDF提交
const submitSignature = async () => {
  const sigBase64 = sigCanvas.value.toDataURL('image/png')
  const res = await fetch('/api/save-signature', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      user: loginForm.user, task: activeTaskLabel.value,
      signatureBase64: sigBase64, orderId: activeOrderId.value
    })
  })
  const data = await res.json()
  if (data.success) {
    await refreshSubTasks()
    currentStep.value = 'task_grid'
  }
}

// 子任务管理
const refreshSubTasks = async () => {
  const res = await fetch(`/api/work-orders/${activeOrderId.value}`)
  const data = await res.json()
  subTasks.value = data.sub_tasks
}

const openSubTask = (sub) => {
  activeSub.value = sub
  subForm.remark = sub.log_data.remark
}

const handleSubPhotos = (e) => { subForm.files = Array.from(e.target.files) }

const updateSubTask = async (status) => {
  const fd = new FormData()
  fd.append('remark', subForm.remark)
  fd.append('status', status)
  subForm.files.forEach(f => fd.append('photos', f))

  await fetch(`/api/sub-tasks/${activeSub.value.id}/update`, { method: 'POST', body: fd })
  activeSub.value = null
  await refreshSubTasks()
}

// 签名绘图辅助
const startDrawing = (e) => {
  isDrawing = true
  const ctx = sigCanvas.value.getContext('2d')
  const rect = sigCanvas.value.getBoundingClientRect()
  ctx.beginPath(); ctx.moveTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top)
}
const draw = (e) => {
  if (!isDrawing) return
  const ctx = sigCanvas.value.getContext('2d'), rect = sigCanvas.value.getBoundingClientRect()
  ctx.lineTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top); ctx.stroke()
}
const stopDrawing = () => isDrawing = false
const clearCanvas = () => {
  const ctx = sigCanvas.value.getContext('2d')
  ctx.clearRect(0,0,sigCanvas.value.width, sigCanvas.value.height)
}
</script>

<style>
/* 保持原有样式，新增 Grid 与 Card 样式 */
.task-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 15px; }
.task-card { background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 15px; position: relative; }
.task-card.completed { border-left: 5px solid var(--success); background: #f0fdf4; }
.task-card.running { border-left: 5px solid var(--primary); background: #eff6ff; }
.task-status-tag { font-size: 10px; font-weight: bold; text-transform: uppercase; margin: 5px 0; color: #666; }
.task-meta { font-size: 11px; color: #999; }
.mo-drawer { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; z-index: 100; }
.photo-preview { display: flex; gap: 5px; overflow-x: auto; margin-top: 10px; }
.thumb { width: 60px; height: 60px; object-fit: cover; border-radius: 4px; }
.sig-wrapper { width: 100%; height: 200px; background: #fff; border: 1px solid #ddd; touch-action: none; }
.sig-canvas { width: 100%; height: 100%; }
</style>