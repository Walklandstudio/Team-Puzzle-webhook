require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());             // JSON body
app.use(express.urlencoded({ extended: true })); // just in case

// tie-break priority when percents are equal
const prio = { R:6, HC:5, Y:4, T:3, HF:2, M:1 };

// helper to coerce 0..100 numbers
const num = v => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
};

// HighLevel API client
const HL = axios.create({
  baseURL: process.env.HL_BASE_URL || 'https://services.leadconnectorhq.com',
  headers: {
    'Authorization': `Bearer ${process.env.HL_API_KEY}`,
    'Version': process.env.HL_API_VERSION || '2021-07-28',
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(process.env.HL_LOCATION_ID ? { 'LocationId': process.env.HL_LOCATION_ID } : {})
  },
});

app.post('/rank', async (req, res) => {
  try {
    // auth
    const provided = req.headers['x-api-key'];
    if (!process.env.API_KEY || provided !== process.env.API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // read payload from GHL custom data
    const { contactId } = req.body || {};
    if (!contactId) return res.status(400).json({ error: 'Missing contactId' });

    const scores = {
      R:  num(req.body.R_pct),
      HC: num(req.body.HC_pct),
      Y:  num(req.body.Y_pct),
      T:  num(req.body.T_pct),
      HF: num(req.body.HF_pct),
      M:  num(req.body.M_pct),
    };

    // sort by score desc, then by priority desc
    const order = Object.entries(scores)
      .sort((a, b) => (b[1] - a[1]) || (prio[b[0]] - prio[a[0]]))
      .map(([k]) => k);

    const payload = {
      natural1:   order[0],
      natural2:   order[1],
      neutral1:   order[2],
      neutral2:   order[3],
      unnatural1: order[5],
      unnatural2: order[4],
      order
    };

    // write back to contact custom fields (IDs come from GHL → Settings → Custom Fields or the API)
    await HL.put(`/contacts/${contactId}`, {
      customFields: [
        { id: process.env.FIELD_NAT1, value: payload.natural1 },
        { id: process.env.FIELD_NAT2, value: payload.natural2 },
        { id: process.env.FIELD_NEU1, value: payload.neutral1 },
        { id: process.env.FIELD_NEU2, value: payload.neutral2 },
        { id: process.env.FIELD_UNN1, value: payload.unnatural1 },
        { id: process.env.FIELD_UNN2, value: payload.unnatural2 }
      ]
    });

    // also return JSON so you can see it in webhook logs
    res.json(payload);

  } catch (err) {
    console.error('rank error:', err.response?.data || err.message);
    res.status(500).json({ error: 'server_error', detail: err.response?.data || err.message });
  }
});

app.get('/health', (_req, res) => res.send('ok'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('ranker on :' + PORT));
