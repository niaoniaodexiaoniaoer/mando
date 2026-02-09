<template>
  <div class="admin-wrapper">
    <aside class="sidebar">
      <div class="brand">M&O ADMIN</div>
      <nav>
        <div class="menu-item" :class="{active: tab==='users'}" @click="tab='users'">账号管理</div>
        <div class="menu-item" :class="{active: tab==='companies'}" @click="tab='companies'">单位管理</div>
        <div class="menu-item" :class="{active: tab==='roles'}" @click="tab='roles'">角色管理</div>
      </nav>
      <div class="user-bottom">
        <div class="u-info">{{ adminInfo.real_name || '管理员' }}</div>
        <div class="logout-link" @click="handleLogout">退出登录</div>
      </div>
    </aside>

    <section class="main-content">
      <header class="top-bar">
        <div class="page-title">{{ tabName }}</div>
        <button class="add-btn" @click="openAdd">新增{{ tabName.slice(0,2) }}</button>
      </header>

      <div class="workspace">
        <table class="grid-table">
          <thead>
            <tr v-if="tab==='users'">
              <th width="60">ID</th>
              <th>姓名</th>
              <th>账号</th>
              <th>密码</th>
              <th>单位名称</th>
              <th>单位ID</th>
              <th>角色名称</th>
              <th>角色ID</th>
              <th width="100">管理</th>
            </tr>
            <tr v-else-if="tab==='companies'">
              <th width="60">ID</th>
              <th>单位名称</th>
              <th width="100">管理</th>
            </tr>
            <tr v-else-if="tab==='roles'">
              <th width="60">ID</th>
              <th>角色名称</th>
              <th>角色KEY</th>
              <th width="100">管理</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in list" :key="item.id">
              <template v-if="tab==='users'">
                <td>{{ item.id }}</td>
                <td>{{ item.real_name }}</td>
                <td>{{ item.username }}</td>
                <td>{{ item.password }}</td>
                <td>{{ item.company_name }}</td>
                <td>{{ item.company_id }}</td>
                <td>{{ item.role_name }}</td>
                <td>{{ item.role_id }}</td>
              </template>
              <template v-else-if="tab==='companies'">
                <td>{{ item.id }}</td>
                <td>{{ item.name }}</td>
              </template>
              <template v-else-if="tab==='roles'">
                <td>{{ item.id }}</td>
                <td>{{ item.role_name }}</td>
                <td>{{ item.role_key }}</td>
              </template>
              <td class="ops">
                <span @click="handleEdit(item)">编辑</span>
                <span v-if="item.id !== 1" @click="handleDelete(item.id)">删除</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="showModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">{{ isEdit ? '编辑' : '新增' }}{{ tabName.slice(0,2) }}</div>
        <div class="modal-body">
          <template v-if="tab==='users'">
            <div class="field"><label>姓名</label><input v-model="form.real_name"></div>
            <div class="field"><label>账号</label><input v-model="form.username"></div>
            <div class="field"><label>密码</label><input v-model="form.password"></div>
            <div class="field">
              <label>单位</label>
              <select v-model="form.company_id">
                <option v-for="c in options.companies" :key="c.id" :value="c.id">{{c.name}}</option>
              </select>
            </div>
            <div class="field">
              <label>角色</label>
              <select v-model="form.role_id">
                <option v-for="r in options.roles" :key="r.id" :value="r.id">{{r.name}}</option>
              </select>
            </div>
          </template>
          <template v-else-if="tab==='companies'">
            <div class="field"><label>单位名称</label><input v-model="form.name"></div>
          </template>
          <template v-else-if="tab==='roles'">
            <div class="field"><label>角色名称</label><input v-model="form.role_name"></div>
            <div class="field"><label>角色KEY</label><input v-model="form.role_key"></div>
          </template>
        </div>
        <div class="modal-footer">
          <button @click="showModal=false">取消</button>
          <button class="save-btn" @click="save">提交</button>
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
const adminInfo = ref(JSON.parse(localStorage.getItem('user') || '{}'))

const tabName = computed(() => ({ users:'账号管理', companies:'单位管理', roles:'角色管理' }[tab.value]))

const fetchData = async () => {
  const res = await fetch(`/api/admin/${tab.value}`)
  list.value = await res.json()
  const optRes = await fetch('/api/admin/options')
  options.value = await optRes.json()
}

const handleLogout = () => {
  localStorage.removeItem('user')
  router.push('/login')
}

watch(tab, fetchData)
onMounted(() => {
  if (!adminInfo.value.username) router.push('/login')
  fetchData()
})

const openAdd = () => { isEdit.value = false; form.value = {}; showModal.value = true; }
const handleEdit = (item) => { isEdit.value = true; form.value = {...item}; showModal.value = true; }

const save = async () => {
  const method = isEdit.value ? 'PUT' : 'POST'
  const url = isEdit.value ? `/api/admin/${tab.value}/${form.value.id}` : `/api/admin/${tab.value}`
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form.value)
  })
  if (res.ok) { showModal.value = false; fetchData(); }
}

const handleDelete = async (id) => {
  if(!confirm('确认删除?')) return
  await fetch(`/api/admin/${tab.value}/${id}`, { method: 'DELETE' })
  fetchData()
}
</script>

<style scoped>
/* 1. 基础布局：全屏不缩放 */
.admin-wrapper { 
  display: flex; height: 100vh; width: 100%; 
  overflow: hidden; background: #fff; font-family: Arial, sans-serif;
}

/* 2. 侧边栏：固定宽度 180px */
.sidebar { 
  width: 180px; min-width: 180px; 
  background: #222; display: flex; flex-direction: column; 
}
.brand { padding: 25px; color: #fff; font-weight: bold; border-bottom: 1px solid #333; }
.menu-item { padding: 15px 25px; color: #aaa; cursor: pointer; font-size: 14px; }
.menu-item:hover { color: #fff; }
.menu-item.active { background: #444; color: #fff; }
.user-bottom { margin-top: auto; padding: 20px; border-top: 1px solid #333; }
.u-info { color: #666; font-size: 12px; margin-bottom: 5px; }
.logout-link { color: #aaa; font-size: 12px; cursor: pointer; text-decoration: underline; }

/* 3. 工作区：自适应 */
.main-content { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.top-bar { 
  padding: 15px 20px; display: flex; justify-content: space-between; 
  align-items: center; border-bottom: 1px solid #eee; 
}
.page-title { font-size: 16px; color: #333; font-weight: bold; }
.add-btn { background: #333; color: #fff; border: none; padding: 6px 12px; font-size: 12px; cursor: pointer; }

/* 4. 核心：带格子线的表格，左对齐，字号统一 */
.workspace { flex: 1; padding: 20px; overflow: auto; } /* 自动出现滚动条 */
.grid-table { 
  width: 100%; border-collapse: collapse; 
  table-layout: auto; /* 自动根据内容宽度调整 */
  border: 1px solid #eee;
}
.grid-table th, .grid-table td { 
  border: 1px solid #eee; /* 浅灰色格子线 */
  padding: 10px; text-align: left; 
  font-size: 13px; color: #333; 
  font-weight: normal; /* 取消所有加粗 */
  white-space: nowrap;
}
.grid-table th { background: #f9f9f9; color: #666; }
.grid-table tr:hover { background: #fcfcfc; }

/* 5. 管理操作样式 */
.ops span { color: #666; cursor: pointer; margin-right: 10px; text-decoration: underline; }
.ops span:hover { color: #000; }

/* 6. 弹窗极简 */
.modal-overlay { 
  position: fixed; inset: 0; background: rgba(0,0,0,0.3); 
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal-content { background: #fff; width: 350px; padding: 25px; border: 1px solid #eee; }
.modal-header { font-weight: bold; margin-bottom: 15px; font-size: 14px; }
.field { margin-bottom: 12px; }
.field label { display: block; font-size: 12px; color: #666; margin-bottom: 3px; }
.field input, .field select { width: 100%; padding: 6px; border: 1px solid #ddd; outline: none; }
.modal-footer { margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px; }
.modal-footer button { padding: 5px 15px; cursor: pointer; font-size: 12px; background: #fff; border: 1px solid #ddd; }
.save-btn { background: #333 !important; color: #fff !important; border: none !important; }
</style>