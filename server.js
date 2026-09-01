// Active Staffing Resources — demo platform server, built with Node core `http` only
// (no external packages required — npm registry access was unavailable in the build sandbox).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { get, save } = require('./db');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---- very small session store (token -> userId), token sent as cookie ----
const sessions = new Map();

function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

function getSessionUser(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/sid=([a-f0-9]+)/);
  if (!match) return null;
  const userId = sessions.get(match[1]);
  if (!userId) return null;
  const db = get();
  return db.users.find(u => u.id === userId) || null;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

// ---- shared header/footer partials, injected server-side so pages render
// complete on first paint (no client-side fetch, no layout jump/flicker) ----
const PARTIALS_DIR = path.join(PUBLIC_DIR, 'partials');
let headerPartial = '';
let footerPartial = '';
let dashTopbarPartial = '';
let dashAccountModalPartial = '';
function loadPartials() {
  try { headerPartial = fs.readFileSync(path.join(PARTIALS_DIR, 'header.html'), 'utf8'); } catch (e) { headerPartial = ''; }
  try { footerPartial = fs.readFileSync(path.join(PARTIALS_DIR, 'footer.html'), 'utf8'); } catch (e) { footerPartial = ''; }
  try { dashTopbarPartial = fs.readFileSync(path.join(PARTIALS_DIR, 'dash-topbar.html'), 'utf8'); } catch (e) { dashTopbarPartial = ''; }
  try { dashAccountModalPartial = fs.readFileSync(path.join(PARTIALS_DIR, 'dash-account-modal.html'), 'utf8'); } catch (e) { dashAccountModalPartial = ''; }
}
loadPartials();

function markActiveNav(headerHtml, urlPath) {
  const navKey = urlPath === '/' ? '/' : urlPath;
  // add class="active" to the one <a data-nav="..."> matching the current page
  return headerHtml.replace(
    new RegExp(`(<a href="[^"]*" data-nav="${navKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}")>`),
    '$1 class="active">'
  );
}

function injectPartials(html, urlPath) {
  if (html.indexOf('<div id="site-header"></div>') !== -1) {
    html = html.replace('<div id="site-header"></div>', markActiveNav(headerPartial, urlPath));
  }
  if (html.indexOf('<div id="site-footer"></div>') !== -1) {
    html = html.replace('<div id="site-footer"></div>', footerPartial);
  }
  // dashboard shell (agency/client/candidate): shared top bar with the "My Account"
  // menu (change password + log out), and its change-password modal
  if (html.indexOf('<div id="dash-topbar"></div>') !== -1) {
    html = html.replace('<div id="dash-topbar"></div>', dashTopbarPartial);
  }
  if (html.indexOf('<div id="dash-account-modal"></div>') !== -1) {
    html = html.replace('<div id="dash-account-modal"></div>', dashAccountModalPartial);
  }
  return html;
}

// ---- clean routes (no .html in the URL) ----
// e.g. /about serves public/about.html, /job/5 serves public/job.html
// (job.html reads the id from the path — see public/job.html's jobIdFromUrl()).
// Old-style /about.html links still work too (falls through to the plain
// file lookup below), so nothing that already links to a .html path breaks.
const CLEAN_ROUTES = {
  '/about': 'about.html',
  '/services': 'services.html',
  '/employers': 'employers.html',
  '/job-seekers': 'job-seekers.html',
  '/blogs': 'blogs.html',
  '/contact': 'contact.html',
  '/register': 'register.html',
  '/login': 'login.html',
  '/jobs': 'jobs.html',
  '/agency': 'agency.html',
  '/client': 'client.html',
  '/candidate': 'candidate.html'
};

function resolveCleanRoute(urlPath) {
  if (urlPath === '/') return 'index.html';
  if (CLEAN_ROUTES[urlPath]) return CLEAN_ROUTES[urlPath];
  if (/^\/job\/\d+$/.test(urlPath)) return 'job.html';
  return null;
}

function serveStatic(req, res, urlPath) {
  const cleanTarget = resolveCleanRoute(urlPath);
  let filePath = path.join(PUBLIC_DIR, cleanTarget || urlPath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    if (ext === '.html') {
      // dev convenience: re-read partials each request so header/footer edits
      // show up immediately without restarting the server
      loadPartials();
      const finalHtml = injectPartials(content.toString('utf8'), urlPath === '/' ? '/' : urlPath);
      res.writeHead(200, { 'Content-Type': MIME[ext] });
      return res.end(finalHtml);
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

function publicCandidateShape(c) {
  // Never leak email/phone/rate to anyone but the agency and the candidate themselves.
  const { name, title, location, skills, experienceYears, status } = c;
  return { id: c.id, name, title, location, skills, experienceYears, status };
}

function clientBillRate(placement) {
  return Math.round(placement.dailyRate * (1 + placement.agencyMarkupPercent / 100));
}

// -------------------- API handlers --------------------

async function handleApi(req, res, urlPath) {
  const db = get();
  const method = req.method;

  // ---- AUTH ----
  if (urlPath === '/api/login' && method === 'POST') {
    const { email, password } = await readBody(req);
    const user = db.users.find(u => u.email.toLowerCase() === String(email || '').toLowerCase() && u.password === password);
    if (!user) return sendJson(res, 401, { error: 'That email and password combination doesn’t match our records.' });
    const token = makeToken();
    sessions.set(token, user.id);
    res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; Path=/; SameSite=Lax`);
    const { password: _pw, ...safeUser } = user;
    return sendJson(res, 200, { user: safeUser });
  }

  if (urlPath === '/api/logout' && method === 'POST') {
    const cookie = req.headers.cookie || '';
    const match = cookie.match(/sid=([a-f0-9]+)/);
    if (match) sessions.delete(match[1]);
    res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0');
    return sendJson(res, 200, { ok: true });
  }

  // ---- candidate self-registration (public) ----
  if (urlPath === '/api/register' && method === 'POST') {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !body.password || !body.name) return sendJson(res, 400, { error: 'Name, email and password are required.' });
    if (db.users.some(u => u.email.toLowerCase() === email)) {
      return sendJson(res, 409, { error: 'An account with this email already exists. Try logging in instead.' });
    }
    const userId = db.nextId.users++;
    const user = { id: userId, role: 'candidate', name: body.name, email, password: body.password };
    db.users.push(user);
    const candidate = {
      id: db.nextId.candidates++,
      userId,
      name: body.name,
      email,
      phone: body.phone || '',
      title: body.title || '',
      location: body.location || '',
      skills: (body.skills || '').split(',').map(s => s.trim()).filter(Boolean),
      experienceYears: Number(body.experienceYears) || 0,
      rate: 0,
      status: 'pending_review',
      summary: body.summary || '',
      linkedin: body.linkedin || '',
      source: 'self-registered',
      appliedAt: new Date().toISOString().slice(0, 10)
    };
    db.candidates.push(candidate);
    save();
    const token = makeToken();
    sessions.set(token, userId);
    res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; Path=/; SameSite=Lax`);
    const { password: _pw, ...safeUser } = user;
    return sendJson(res, 201, { user: safeUser });
  }

  // ---- public job board (anonymized — client identity stays confidential pre-placement) ----
  if (urlPath === '/api/public/jobs' && method === 'GET') {
    const open = db.jobRequests.filter(j => j.status === 'open').map(j => ({
      id: j.id, title: j.title, description: j.description, skillsNeeded: j.skillsNeeded,
      employmentType: j.employmentType, location: j.location, industry: j.industry,
      payPerDay: j.budgetPerDay, createdAt: j.createdAt, client: 'Confidential client — ' + j.industry
    }));
    return sendJson(res, 200, open);
  }

  // ---- public lead capture (employer inquiries from the marketing site) ----
  if (urlPath === '/api/contact' && method === 'POST') {
    const body = await readBody(req);
    if (!body.name || !body.email || !body.message) return sendJson(res, 400, { error: 'Please fill in your name, email and message.' });
    const inquiry = {
      id: db.nextId.inquiries++,
      name: body.name, company: body.company || '', email: body.email, phone: body.phone || '',
      serviceType: body.serviceType === 'advisory' ? 'advisory' : 'staffing',
      message: body.message, status: 'new', submittedAt: new Date().toISOString().slice(0, 10)
    };
    db.inquiries.push(inquiry);
    save();
    return sendJson(res, 201, { ok: true });
  }

  // everything below requires auth
  const user = getSessionUser(req);
  if (urlPath === '/api/me') {
    if (!user) return sendJson(res, 200, { user: null });
    const { password: _pw, ...safeUser } = user;
    return sendJson(res, 200, { user: safeUser });
  }
  if (!user) return sendJson(res, 401, { error: 'Not logged in' });

  // ---- change own password (agency, client, or candidate — from the "My Account" menu) ----
  if (urlPath === '/api/me/password' && method === 'POST') {
    const { currentPassword, newPassword } = await readBody(req);
    if (!currentPassword || !newPassword) return sendJson(res, 400, { error: 'Enter your current password and a new password.' });
    if (String(newPassword).length < 6) return sendJson(res, 400, { error: 'New password must be at least 6 characters.' });
    if (user.password !== currentPassword) return sendJson(res, 401, { error: 'Current password is incorrect.' });
    user.password = newPassword;
    save();
    return sendJson(res, 200, { ok: true });
  }

  // ---- CANDIDATES (private directory — agency only; candidates see only their own record) ----
  if (urlPath === '/api/candidates' && method === 'GET') {
    if (user.role === 'agency') return sendJson(res, 200, db.candidates);
    if (user.role === 'candidate') return sendJson(res, 200, db.candidates.filter(c => c.userId === user.id));
    return sendJson(res, 403, { error: 'Candidate profiles are private to Active Staffing Resources.' });
  }

  if (urlPath === '/api/candidates' && method === 'POST') {
    if (user.role !== 'agency') return sendJson(res, 403, { error: 'Only agency staff can add candidates directly.' });
    const body = await readBody(req);
    const candidate = {
      id: db.nextId.candidates++,
      userId: null,
      name: body.name,
      email: body.email,
      phone: body.phone || '',
      title: body.title || '',
      location: body.location || '',
      skills: (body.skills || '').split(',').map(s => s.trim()).filter(Boolean),
      experienceYears: Number(body.experienceYears) || 0,
      status: 'available',
      rate: Number(body.rate) || 0,
      summary: body.summary || '',
      linkedin: body.linkedin || '',
      source: 'agency-sourced',
      appliedAt: new Date().toISOString().slice(0, 10)
    };
    db.candidates.push(candidate);
    save();
    return sendJson(res, 201, candidate);
  }

  if (urlPath.match(/^\/api\/candidates\/\d+$/) && method === 'PATCH') {
    if (user.role !== 'agency') return sendJson(res, 403, { error: 'Only agency staff can update candidate records.' });
    const id = Number(urlPath.split('/')[3]);
    const candidate = db.candidates.find(c => c.id === id);
    if (!candidate) return sendJson(res, 404, { error: 'Not found' });
    const body = await readBody(req);
    if (body.status) candidate.status = body.status;
    if (body.rate !== undefined) candidate.rate = Number(body.rate) || candidate.rate;
    save();
    return sendJson(res, 200, candidate);
  }

  // ---- JOB REQUESTS ----
  if (urlPath === '/api/job-requests' && method === 'GET') {
    if (user.role === 'client') return sendJson(res, 200, db.jobRequests.filter(j => j.clientId === user.id));
    return sendJson(res, 200, db.jobRequests); // agency sees all
  }

  if (urlPath === '/api/job-requests' && method === 'POST') {
    if (user.role !== 'client') return sendJson(res, 403, { error: 'Only client companies can post job requests.' });
    const body = await readBody(req);
    const job = {
      id: db.nextId.jobRequests++,
      clientId: user.id,
      title: body.title,
      description: body.description,
      skillsNeeded: (body.skillsNeeded || '').split(',').map(s => s.trim()).filter(Boolean),
      employmentType: body.employmentType || 'Temporary',
      location: body.location || 'Remote (US)',
      industry: user.industry || 'General',
      budgetPerDay: Number(body.budgetPerDay) || 0,
      status: 'open',
      createdAt: new Date().toISOString().slice(0, 10)
    };
    db.jobRequests.push(job);
    save();
    return sendJson(res, 201, job);
  }

  // ---- APPLICATIONS (candidate applies to a public job posting; agency reviews) ----
  if (urlPath === '/api/applications' && method === 'GET') {
    if (user.role === 'agency') {
      const enriched = db.applications.map(a => ({
        ...a,
        candidate: db.candidates.find(c => c.id === a.candidateId),
        job: db.jobRequests.find(j => j.id === a.jobRequestId)
      }));
      return sendJson(res, 200, enriched);
    }
    if (user.role === 'candidate') {
      const myCandidateIds = db.candidates.filter(c => c.userId === user.id).map(c => c.id);
      const mine = db.applications.filter(a => myCandidateIds.includes(a.candidateId)).map(a => ({
        ...a,
        job: db.jobRequests.find(j => j.id === a.jobRequestId)
      }));
      return sendJson(res, 200, mine);
    }
    return sendJson(res, 403, { error: 'Not available for this role.' });
  }

  if (urlPath === '/api/applications' && method === 'POST') {
    if (user.role !== 'candidate') return sendJson(res, 403, { error: 'Only registered candidates can apply.' });
    const body = await readBody(req);
    const candidate = db.candidates.find(c => c.userId === user.id);
    if (!candidate) return sendJson(res, 400, { error: 'Complete your candidate profile before applying.' });
    if (candidate.status === 'pending_review') return sendJson(res, 403, { error: 'Your profile is still under review. You can apply once an ASR recruiter approves it.' });
    const job = db.jobRequests.find(j => j.id === Number(body.jobRequestId));
    if (!job || job.status !== 'open') return sendJson(res, 400, { error: 'This position is no longer accepting applications.' });
    if (db.applications.some(a => a.candidateId === candidate.id && a.jobRequestId === job.id)) {
      return sendJson(res, 409, { error: 'You already applied to this position.' });
    }
    const application = { id: db.nextId.applications++, jobRequestId: job.id, candidateId: candidate.id, status: 'submitted', appliedAt: new Date().toISOString().slice(0, 10), note: '' };
    db.applications.push(application);
    save();
    return sendJson(res, 201, application);
  }

  if (urlPath.match(/^\/api\/applications\/\d+\/status$/) && method === 'POST') {
    if (user.role !== 'agency') return sendJson(res, 403, { error: 'Agency only.' });
    const id = Number(urlPath.split('/')[3]);
    const application = db.applications.find(a => a.id === id);
    if (!application) return sendJson(res, 404, { error: 'Not found' });
    const body = await readBody(req);
    if (!['shortlisted', 'rejected', 'submitted'].includes(body.status)) return sendJson(res, 400, { error: 'Invalid status' });
    application.status = body.status;
    save();
    return sendJson(res, 200, application);
  }

  // ---- PLACEMENTS (agency matches candidate -> job request, sets billing) ----
  if (urlPath === '/api/placements' && method === 'GET') {
    if (user.role === 'client') {
      const mine = db.placements.filter(p => p.clientId === user.id).map(p => {
        const cand = db.candidates.find(c => c.id === p.candidateId);
        const job = db.jobRequests.find(j => j.id === p.jobRequestId);
        return {
          id: p.id, jobTitle: job ? job.title : '', startDate: p.startDate, status: p.status,
          billRatePerDay: clientBillRate(p),
          candidate: cand ? publicCandidateShape(cand) : null
        };
      });
      return sendJson(res, 200, mine);
    }
    if (user.role === 'candidate') {
      const myCandidateIds = db.candidates.filter(c => c.userId === user.id).map(c => c.id);
      const mine = db.placements.filter(p => myCandidateIds.includes(p.candidateId)).map(p => {
        const client = db.users.find(u => u.id === p.clientId);
        const job = db.jobRequests.find(j => j.id === p.jobRequestId);
        return { id: p.id, jobTitle: job ? job.title : '', clientCompany: client ? client.company : 'Confidential', dailyRate: p.dailyRate, startDate: p.startDate, status: p.status };
      });
      return sendJson(res, 200, mine);
    }
    return sendJson(res, 200, db.placements); // agency — full detail including markup
  }

  if (urlPath === '/api/placements' && method === 'POST') {
    if (user.role !== 'agency') return sendJson(res, 403, { error: 'Only agency staff can create placements.' });
    const body = await readBody(req);
    const job = db.jobRequests.find(j => j.id === Number(body.jobRequestId));
    const candidate = db.candidates.find(c => c.id === Number(body.candidateId));
    if (!job || !candidate) return sendJson(res, 400, { error: 'Invalid job or candidate' });
    const markup = Number(body.agencyMarkupPercent) || 20;
    const dailyRate = Number(body.dailyRate) || candidate.rate;
    const placement = {
      id: db.nextId.placements++,
      jobRequestId: job.id,
      candidateId: candidate.id,
      clientId: job.clientId,
      dailyRate,
      agencyMarkupPercent: markup,
      startDate: new Date().toISOString().slice(0, 10),
      status: 'active'
    };
    db.placements.push(placement);
    job.status = 'fulfilled';
    candidate.status = 'placed';
    const application = db.applications.find(a => a.candidateId === candidate.id && a.jobRequestId === job.id);
    if (application) application.status = 'placed';
    save();
    return sendJson(res, 201, placement);
  }

  // ---- ENGAGEMENTS (Outsourced Bookkeeping & Advisory division — ongoing service, not a staffing placement) ----
  if (urlPath === '/api/engagements' && method === 'GET') {
    if (user.role === 'client') {
      const mine = db.engagements.filter(e => e.clientId === user.id).map(e => {
        const cand = db.candidates.find(c => c.id === e.assignedCandidateId);
        return { ...e, assignedCandidate: cand ? publicCandidateShape(cand) : null };
      });
      return sendJson(res, 200, mine);
    }
    if (user.role === 'agency') return sendJson(res, 200, db.engagements);
    return sendJson(res, 403, { error: 'Not available for this role.' });
  }

  if (urlPath === '/api/engagements' && method === 'POST') {
    if (user.role !== 'agency') return sendJson(res, 403, { error: 'Only agency staff can set up an engagement.' });
    const body = await readBody(req);
    const client = db.users.find(u => u.id === Number(body.clientId) && u.role === 'client');
    if (!client) return sendJson(res, 400, { error: 'Invalid client' });
    const engagement = {
      id: db.nextId.engagements++,
      clientId: client.id,
      serviceType: body.serviceType || 'Outsourced Bookkeeping',
      description: body.description || '',
      assignedCandidateId: body.assignedCandidateId ? Number(body.assignedCandidateId) : null,
      monthlyFee: Number(body.monthlyFee) || 0,
      status: 'active',
      startDate: new Date().toISOString().slice(0, 10)
    };
    if (engagement.assignedCandidateId) {
      const cand = db.candidates.find(c => c.id === engagement.assignedCandidateId);
      if (cand) cand.status = 'placed';
    }
    db.engagements.push(engagement);
    save();
    return sendJson(res, 201, engagement);
  }

  // ---- INVOICES / BILLING (against either a staffing placement or an advisory engagement) ----
  if (urlPath === '/api/invoices' && method === 'GET') {
    if (user.role === 'client') return sendJson(res, 200, db.invoices.filter(i => i.clientId === user.id));
    return sendJson(res, 200, db.invoices); // agency
  }

  if (urlPath === '/api/invoices' && method === 'POST') {
    if (user.role !== 'agency') return sendJson(res, 403, { error: 'Only agency staff can issue invoices.' });
    const body = await readBody(req);
    if (body.source === 'engagement') {
      const engagement = db.engagements.find(e => e.id === Number(body.engagementId));
      if (!engagement) return sendJson(res, 400, { error: 'Invalid engagement' });
      const invoice = {
        id: db.nextId.invoices++,
        source: 'engagement',
        engagementId: engagement.id,
        clientId: engagement.clientId,
        amount: Number(body.amount) || engagement.monthlyFee,
        period: body.period || 'Current period',
        status: 'unpaid',
        issuedAt: new Date().toISOString().slice(0, 10)
      };
      db.invoices.push(invoice);
      save();
      return sendJson(res, 201, invoice);
    }
    const placement = db.placements.find(p => p.id === Number(body.placementId));
    if (!placement) return sendJson(res, 400, { error: 'Invalid placement' });
    const clientRate = clientBillRate(placement);
    const days = Number(body.days) || 22;
    const invoice = {
      id: db.nextId.invoices++,
      source: 'placement',
      placementId: placement.id,
      clientId: placement.clientId,
      amount: Math.round(clientRate * days),
      period: body.period || 'Current period',
      status: 'unpaid',
      issuedAt: new Date().toISOString().slice(0, 10)
    };
    db.invoices.push(invoice);
    save();
    return sendJson(res, 201, invoice);
  }

  if (urlPath.match(/^\/api\/invoices\/\d+\/pay$/) && method === 'POST') {
    if (user.role !== 'client') return sendJson(res, 403, { error: 'Only the client can mark an invoice paid.' });
    const id = Number(urlPath.split('/')[3]);
    const invoice = db.invoices.find(i => i.id === id && i.clientId === user.id);
    if (!invoice) return sendJson(res, 404, { error: 'Not found' });
    invoice.status = 'paid';
    save();
    return sendJson(res, 200, invoice);
  }

  // ---- LEADS / INQUIRIES (agency only) ----
  if (urlPath === '/api/inquiries' && method === 'GET') {
    if (user.role !== 'agency') return sendJson(res, 403, { error: 'Agency only.' });
    return sendJson(res, 200, db.inquiries);
  }

  if (urlPath.match(/^\/api\/inquiries\/\d+\/status$/) && method === 'POST') {
    if (user.role !== 'agency') return sendJson(res, 403, { error: 'Agency only.' });
    const id = Number(urlPath.split('/')[3]);
    const inquiry = db.inquiries.find(i => i.id === id);
    if (!inquiry) return sendJson(res, 404, { error: 'Not found' });
    const body = await readBody(req);
    inquiry.status = body.status || inquiry.status;
    save();
    return sendJson(res, 200, inquiry);
  }

  // ---- REPORTS / ANALYTICS ----
  if (urlPath === '/api/reports/summary' && method === 'GET') {
    if (user.role !== 'agency') return sendJson(res, 403, { error: 'Agency only' });
    const totalCandidates = db.candidates.length;
    const pendingReview = db.candidates.filter(c => c.status === 'pending_review').length;
    const placedCandidates = db.candidates.filter(c => c.status === 'placed').length;
    const activeClients = new Set(db.jobRequests.map(j => j.clientId)).size;
    const openJobs = db.jobRequests.filter(j => j.status === 'open').length;
    const totalRevenue = db.invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
    const pendingRevenue = db.invoices.filter(i => i.status === 'unpaid').reduce((s, i) => s + i.amount, 0);
    const activePlacements = db.placements.filter(p => p.status === 'active').length;
    const activeEngagements = db.engagements.filter(e => e.status === 'active').length;
    const monthlyRecurring = db.engagements.filter(e => e.status === 'active').reduce((s, e) => s + e.monthlyFee, 0);
    const newApplications = db.applications.filter(a => a.status === 'submitted').length;
    const newInquiries = db.inquiries.filter(i => i.status === 'new').length;
    return sendJson(res, 200, {
      totalCandidates, pendingReview, placedCandidates, activeClients, openJobs,
      totalRevenue, pendingRevenue, activePlacements, activeEngagements, monthlyRecurring,
      newApplications, newInquiries
    });
  }

  if (urlPath === '/api/clients' && method === 'GET') {
    if (user.role !== 'agency') return sendJson(res, 403, { error: 'Agency only' });
    return sendJson(res, 200, db.users.filter(u => u.role === 'client').map(({ password, ...u }) => u));
  }

  return sendJson(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];
  if (urlPath === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }
  if (urlPath.startsWith('/api/')) {
    try {
      await handleApi(req, res, urlPath);
    } catch (e) {
      console.error(e);
      sendJson(res, 500, { error: 'Server error' });
    }
    return;
  }
  serveStatic(req, res, urlPath);
});

server.listen(PORT, () => {
  console.log(`Active Staffing Resources demo running at http://localhost:${PORT}`);
});
