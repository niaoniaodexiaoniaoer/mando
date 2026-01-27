<template>
  <div id="app">
    <h1>Hello world again!</h1>
    <p>Backend version: {{ version }}</p>
    <p>Environment: {{ env }}</p>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      version: 'loading...',
      env: import.meta.env.MODE
    };
  },
  async mounted() {
    try {
      const res = await fetch('/api/version');
      const data = await res.json();
      this.version = data.version;
    } catch (e) {
      this.version = 'error';
    }
  }
};
</script>

<style>
h1 {
  color: green;
}
</style>
