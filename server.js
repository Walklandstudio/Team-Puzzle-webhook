require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());

const priority = { R: 6, HC: 5, Y: 4, T: 3, HF: 2, M: 1 };

app.post('/rank', (req, res) => {
  const provided = req.headers['x-api-key'];
  if (!process.env.API_KEY || provided !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  };

  const s = {
    R:  num(req.body?.R_pct),
    HC: num(req.body?.HC_pct),
    Y:  num(req.body?.Y_pct),
    T:  num(req.body?.T_pct),
    HF: num(req.body?.HF_pct),
    M:  num(req.body?.M_pct),
  };

  const order = Object.entries(s)
    .sort((a, b) => (b[1] - a[1]) || (priority[b[0]] - priority[a[0]]))
    .map(([k]) => k);

  res.json({
    natural1: order[0],
    natural2: order[1],
    neutral1: order[2],
    neutral2: order[3],
    unnatural1: order[5],
    unnatural2: order[4],
    order
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('ranker on :' + PORT));
