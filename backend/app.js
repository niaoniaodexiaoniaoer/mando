const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello world again!');
});

app.listen(port, () => {
  console.log(`Backend is running at http://localhost:${port}`);
});
