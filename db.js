// Simple file-backed JSON "database" — no external dependencies needed.
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');

function seed() {
  return {
    users: [
      { id: 1, role: 'agency', name: 'Joseph Vernachio', title: 'Managing Partner', email: 'joseph@activestaffingresources.com', password: 'admin123' },
      { id: 2, role: 'client', name: 'Dianne Torres', title: 'Office Manager', company: 'Rivermark Consulting', industry: 'Pharmaceutical Marketing & Consulting', email: 'dianne.torres@rivermarkconsulting.com', password: 'client123' },
      { id: 3, role: 'client', name: 'James Kowalski', title: 'Director of Operations', company: 'Westbridge Builders', industry: 'Construction', email: 'james.kowalski@westbridgebuilders.com', password: 'client123' },
      { id: 4, role: 'candidate', name: 'Laura Petrocelli', email: 'laura.petrocelli@gmail.com', password: 'cand123' },
      { id: 5, role: 'candidate', name: 'Robert Hannigan', email: 'robert.hannigan@gmail.com', password: 'cand123' }
    ],
    candidates: [
      {
        id: 1, userId: 4, name: 'Laura Petrocelli', email: 'laura.petrocelli@gmail.com', phone: '(215) 555-0138',
        title: 'Bookkeeper', location: 'Doylestown, PA', skills: ['QuickBooks Online', 'Accounts Payable', 'Accounts Receivable', 'Payroll'],
        experienceYears: 5, rate: 260, status: 'available', summary: 'Full-charge bookkeeper with five years supporting small construction and professional-services firms.',
        linkedin: 'linkedin.com/in/laura-petrocelli', source: 'self-registered', appliedAt: '2026-07-08'
      },
      {
        id: 2, userId: 5, name: 'Robert Hannigan', email: 'robert.hannigan@gmail.com', phone: '(609) 555-0164',
        title: 'Controller', location: 'Doylestown, PA', skills: ['GAAP', 'Financial Reporting', 'Internal Controls', 'QuickBooks Online'],
        experienceYears: 9, rate: 520, status: 'available', summary: 'Controller-level accountant who has run month-end close and reporting for two mid-size construction companies.',
        linkedin: 'linkedin.com/in/robert-hannigan-cpa', source: 'self-registered', appliedAt: '2026-07-22'
      },
      {
        id: 3, userId: null, name: 'Michelle Ferraro', email: 'michelle.ferraro@outlook.com', phone: '(732) 555-0119',
        title: 'Office Manager', location: 'Trenton, NJ', skills: ['Office Administration', 'AP/AR', 'HR Coordination', 'QuickBooks'],
        experienceYears: 8, rate: 300, status: 'available', summary: 'Office manager who has run day-to-day operations, light bookkeeping, and HR coordination for a construction company.',
        linkedin: 'linkedin.com/in/michelle-ferraro', source: 'agency-sourced', appliedAt: '2026-06-18'
      },
      {
        id: 4, userId: null, name: 'Anthony Delvecchio', email: 'anthony.delvecchio@icloud.com', phone: '(302) 555-0177',
        title: 'Operations Supervisor', location: 'Wilmington, DE', skills: ['Production Scheduling', 'Team Leadership', 'Inventory Control', 'Lean Manufacturing'],
        experienceYears: 7, rate: 340, status: 'placed', summary: 'Manufacturing operations supervisor with a track record of hitting throughput targets on tight timelines.',
        linkedin: 'linkedin.com/in/anthony-delvecchio', source: 'agency-sourced', appliedAt: '2026-06-05'
      },
      {
        id: 5, userId: null, name: 'Christine Bianchi', email: 'christine.bianchi@gmail.com', phone: '(215) 555-0142',
        title: 'Human Resources Manager', location: 'New Britain, PA', skills: ['Employee Relations', 'Onboarding', 'HRIS', 'Compliance'],
        experienceYears: 6, rate: 310, status: 'available', summary: 'HR manager experienced running the full employee lifecycle for a 60-person company.',
        linkedin: 'linkedin.com/in/christine-bianchi-hr', source: 'agency-sourced', appliedAt: '2026-07-14'
      }
    ],
    jobRequests: [
      {
        id: 1, clientId: 3, title: 'Bookkeeper – Construction Company', description: 'Full-charge bookkeeping for a growing construction company: job costing, AP/AR, and monthly close.',
        skillsNeeded: ['QuickBooks Online', 'AP/AR', 'Job Costing'], employmentType: 'Temporary-to-Hire', location: 'New Britain, PA', budgetPerDay: 280,
        industry: 'Construction', status: 'open', createdAt: '2026-08-18'
      },
      {
        id: 2, clientId: 3, title: 'Controller, Doylestown', description: 'Oversee accounting operations, monthly close, and financial reporting as the company scales past $40M in revenue.',
        skillsNeeded: ['GAAP', 'Financial Reporting', 'Internal Controls'], employmentType: 'Direct Hire', location: 'Doylestown, PA', budgetPerDay: 540,
        industry: 'Construction', status: 'fulfilled', createdAt: '2026-08-01'
      },
      {
        id: 3, clientId: 2, title: 'Administrative Assistant', description: 'Support a small consulting office with scheduling, correspondence, and light bookkeeping.',
        skillsNeeded: ['Office Administration', 'Scheduling', 'QuickBooks'], employmentType: 'Temporary', location: 'Yardley, PA', budgetPerDay: 190,
        industry: 'Pharmaceutical Marketing & Consulting', status: 'open', createdAt: '2026-08-24'
      },
      {
        id: 4, clientId: 3, title: 'Operations Supervisor – Manufacturing Company', description: 'Lead a production shift, manage scheduling, and hit weekly output targets for a growing manufacturer.',
        skillsNeeded: ['Production Scheduling', 'Team Leadership'], employmentType: 'Direct Hire', location: 'Wilmington, DE', budgetPerDay: 300,
        industry: 'Manufacturing', status: 'fulfilled', createdAt: '2026-07-28'
      }
    ],
    placements: [
      { id: 1, jobRequestId: 2, candidateId: 2, clientId: 3, dailyRate: 520, agencyMarkupPercent: 18, startDate: '2026-08-06', status: 'active' },
      { id: 2, jobRequestId: 4, candidateId: 4, clientId: 3, dailyRate: 340, agencyMarkupPercent: 20, startDate: '2026-07-30', status: 'active' }
    ],
    engagements: [
      {
        id: 1, clientId: 2, serviceType: 'Outsourced Bookkeeping', description: 'Monthly bookkeeping, reconciliations, and reporting for a small consulting practice.',
        assignedCandidateId: 3, monthlyFee: 1900, status: 'active', startDate: '2026-04-01'
      }
    ],
    invoices: [
      { id: 1, source: 'placement', placementId: 1, clientId: 3, amount: 13478, period: 'August 2026', status: 'paid', issuedAt: '2026-08-31' },
      { id: 2, source: 'engagement', engagementId: 1, clientId: 2, amount: 1900, period: 'August 2026', status: 'paid', issuedAt: '2026-08-31' }
    ],
    applications: [
      { id: 1, jobRequestId: 1, candidateId: 1, status: 'submitted', appliedAt: '2026-08-20', note: '' }
    ],
    inquiries: [
      { id: 1, name: 'Karen Delacroix', company: 'Redstone Partners', email: 'karen.delacroix@redstonepartners.com', phone: '(215) 555-0188', serviceType: 'staffing', message: 'Need a temp-to-hire customer service rep starting ASAP, Bucks County area.', status: 'new', submittedAt: '2026-08-27' },
      { id: 2, name: 'Marco Bellini', company: 'Bellini Family Dental', email: 'marco.bellini@bellinidental.com', phone: '(609) 555-0121', serviceType: 'advisory', message: 'Looking for outsourced bookkeeping across two practice locations — currently a mess in QuickBooks.', status: 'new', submittedAt: '2026-08-29' }
    ],
    nextId: { candidates: 6, jobRequests: 5, placements: 3, engagements: 2, invoices: 3, users: 6, applications: 2, inquiries: 3 }
  };
}

let db;
if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    db = seed();
  }
} else {
  db = seed();
}

function save() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function resetToSeed() {
  db = seed();
  save();
}

save();

module.exports = { get: () => db, save, resetToSeed };
