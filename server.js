// server.js
const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const cors = require('cors');
const path = require('path');

// SERVICE_ACCOUNT_PATH env var or fallback to local json
const SERVICE_ACCOUNT_PATH = process.env.SERVICE_ACCOUNT_PATH || path.join(__dirname, 'dhara-ba733-firebase-adminsdk-fbsvc-2a4b3bfa6b.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('Service account JSON not found at', SERVICE_ACCOUNT_PATH);
  console.error('Set SERVICE_ACCOUNT_PATH env var or place service account JSON at project root.');
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://dhara-ba733-default-rtdb.firebaseio.com'
});

const db = admin.database();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware: verify Firebase ID token
async function verifyIdToken(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).send('Missing or invalid auth header');
  const idToken = auth.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded;
    next();
  } catch (e) {
    console.error('Token verify error', e);
    return res.status(401).send('Invalid ID token: ' + (e.message || e));
  }
}

// POST /api/generate-report
// body: { plainData: {...}, encrypted: "...base64...", iv: "...base64..." }
app.post('/api/generate-report', verifyIdToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { plainData, encrypted, iv } = req.body;
    const ts = new Date().toISOString();

    // store encrypted blob to RTDB
    const ref = db.ref(`reports/${uid}/${Date.now()}`);
    await ref.set({
      timestamp: ts,
      ciphertext: encrypted,
      iv,
      meta: {
        uploadedBy: uid
      }
    });

    // generate docx from plainData
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({ children: [ new TextRun({ text: `DHARA Report`, bold: true, size: 32 }) ] }),
          new Paragraph({ text: `Generated: ${ts}`, spacing: { after: 200 } })
        ].concat(buildDocFromPlainData(plainData))
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=DHARA-report-${Date.now()}.docx`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error: ' + (err.message || err));
  }
});

function buildDocFromPlainData(data) {
  const out = [];
  try {
    out.push(new Paragraph({ text: 'Location: ' + (data.location && data.location.label ? data.location.label : 'N/A') , spacing: { after: 200 } }));
    out.push(new Paragraph({ text: 'Live data:', spacing:{ after: 120 } }));
    if (data.liveData) {
      Object.entries(data.liveData).forEach(([k,v]) => {
        out.push(new Paragraph({ text: ` - ${k}: ${v}` }));
      });
    }
    out.push(new Paragraph({ text: '', spacing:{ after: 120} }));
    out.push(new Paragraph({ text: 'Interventions:', spacing:{ after:120 } }));
    if (data.interventions && Array.isArray(data.interventions)) {
      data.interventions.forEach((it, idx) => {
        out.push(new Paragraph({ text: `${idx+1}. ${it.title} (${it.id}) - slider ${it.sliderValue}%` }));
        out.push(new Paragraph({ text: `    Center: ${it.center ? (it.center.lat + ',' + it.center.lng) : 'N/A'}` }));
        if (it.geom) {
          out.push(new Paragraph({ text: `    Geometry present (GeoJSON)` }));
        }
      });
    } else {
      out.push(new Paragraph({ text: '  (none)' }));
    }
  } catch (e) {
    out.push(new Paragraph({ text: 'Error serializing data: ' + (e.message || e) }));
  }
  return out;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server listening on', PORT);
  console.log('Make sure your Firebase Authorized domains include localhost if testing locally.');
});
