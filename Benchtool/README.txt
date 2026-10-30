Benchtool - Full Stack (HTML + Node.js backend)

RUN LOCALLY
1. Install Node.js 18+ from https://nodejs.org
2. EXTRACT this zip first, then open a terminal inside the folder
3. npm install
4. npm start
5. Open http://localhost:3000

CONTACT FORM - EASIEST WAY (recommended, no password, works even without the server)
1. Go to https://formspree.io and sign up with zaeembabar029@gmail.com (free plan: 50 messages/month)
2. Click "New Form", name it Benchtool. Confirm the verification email Formspree sends you.
3. Copy the form link (looks like https://formspree.io/f/abcdwxyz)
4. Open public/index.html, find the line  const FORMSPREE_URL='';  and paste the link between the quotes
5. Save. Every review/suggestion/complaint now arrives in your Gmail automatically.

CONTACT FORM - OTHER WAY (Gmail App Password, needs the Node server)
Messages are sent to zaeembabar029@gmail.com. For the server to send email you need a Gmail "App Password":
1. Google Account > Security > turn ON 2-Step Verification
2. Google Account > Security > App passwords > create one (16 letters)
3. Copy ".env.example" to a new file named ".env" and paste the App Password in SMTP_PASS
4. Restart with: npm start
(Do NOT use your normal Gmail password, and never upload .env to GitHub.)
Without this setup the form still works: it opens the visitor's email app with the message filled in.

DEPLOY (Render.com, free tier)
- Upload this folder to GitHub (node_modules and .env are not needed)
- On Render: New > Web Service > pick the repo
- Build command: npm install     Start command: npm start
- Environment tab: add SMTP_USER and SMTP_PASS there

NOTES
- With the backend running, PDF Merge, Image Compress, Image Resize and the Contact form use the server.
- If you open public/index.html directly (no server), the tools still work in the browser.
- Uploaded files stay in memory only and are never saved. Limits: 25 MB per file, 40 requests/min per IP, 5 contact messages/hour per IP.
