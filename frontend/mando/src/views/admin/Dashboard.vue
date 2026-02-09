<template>
  <div class="admin-wrapper">
    <aside class="sidebar">
      <div class="brand">M&O ADMIN</div>
      <nav>
        <div class="menu-item" :class="{active: tab==='users'}" @click="tab='users'">账号管理</div>
        <div class="menu-item" :class="{active: tab==='companies'}" @click="tab='companies'">单位管理</div>
        <div class="menu-item" :class="{active: tab==='roles'}" @click="tab='roles'">角色管理</div>
        <div class="menu-item" :class="{active: tab==='logs'}" @click="tab='logs'">登录日志</div>
      </nav>
      <div class="user-bottom">
        <div class="u-info">{{ adminInfo.real_name || '管理员' }}</div>
        <div class="logout-link" @click="handleLogout">退出登录</div>
      </div>
    </aside>

    <section class="main-content">
      <header class="top-bar">
        <div class="page-title">
          {{ tabName }} 
          <small v-if="tab==='logs' && logProbe.count" style="margin-left:10px; opacity:0.5; font-size:12px;">
            (共 {{ logProbe.count }} 条)
          </small>
        </div>

        <div v-if="tab === 'logs' && logProbe.triggered" class="probe-alert">
          ⚠️ {{ logProbe.message }}
        </div>

        <button v-if="tab !== 'logs'" class="add-btn" @click="openAdd">
          新增{{ tabName.slice(0,2) }}
        </button>
      </header>

      <div class="workspace">
        <div class="scroll-container">
          <table class="grid-table">
            <thead>
              <tr v-if="tab==='users'">
                <th width="60">ID</th>
                <th>姓名</th>
                <th>手机号</th>
                <th>账号</th>
                <th>密码</th>
                <th>单位名称</th>
                <th>单位ID</th>
                <th>角色名称</th>
                <th>角色ID</th>
                <th width="100">操作</th>
              </tr>
              <tr v-else-if="tab==='companies'">
                <th width="80">ID</th>
                <th>单位名称</th>
                <th width="100">操作</th>
              </tr>
              <tr v-else-if="tab==='roles'">
                <th width="80">ID</th>
                <th>角色名称</th>
                <th>角色Key</th>
                <th width="100">操作</th>
              </tr>
              <tr v-else-if="tab==='logs'">
                <th width="50">ID</th>
                <th>采集人员</th>
                <th>合规自拍</th>
                <th>登录时间</th>
                <th>地理位置</th>
                <th>认证状态</th>
                <th>IP/设备信息</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in list" :key="item.id">
                <template v-if="tab==='users'">
                  <td>{{ item.id }}</td>
                  <td>{{ item.real_name }}</td>
                  <td>{{ item.phone }}</td>
                  <td>{{ item.username }}</td>
                  <td class="pwd-mask">******</td>
                  <td>{{ item.company_name }}</td>
                  <td>{{ item.company_id }}</td>
                  <td>{{ item.role_name }}</td>
                  <td>{{ item.role_id }}</td>
                  <td class="ops">
                    <span @click="openEdit(item)">修改</span>
                    <span @click="doDelete(item.id)">删除</span>
                  </td>
                </template>

                <template v-else-if="tab==='companies'">
                  <td>{{ item.id }}</td>
                  <td>{{ item.name }}</td>
                  <td class="ops">
                    <span @click="openEdit(item)">修改</span>
                    <span @click="doDelete(item.id)">删除</span>
                  </td>
                </template>

                <template v-else-if="tab==='roles'">
                  <td>{{ item.id }}</td>
                  <td>{{ item.role_name }}</td>
                  <td><code>{{ item.role_key }}</code></td>
                  <td class="ops">
                    <span @click="doDelete(item.id)">删除</span>
                  </td>
                </template>

                <template v-else-if="tab==='logs'">
                  <td>{{ item.id }}</td>
                  <td>
                    <b>{{ item.real_name }}</b><br>
                    <small class="sub-text">{{ item.username }}</small>
                  </td>
                  <td>
                    <img 
                      v-if="item.photo_url" 
                      :src="item.photo_url" 
                      class="log-thumb" 
                      @click="previewImg = item.photo_url"
                    >
                    <span v-else class="no-photo">无采集</span>
                  </td>
                  <td class="time-font">{{ item.login_time }}</td>
                  <td><span class="loc-tag">{{ item.location }}</span></td>
                  <td>
                    <span :class="['status-tag', item.status]">
                      {{ item.status === 'SUCCESS' ? '认证成功' : '认证失败' }}
                    </span>
                  </td>
                  <td class="device-cell">
                    <code>{{ item.ip_address }}</code>
                    <div class="ua-text" :title="item.device_info">{{ item.device_info }}</div>
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <div v-if="previewImg" class="img-modal-overlay" @click="previewImg = null">
      <div class="img-modal-content">
        <img :src="previewImg">
        <p>点击空白处关闭</p>
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">{{ isEdit ? '修改记录' : '新增记录' }}</div>
        <div class="modal-body">
          <div v-if="tab==='users'">
            <div class="field"><label>姓名</label><input v-model="form.real_name"></div>
            <div class="field"><label>手机号</label><input v-model="form.phone"></div>
            <div class="field"><label>账号</label><input v-model="form.username"></div>
            <div class="field"><label>密码</label><input v-model="form.password" type="password"></div>
            <div class="field">
              <label>所属单位</label>
              <select v-model="form.company_id">
                <option v-for="c in options.companies" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div class="field">
              <label>系统角色</label>
              <select v-model="form.role_id">
                <option v-for="r in options.roles" :key="r.id" :value="r.id">{{ r.name }}</option>
              </select>
            </div>
          </div>
          <div v-else-if="tab==='companies'">
            <div class="field"><label>单位名称</label><input v-model="form.name"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showModal=false">取消</button>
          <button class="primary" @click="doSave">确定保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const tab = ref('users')
const list = ref([])
const options = ref({ roles: [], companies: [] })
const showModal = ref(false)
const isEdit = ref(false)
const form = ref({})
const logProbe = ref({ triggered: false, count: 0, message: '' })
const previewImg = ref(null)

const adminInfo = JSON.parse(localStorage.getItem('user') || '{}')

const tabName = computed(() => {
  return { users: '账号管理', companies: '单位管理', roles: '角色管理', logs: '登录日志' }[tab.value]
})

const fetchData = async () => {
  try {
    const res = await fetch(`/api/admin/${tab.value}`)
    const json = await res.json()
    
    // 针对日志接口的特殊处理
    if (tab.value === 'logs') {
      list.value = json.data
      logProbe.value = json.probe
    } else {
      list.value = json
    }
  } catch (e) {
    console.error('Fetch error:', e)
  }
}

const fetchOptions = async () => {
  const res = await fetch('/api/admin/options')
  options.value = await res.json()
}

const openAdd = () => {
  isEdit.value = false
  form.value = tab.value === 'users' 
    ? { real_name: '', phone: '', username: '', password: '', role_id: 1, company_id: 1 } 
    : { name: '' }
  showModal.value = true
}

const openEdit = (item) => {
  isEdit.value = true
  form.value = { ...item }
  showModal.value = true
}

const doSave = async () => {
  const method = isEdit.value ? 'PUT' : 'POST'
  const url = isEdit.value ? `/api/admin/${tab.value}/${form.value.id}` : `/api/admin/${tab.value}`
  
  await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form.value)
  })
  showModal.value = false
  fetchData()
}

const doDelete = async (id) => {
  if (!confirm('确定删除该记录吗？')) return
  await fetch(`/api/admin/${tab.value}/${id}`, { method: 'DELETE' })
  fetchData()
}

const handleLogout = () => {
  localStorage.removeItem('user')
  router.push('/login')
}

watch(tab, () => {
  fetchData()
})

onMounted(() => {
  fetchData()
  fetchOptions()
})
</script>

<style scoped>
/* 原有基础布局样式保持一致... */
.admin-wrapper { display: flex; height: 100vh; background: #f4f4f4; }
.sidebar { width: 220px; background: #000; color: #fff; display: flex; flex-direction: column; }
.brand { padding: 30px 20px; font-size: 18px; font-weight: 900; letter-spacing: 1px; }
.menu-item { padding: 15px 20px; cursor: pointer; font-size: 14px; opacity: 0.6; transition: 0.3s; }
.menu-item:hover, .menu-item.active { opacity: 1; background: #222; }
.user-bottom { margin-top: auto; padding: 20px; border-top: 1px solid #333; }
.logout-link { font-size: 12px; margin-top: 10px; color: #ff4d4f; cursor: pointer; }

.main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.top-bar { height: 70px; background: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 30px; border-bottom: 1px solid #eee; }
.add-btn { background: #000; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; }

/* 日志探针样式 */
.probe-alert { background: #fff2f0; color: #ff4d4f; padding: 6px 15px; border-radius: 20px; font-size: 12px; border: 1px solid #ffccc7; animation: pulse 2s infinite; }
@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.7; } 100% { opacity: 1; } }

.workspace { flex: 1; padding: 20px; overflow: auto; }
.grid-table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #eee; }
.grid-table th, .grid-table td { border: 1px solid #eee; padding: 12px; text-align: left; font-size: 13px; }
.grid-table th { background: #f9f9f9; color: #888; font-weight: 500; }
.grid-table tr:hover { background: #fcfcfc; }

/* 日志列表专用样式 */
.log-thumb { width: 45px; height: 45px; object-fit: cover; border-radius: 4px; cursor: zoom-in; border: 1px solid #eee; }
.sub-text { color: #999; font-size: 11px; }
.time-font { font-family: 'Courier New', Courier, monospace; color: #666; font-size: 12px; }
.loc-tag { background: #f0f5ff; color: #2f54eb; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
.status-tag { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
.status-tag.SUCCESS { background: #f6ffed; color: #52c41a; border: 1px solid #b7eb8f; }
.status-tag.FAILED { background: #fff2f0; color: #ff4d4f; border: 1px solid #ffccc7; }
.device-cell { max-width: 200px; }
.ua-text { font-size: 10px; color: #bbb; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 4px; }
.no-photo { color: #ccc; font-style: italic; font-size: 12px; }

/* 图片预览 Modal */
.img-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 200; cursor: zoom-out; }
.img-modal-content { text-align: center; }
.img-modal-content img { max-width: 90vw; max-height: 80vh; border: 5px solid #fff; border-radius: 4px; }
.img-modal-content p { color: #fff; margin-top: 15px; font-size: 13px; opacity: 0.5; }

/* 通用弹窗样式保持原样 */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-content { background: #fff; width: 400px; padding: 30px; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
.modal-header { font-size: 16px; font-weight: bold; margin-bottom: 20px; }
.field { margin-bottom: 15px; }
.field label { display: block; font-size: 12px; color: #999; margin-bottom: 5px; }
.field input, .field select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 25px; }
.modal-footer button { padding: 8px 20px; border-radius: 4px; border: 1px solid #ddd; cursor: pointer; }
.modal-footer button.primary { background: #000; color: #fff; border: none; }
.ops span { color: #1890ff; cursor: pointer; margin-right: 12px; font-size: 12px; text-decoration: underline; }
</style>