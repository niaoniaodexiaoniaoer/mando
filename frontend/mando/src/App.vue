<template>
  <div id="app">
    <h1>Hello world again!</h1>
    <p class="version">
      Backend version: {{ version }}
    </p>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      version: 'loading...',
    }
  },
  async mounted() {
    try {
      const res = await fetch('/api/version')
      const data = await res.json()
      this.version = data.version || 'unknown'
    } catch (err) {
      console.error('Failed to fetch backend version:', err)
      this.version = 'error'
    }
  },
}
</script>

<style>
h1 {
  color: green;
}

.version {
  margin-top: 12px;
  font-size: 14px;
  color: #666;
}
</style>
