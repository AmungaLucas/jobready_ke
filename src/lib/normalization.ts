// ============================================================================
// lib/normalization.ts
// Word-boundary normalization for enums.
// Uses \b regex matching to prevent false positives (e.g., "hr" not matching "research")
// ============================================================================

export type EducationLevel =
  | 'none'
  | 'certificate'
  | 'diploma'
  | 'bachelors'
  | 'masters'
  | 'phd';

export type JobFunction =
  // Engineering & Technical
  | 'eng' | 'itt' | 'cys'
  // Science & Health
  | 'hlt' | 'pha'
  // Business & Finance
  | 'fin' | 'bfs' | 'ins'
  // Building & Infrastructure
  | 'con' | 'min' | 'enu' | 'mfg'
  // Government & Social
  | 'gpa' | 'swc' | 'npo'
  // Creative & Media
  | 'mkt' | 'cad' | 'mec'
  // Sales & Operations
  | 'sal' | 'osc'
  // People & Education
  | 'hrm' | 'edu'
  // Professional Services
  | 'leg' | 'cnt' | 'dsa'
  // Trade & Transport
  | 'toh' | 'trl' | 'tel' | 'aut' | 'ava'
  // Sector-Specific
  | 'agr' | 'ree' | 'rcg' | 'ecm' | 'env'
  // Support Functions
  | 'sed' | 'pfm' | 'spr' | 'vah' | 'wms' | 'adm';

export type Sector =
  | 'technology'
  | 'financial_services'
  | 'healthcare'
  | 'education'
  | 'manufacturing'
  | 'retail'
  | 'agriculture'
  | 'construction'
  | 'hospitality'
  | 'government'
  | 'non_profit'
  | 'media';

export type JobType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'internship'
  | 'temporary'
  | 'freelance';

// Canonical ordering for education (low to high)
export const EDUCATION_ORDER: EducationLevel[] = [
  'none',
  'certificate',
  'diploma',
  'bachelors',
  'masters',
  'phd',
];

// ============================================================================
// Variant maps: each canonical value -> array of common synonyms/variations
// ============================================================================

export const EDUCATION_VARIANTS: Record<EducationLevel, string[]> = {
  none: ['none', 'no education', 'no formal education', 'n/a'],
  certificate: ['certificate', 'cert', 'artisan', 'craft', 'vocational', 'trade'],
  diploma: ['diploma', 'dipl', 'higher diploma', 'advanced diploma'],
  bachelors: [
    'bachelors', 'bachelor', 'bsc', 'ba', 'bcom', 'bed', 'btech', 'beng',
    'degree', 'undergraduate degree', 'honours', 'honors',
  ],
  masters: [
    'masters', 'master', 'msc', 'ma', 'mba', 'mcom', 'med', 'meng',
    'postgraduate', 'post graduate', 'graduate degree',
  ],
  phd: ['phd', 'doctorate', 'doctoral', 'dphil', 'dsc'],
};

export const JOB_FUNCTION_VARIANTS: Record<JobFunction, string[]> = {
  // ── Engineering & Technical ──
  eng: [
    'engineering', 'engineer', 'mechanical engineer', 'electrical engineer',
    'civil engineer', 'structural engineer', 'chemical engineer',
    'industrial engineer', 'mechatronics', 'mechanical', 'electrical',
    'civil', 'structural', 'automotive engineer', 'machinist', 'production engineering',
  ],
  itt: [
    'information technology', 'it', 'ict', 'software', 'developer', 'programmer',
    'systems administrator', 'network administrator', 'ict technician', 'ict officer',
    'helpdesk', 'it support', 'devops', 'sre', 'site reliability',
    'frontend', 'backend', 'fullstack', 'full stack', 'web developer',
    'mobile developer', 'database administrator', 'qa', 'testing',
  ],
  cys: [
    'cybersecurity', 'information security', 'infosec', 'penetration testing',
    'vulnerability', 'security operations', 'soc', 'threat hunting',
    'security engineering', 'siem', 'security governance',
  ],

  // ── Science & Health ──
  hlt: [
    'healthcare', 'health', 'medical', 'nursing', 'clinical', 'nurse',
    'patient care', 'hospital', 'midwifery', 'maternal', 'obstetrics',
    'gynaecology', 'pharmacy', 'pharmacist', 'physiotherapy', 'public health',
    'community health', 'registered nurse', 'tb management', 'palliative care',
    'infection prevention', 'imci',
  ],
  pha: [
    'pharmaceutical', 'life sciences', 'drug development', 'clinical research',
    'pharmacovigilance', 'gmp', 'drug manufacturing', 'pharma sales',
  ],

  // ── Business & Finance ──
  fin: [
    'finance', 'accounting', 'accountant', 'audit', 'auditing', 'tax',
    'treasury', 'bookkeeping', 'financial', 'cpa', 'ifrs', 'payroll',
    'accounts assistant', 'financial reporting', 'sage', 'quickbooks', 'pastel',
    'statutory deductions', 'paye', 'nssf', 'shif', 'vat',
    'financial analysis', 'cost accounting', 'management accounting',
    'investment', 'portfolio', 'wealth management',
  ],
  bfs: [
    'banking', 'banker', 'lending', 'credit', 'branch banking', 'fintech',
    'microfinance', 'sacco', 'mobile banking', 'business banker',
    'relationship officer', 'branch manager banking', 'retail banking',
    'corporate banking', 'trade finance', 'business banking',
    'relationship manager', 'finacle', 'flexcube',
  ],
  ins: [
    'insurance', 'underwriting', 'claims', 'actuarial', 'policy',
    'insurer', 'insurance broker', 'risk assessment insurance',
  ],

  // ── Building & Infrastructure ──
  con: [
    'construction', 'building', 'site manager', 'site engineer', 'foreman',
    'mason', 'quantity surveyor', 'architecture', 'architect', 'contractor',
    'project manager construction', 'building construction', 'civil works',
    'mep', 'structural engineer',
  ],
  min: [
    'mining', 'geology', 'mineral', 'extraction', 'quarry', 'mine',
    'exploration', 'resource estimation', 'mine planning',
  ],
  enu: [
    'energy', 'power', 'renewable', 'solar', 'geothermal', 'utility',
    'power generation', 'transmission', 'distribution', 'energy management',
  ],
  mfg: [
    'manufacturing', 'factory', 'production', 'assembly', 'quality control',
    'quality assurance', 'plant', 'machining', 'welding', 'fabrication',
    'production manager', 'shift supervisor', 'packaging', 'process engineering',
    'cement', 'manufacturing plant',
  ],

  // ── Government & Social ──
  gpa: [
    'government', 'civil service', 'public service', 'county', 'ministry',
    'parastatal', 'state corporation', 'public officer', 'census',
    'national government', 'county government',
  ],
  swc: [
    'social work', 'social worker', 'community development', 'counseling',
    'counselling', 'child protection', 'family services', 'psychological counseling',
    'community social work', 'geriatric care',
  ],
  npo: [
    'ngo', 'non-profit', 'non profit', 'development', 'humanitarian',
    'programme officer', 'field officer', 'monitoring and evaluation',
    'm&e', 'beneficiary', 'relief', 'charity', 'donor funded',
    'food aid', 'cash transfer', 'hunger safety net', 'wfp', 'unicef',
    'dfid', 'usaid', 'community mobilization',
  ],

  // ── Creative & Media ──
  mkt: [
    'marketing', 'brand', 'advertising', 'digital marketing', 'content',
    'seo', 'sem', 'social media management', 'communications', 'pr',
    'public relations', 'market research', 'growth hacking',
  ],
  cad: [
    'design', 'graphic design', 'ui', 'ux', 'product design',
    'visual design', 'web design', 'creative', 'fashion design',
    'interior design', 'photography', 'animation', 'ux/ui design',
  ],
  mec: [
    'journalism', 'journalist', 'news', 'broadcasting', 'media',
    'tv production', 'radio production', 'editor', 'reporter',
    'news anchor', 'news presenter', 'media production', 'video editor',
    'media manager', 'content creator', 'producer',
  ],

  // ── Sales & Operations ──
  sal: [
    'sales', 'business development', 'b2b', 'b2c', 'account management',
    'sales representative', 'sales executive', 'territory', 'selling',
    'key account management', 'technical sales', 'direct sales',
    'sales engineer', 'door to door', 'telesales',
  ],
  osc: [
    'operations', 'supply chain', 'logistics', 'procurement', 'warehouse',
    'inventory', 'operations management', 'operations officer',
    'freight', 'customs', 'import', 'export', 'distribution',
  ],

  // ── People & Education ──
  hrm: [
    'human resources', 'hr', 'recruitment', 'talent acquisition',
    'people operations', 'personnel', 'staffing', 'payroll management',
    'compensation', 'benefits', 'training', 'organizational development',
    'hris', 'workday',
  ],
  edu: [
    'education', 'teaching', 'teacher', 'tutor', 'lecturer', 'trainer',
    'curriculum', 'instructional', 'academic', 'school', 'tvet',
    'headteacher', 'principal', 'dean', 'director of studies',
    'tsc', 'kenya curriculum', 'kcse', 'kcpe', 'pedagogy',
  ],

  // ── Professional Services ──
  leg: [
    'legal', 'law', 'lawyer', 'attorney', 'counsel', 'paralegal',
    'compliance', 'regulatory', 'advocate', 'litigation', 'prosecutor',
    'criminal law', 'corporate law', 'contract law', 'court',
    'arbitration', 'legal officer', 'legal research',
  ],
  cnt: [
    'consulting', 'consultant', 'consultancy', 'advisory', 'advisor',
    'strategy', 'management consulting', 'audit consulting',
    'business advisory', 'tax advisory', 'risk management advisory',
  ],
  dsa: [
    'data analysis', 'data science', 'data analyst', 'statistician',
    'statistics', 'bi', 'business intelligence', 'analytics',
    'visualization', 'machine learning', 'applied statistics',
    'python data', 'r programming', 'data visualization', 'kobo toolbox',
    'redcap', 'm&e', 'monitoring and evaluation',
  ],

  // ── Trade & Transport ──
  toh: [
    'hospitality', 'hotel', 'tourism', 'tourist', 'restaurant', 'catering',
    'chef', 'cook', 'front desk', 'housekeeping', 'lodge', 'safari',
    'travel', 'events management', 'conference', 'barista',
  ],
  trl: [
    'transport', 'driving', 'driver', 'delivery', 'fleet',
    'dispatcher', 'freight', 'courier', 'motorcycle', 'boda boda',
    'matatu', 'bus', 'truck', 'port', 'customs clearing',
    'professional driving', 'heavy vehicle',
  ],
  tel: [
    'telecom', 'telecommunications', 'mobile network', 'isp', 'fiber',
    'network infrastructure', 'rf engineering', 'mobile services',
    'ericsson', 'huawei telecom', 'nokia telecom', 'zte',
  ],
  aut: [
    'automotive', 'vehicle', 'motor', 'mechanic', 'parts',
    'vehicle assembly', 'auto repair', 'auto electrical', 'body & paint',
    'vehicle inspector', 'sales engineer automotive',
  ],
  ava: [
    'aviation', 'aircraft', 'flight', 'airport', 'airline', 'pilot',
    'air traffic control', 'aircraft maintenance', 'airport management',
  ],

  // ── Sector-Specific ──
  agr: [
    'agriculture', 'farming', 'agribusiness', 'agronomy', 'agricultural',
    'horticulture', 'floriculture', 'aquaculture', 'veterinary', 'livestock',
    'crop', 'farm', 'extension officer', 'agricultural officer',
    'agri-tech', 'precision agriculture', 'dairy farming', 'poultry',
  ],
  ree: [
    'real estate', 'property', 'valuation', 'estate agent', 'letting',
    'property management', 'land survey', 'property developer',
  ],
  rcg: [
    'retail', 'supermarket', 'merchandising', 'store', 'consumer goods',
    'shop', 'wholesale', 'buying',
  ],
  ecm: [
    'e-commerce', 'ecommerce', 'marketplace', 'digital payments',
    'mobile money', 'online', 'jumia', 'kilimall', 'dropshipping',
    'm-pesa', 'lipa na mpesa',
  ],
  env: [
    'environment', 'environmental', 'conservation', 'wildlife', 'forestry',
    'climate', 'natural resources', 'sanitation', 'waste management',
    'renewable energy', 'solar', 'esg', 'sustainability',
  ],

  // ── Support Functions ──
  sed: [
    'security', 'guard', 'security guard', 'safety', 'health and safety',
    'investigation', 'investigator', 'surveillance', 'loss prevention',
    'military', 'armed forces', 'defence', 'defense', 'cctv',
    'physical security', 'electronic security',
  ],
  pfm: [
    'facilities', 'building maintenance', 'property management',
    'janitorial', 'cleaning', 'space planning', 'vendor management',
    'hvac', 'building automation', 'bms',
  ],
  spr: [
    'sports', 'coaching', 'fitness', 'athletics', 'recreation',
    'sports management', 'personal training', 'gym',
  ],
  vah: [
    'veterinary', 'animal health', 'veterinary officer', 'vet',
    'animal medicine', 'livestock health',
  ],
  wms: [
    'waste', 'sanitation', 'recycling', 'water treatment', 'garbage',
    'waste collection', 'waste management',
  ],
  adm: [
    'administration', 'admin', 'office', 'reception', 'data entry',
    'clerical', 'filing', 'records', 'executive assistant', 'pa',
    'office manager', 'secretary',
  ],
};

export const SECTOR_VARIANTS: Record<Sector, string[]> = {
  technology: ['technology', 'tech', 'software', 'it', 'saas', 'fintech', 'ict'],
  financial_services: [
    'financial services', 'banking', 'finance', 'insurance',
    'investment', 'microfinance', 'sacco', 'lending',
  ],
  healthcare: ['healthcare', 'health', 'medical', 'hospital', 'pharma', 'nursing'],
  education: ['education', 'school', 'university', 'college', 'training', 'tvet'],
  manufacturing: ['manufacturing', 'factory', 'production', 'industrial', 'assembly'],
  retail: ['retail', 'ecommerce', 'e-commerce', 'supermarket', 'wholesale', 'consumer goods'],
  agriculture: ['agriculture', 'agribusiness', 'farming', 'agritech', 'livestock'],
  construction: ['construction', 'real estate', 'property', 'civil works', 'building'],
  hospitality: ['hospitality', 'hotel', 'tourism', 'restaurant', 'catering', 'travel'],
  government: ['government', 'public sector', 'civil service', 'ministry', 'county'],
  non_profit: ['non profit', 'ngo', 'charity', 'non-profit', 'foundation', 'development'],
  media: ['media', 'broadcasting', 'journalism', 'publishing', 'entertainment'],
};

export const JOB_TYPE_VARIANTS: Record<JobType, string[]> = {
  full_time: ['full time', 'full-time', 'permanent', 'ft'],
  part_time: ['part time', 'part-time', 'pt'],
  contract: ['contract', 'fixed term', 'temporary contract'],
  internship: ['internship', 'intern', 'industrial attachment'],
  temporary: ['temporary', 'temp', 'casual', 'day'],
  freelance: ['freelance', 'freelancer', 'consultant', 'gig'],
};

// ============================================================================
// Core normalization function
// ============================================================================

/**
 * Normalize a free-text value to a canonical enum using word-boundary matching.
 */
export function normalizeEnum<T extends string>(
  input: string | null | undefined,
  variants: Record<T, string[]>,
): T | null {
  if (!input || typeof input !== 'string') return null;

  const normalized = input.toLowerCase().trim().replace(/\s+/g, ' ');

  // First: check if the input IS the canonical key
  for (const [canonical] of Object.entries(variants) as [T, string[]][]) {
    if (normalized === canonical.toLowerCase()) return canonical;
  }

  // Second: try exact match against the variant list
  for (const [canonical, list] of Object.entries(variants) as [T, string[]][]) {
    if (list.includes(normalized)) return canonical;
  }

  // Third: try word-boundary regex for each variant
  for (const [canonical, list] of Object.entries(variants) as [T, string[]][]) {
    for (const variant of list) {
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
      if (pattern.test(normalized)) {
        return canonical;
      }
    }
  }

  return null;
}

// Convenience wrappers
export const normalizeEducationLevel = (input: string): EducationLevel | null =>
  normalizeEnum(input, EDUCATION_VARIANTS);

export const normalizeJobFunction = (input: string): JobFunction | null =>
  normalizeEnum(input, JOB_FUNCTION_VARIANTS);

export const normalizeSector = (input: string): Sector | null =>
  normalizeEnum(input, SECTOR_VARIANTS);

export const normalizeJobType = (input: string): JobType | null =>
  normalizeEnum(input, JOB_TYPE_VARIANTS);

// ============================================================================
// Skills normalization: lowercase, trim, dedupe
// ============================================================================

export function normalizeSkills(skills: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const skill of skills) {
    if (!skill) continue;
    const normalized = skill.toLowerCase().trim().replace(/\s+/g, ' ');
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

// ============================================================================
// Education level comparison helpers
// ============================================================================

export function educationLevelIndex(level: EducationLevel): number {
  return EDUCATION_ORDER.indexOf(level);
}

export function compareEducationLevels(
  candidate: EducationLevel,
  required: EducationLevel,
): number {
  return educationLevelIndex(candidate) - educationLevelIndex(required);
}
