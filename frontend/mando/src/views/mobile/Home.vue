<template>
  <div class="mo-home">
    <header class="mo-header">M&O</header>
    
    <div class="mo-grid">
      <div class="mo-card" @click="goOrder('generator')">
        <div class="card-icon">⚡</div>
        <div class="card-title">柴油发电机维护</div>
        <div class="badge">99</div>
      </div>
      <div class="mo-card" @click="goOrder('gondola')">
        <div class="card-icon">🏗️</div>
        <div class="card-title">擦窗机维护</div>
        <div class="badge">99</div>
      </div>
      <div class="mo-card" @click="goOrder('door')">
        <div class="card-icon">🚪</div>
        <div class="card-title">旋转门维护</div>
        <div class="badge">99</div>
      </div>
      <div class="mo-card" @click="goOrder('other')">
        <div class="card-icon">🛠️</div>
        <div class="card-title">其它维护</div>
      </div>
    </div>

    <nav class="mo-tabbar">
      <div class="tab-item active"><span>首页</span></div>
      <div class="tab-item"><span>消息</span></div>
      <div class="tab-item"><span>工单</span></div>
      <div class="tab-item"><span>我的</span></div>
    </nav>
  </div>
</template>

<style scoped>
.mo-home { height: 100vh; background: #fff; padding: 20px; box-sizing: border-box; }
.mo-header { font-size: 24px; font-weight: 900; margin-bottom: 30px; letter-spacing: 2px; }
.mo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.mo-card { 
  background: #000; color: #fff; height: 160px; border-radius: 12px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  position: relative; transition: 0.2s;
}
.mo-card:active { transform: scale(0.95); }
.card-icon { font-size: 40px; margin-bottom: 10px; }
.card-title { font-size: 14px; font-weight: 600; }
.badge {
  position: absolute; top: 10px; right: 10px; background: #ff4d4f;
  color: #fff; font-size: 12px; padding: 2px 6px; border-radius: 10px;
}
.mo-tabbar {
  position: fixed; bottom: 0; left: 0; right: 0; height: 60px;
  display: flex; border-top: 1px solid #eee; background: #fff;
}
.tab-item { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #999; }
.tab-item.active { color: #000; font-weight: bold; }
</style>