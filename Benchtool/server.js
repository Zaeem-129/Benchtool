require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const sharp = require('sharp');
const rateLimit = require('express-rate-limit');
const { PDFDocument } = require('pdf-lib');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', 1);

// Basic abuse protection: 40 requests per minute per IP
app.use('/api', rateLimit({ windowMs: 60_000, limit: 40, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a minute and try again.' } }));

// Files are kept in memory only and never saved to disk
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 20 } });
const clamp = (v, min, max, d) => { v = parseInt(v, 10); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d; };

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Image compress -> JPEG
app.post('/api/compress-image', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
    const quality = clamp(req.body.quality, 10, 95, 70);
    const maxWidth = clamp(req.body.maxWidth, 0, 8000, 0);
    let img = sharp(req.file.buffer).rotate();
    if (maxWidth) img = img.resize({ width: maxWidth, withoutEnlargement: true });
    const out = await img.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true }).toBuffer();
    res.type('image/jpeg').send(out);
  } catch (e) { next(e); }
});

// Image resize -> png / jpeg / webp
app.post('/api/resize-image', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
    const w = clamp(req.body.width, 1, 8000, 0), h = clamp(req.body.height, 1, 8000, 0);
    if (!w || !h) return res.status(400).json({ error: 'Enter a valid width and height.' });
    const fmt = ['png', 'jpeg', 'webp'].includes(req.body.format) ? req.body.format : 'png';
    let img = sharp(req.file.buffer).rotate().resize(w, h, { fit: 'fill' });
    if (fmt === 'jpeg') img = img.flatten({ background: '#ffffff' });
    const out = await img.toFormat(fmt, { quality: 92 }).toBuffer();
    res.type('image/' + fmt).send(out);
  } catch (e) { next(e); }
});

// PDF merge (files are merged in the order they were sent)
app.post('/api/merge-pdf', upload.array('files', 20), async (req, res, next) => {
  try {
    if (!req.files || req.files.length < 2) return res.status(400).json({ error: 'Send at least 2 PDF files.' });
    const merged = await PDFDocument.create();
    for (const f of req.files) {
      const src = await PDFDocument.load(f.buffer);
      (await merged.copyPages(src, src.getPageIndices())).forEach(p => merged.addPage(p));
    }
    res.type('application/pdf').send(Buffer.from(await merged.save()));
  } catch (e) { next(e); }
});


// Contact form -> email to the site owner
const contactLimit = rateLimit({ windowMs: 60 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many messages from this connection. Please try again later.' } });
const oneLine = (v, max) => String(v || '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);

app.post('/api/contact', contactLimit, express.json({ limit: '20kb' }), async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true });                      // honeypot: bots fill this hidden field
  const name = oneLine(b.name, 80), email = oneLine(b.email, 120), type = oneLine(b.type, 30) || 'Other';
  const message = String(b.message || '').trim().slice(0, 4000);
  if (!name || !message) return res.status(400).json({ error: 'Please enter your name and message.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS)
    return res.status(503).json({ error: 'Email service is not configured on the server.' });
  try {
    const transporter = nodemailer.createTransport(process.env.SMTP_HOST
      ? { host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT || 587, secure: +process.env.SMTP_PORT === 465,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
      : { service: 'gmail', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
    await transporter.sendMail({
      from: `"Benchtool Website" <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_TO || 'zaeembabar029@gmail.com',
      replyTo: `"${name.replace(/"/g, '')}" <${email}>`,
      subject: `[Benchtool] ${type} from ${name}`,
      text: `Type: ${type}\nName: ${name}\nEmail: ${email}\n\n${message}`
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('Mail error:', e.message);
    res.status(502).json({ error: 'Could not send the message right now.' });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 25 MB).' : 'Upload error: ' + err.message;
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: msg });
  }
  console.error(err.message);
  res.status(422).json({ error: 'Could not process this file. It may be damaged or password-protected.' });
});

app.listen(PORT, () => console.log('Benchtool running on http://localhost:' + PORT));
