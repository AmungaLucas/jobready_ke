// ============================================================================
// lib/llm/gemini-client.ts
// Wrapper around Google Gemini 1.5 Flash for structured JSON extraction.
//
// Provider selection:
//   - If GEMINI_API_KEY env var is set → use the real Gemini SDK
//   - Otherwise → use a deterministic stub that returns plausible
//     keyword-based extractions (zero cost, reproducible for dev/tests)
//
// The stub is NOT a mock of Gemini's intelligence — it's a keyword-based
// fallback that produces the same JSON shape so the rest of the pipeline
// (parsing, normalization, persistence, matching) can be developed and
// tested end-to-end without burning API tokens.
// ============================================================================

import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL_NAME = 'gemini-1.5-flash';
const API_KEY = process.env.GEMINI_API_KEY;
const USE_STUB = !API_KEY || API_KEY.trim() === '';

// ─── Public interface ───────────────────────────────────────────────────────

export interface GenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number; // default 0.1 for deterministic extraction
  maxOutputTokens?: number;
  timeoutMs?: number; // default 30s
}

export interface GenerateResult {
  text: string;
  provider: 'gemini' | 'stub';
  tokensUsed?: number;
  durationMs: number;
}

/**
 * Generate a text completion from the configured LLM provider.
 * Always returns a string (the LLM's text response). Caller is responsible
 * for JSON.parse + validation.
 */
export async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  const start = Date.now();

  if (USE_STUB) {
    const text = stubGenerate(opts);
    return {
      text,
      provider: 'stub',
      durationMs: Date.now() - start,
    };
  }

  return generateWithGemini(opts, start);
}

export function getProvider(): 'gemini' | 'stub' {
  return USE_STUB ? 'stub' : 'gemini';
}

// ─── Real Gemini SDK call ───────────────────────────────────────────────────

async function generateWithGemini(
  opts: GenerateOptions,
  start: number,
): Promise<GenerateResult> {
  const genAI = new GoogleGenerativeAI(API_KEY!);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: opts.systemPrompt,
    generationConfig: {
      temperature: opts.temperature ?? 0.1,
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
      responseMimeType: 'application/json',
    },
  });

  const timeoutMs = opts.timeoutMs ?? 30_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await model.generateContent(opts.userPrompt);
    const text = result.response.text();
    const tokensUsed = result.response.usageMetadata?.totalTokenCount;
    return {
      text,
      provider: 'gemini',
      tokensUsed,
      durationMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Stub fallback ──────────────────────────────────────────────────────────
//
// Deterministic keyword-based extraction. The stub looks at the input text,
// detects job-function keywords, and emits JSON in the exact same shape as
// the real LLM would. This lets us develop the rest of the pipeline without
// an API key.
//
// The stub is intentionally simple — it's not trying to be smart. It's
// trying to be PREDICTABLE so tests are reproducible.

function stubGenerate(opts: GenerateOptions): string {
  // Detect whether this is a CV or JD extraction based on the system prompt
  const isCv = opts.systemPrompt.includes('CV_EXTRACTION');
  const isJd = opts.systemPrompt.includes('JD_EXTRACTION');

  if (isCv) {
    return stubExtractCv(opts.userPrompt);
  }
  if (isJd) {
    return stubExtractJd(opts.userPrompt);
  }

  // Fallback: empty JSON object
  return '{}';
}

// ─── CV stub ────────────────────────────────────────────────────────────────

const FUNCTION_KEYWORDS: Record<string, string[]> = {
  finance: ['accountant', 'accounting', 'finance', 'audit', 'bookkeep', 'taxation', 'cpa', 'ifrs', 'treasury'],
  technology: ['developer', 'software', 'programmer', 'coding', 'javascript', 'python', 'react', 'node.js', 'database', 'devops', 'cybersecurity', 'frontend', 'backend', 'fullstack', 'information technology', 'systems administrator'],
  marketing: ['marketing', 'brand', 'advertising', 'social media', 'content writing', 'seo', 'communications', 'public relations'],
  sales: ['sales', 'business development', 'account manager', 'sales executive', 'territory'],
  operations: ['operations', 'supply chain', 'logistics', 'procurement', 'warehouse', 'inventory', 'project management'],
  human_resources: ['human resources', 'recruitment', 'talent acquisition', 'payroll', 'personnel'],
  design: ['designer', 'graphic design', 'product design', 'visual design', 'creative'],
  customer_service: ['customer service', 'customer support', 'call center', 'helpdesk', 'customer success', 'client service'],
  healthcare: ['nurse', 'clinical', 'medical', 'pharmacy', 'patient care', 'physiotherapy', 'public health', 'doctor'],
  education: ['teacher', 'tutor', 'lecturer', 'instructor', 'trainer', 'curriculum', 'academic'],
  legal: ['lawyer', 'attorney', 'paralegal', 'compliance', 'advocate', 'counsel'],
  engineering: ['mechanical', 'electrical', 'civil', 'structural', 'chemical', 'automotive', 'industrial', 'mechatronics'],
};

// Short ambiguous keywords that need word-boundary matching to avoid false positives.
// e.g. "it" must not match "audit" or "with"; "hr" must not match "research" or "share";
// "pr" must not match "process"; "legal" matches "legacy" without boundaries; "tax" matches "taxonomy".
const WORD_BOUNDARY_KEYWORDS = new Set(['it', 'hr', 'pr', 'ba', 'ma', 'legal', 'tax']);

function detectFunctions(text: string): string[] {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const [fn, keywords] of Object.entries(FUNCTION_KEYWORDS)) {
    const isMatch = keywords.some((k) => {
      if (WORD_BOUNDARY_KEYWORDS.has(k)) {
        const pattern = new RegExp(`\b${k}\b`, 'i');
        return pattern.test(lower);
      }
      return lower.includes(k);
    });
    if (isMatch) matched.push(fn);
  }
  return matched;
}

function stubExtractCv(cvText: string): string {
  const lower = cvText.toLowerCase();
  const detectedFunctions = detectFunctions(cvText);

  // Detect education
  const education: any[] = [];
  if (/\bbachelor|bsc|ba|bcom|bed|btech|beng|degree\b/i.test(cvText)) {
    const fieldMatch = cvText.match(/\b(?:bachelor|bsc|ba|bcom|bed|btech|beng)[^.]*(?:in|of)\s+([A-Za-z\s]+)/i);
    education.push({
      level: 'Bachelor',
      field: fieldMatch ? fieldMatch[1].trim() : 'General',
      graduationYear: extractYear(cvText),
    });
  }
  if (/\bmaster|msc|ma|mba|mcom|med|meng\b/i.test(cvText)) {
    const fieldMatch = cvText.match(/\b(?:master|msc|ma|mba|mcom|med|meng)[^.]*(?:in|of)\s+([A-Za-z\s]+)/i);
    education.push({
      level: 'Master',
      field: fieldMatch ? fieldMatch[1].trim() : 'General',
      graduationYear: extractYear(cvText),
    });
  }
  if (/\bdiploma\b/i.test(cvText)) {
    const fieldMatch = cvText.match(/diploma[^.]*(?:in)\s+([A-Za-z\s]+)/i);
    education.push({
      level: 'Diploma',
      field: fieldMatch ? fieldMatch[1].trim() : 'General',
      graduationYear: extractYear(cvText),
    });
  }
  if (/\bcertificate|cert\b/i.test(cvText)) {
    education.push({
      level: 'Certificate',
      field: 'General',
      graduationYear: extractYear(cvText),
    });
  }
  if (education.length === 0) {
    education.push({ level: 'Bachelor', field: 'General' });
  }

  // Detect skills — pull from a known skills lexicon
  const SKILL_LEXICON = [
    'accounting', 'ifrs', 'audit', 'taxation', 'quickbooks', 'excel', 'sap',
    'bookkeeping', 'financial reporting', 'budgeting',
    'javascript', 'react', 'node.js', 'python', 'typescript', 'aws', 'git',
    'sql', 'postgresql', 'docker', 'kubernetes',
    'customer service', 'communication', 'office administration', 'filing',
    'scheduling', 'call center',
    'marketing', 'social media', 'content writing', 'seo', 'advertising',
    'sales', 'negotiation', 'b2b', 'crm',
    'project management', 'supply chain', 'logistics', 'procurement',
    'hr', 'recruitment', 'payroll',
    'graphic design', 'photoshop', 'illustrator', 'figma',
    'teaching', 'curriculum development',
  ];
  const skills = SKILL_LEXICON.filter((s) => lower.includes(s));

  // Build work experiences from detected functions
  const workExperiences: any[] = [];
  const suggestedClusters: any[] = [];

  for (const fn of detectedFunctions.slice(0, 3)) {
    const titleMap: Record<string, string[]> = {
      finance: ['Accountant', 'Accounts Assistant', 'Finance Officer'],
      technology: ['Software Developer', 'Junior Engineer', 'IT Officer'],
      marketing: ['Marketing Officer', 'Marketing Intern', 'Digital Marketing Specialist'],
      sales: ['Sales Executive', 'Business Development Representative'],
      operations: ['Operations Officer', 'Logistics Coordinator'],
      human_resources: ['HR Officer', 'Recruitment Assistant'],
      design: ['Graphic Designer', 'UI/UX Designer'],
      customer_service: ['Customer Service Representative', 'Office Administrator'],
      healthcare: ['Clinical Officer', 'Nurse'],
      education: ['Teacher', 'Tutor'],
      legal: ['Legal Officer', 'Paralegal'],
      engineering: ['Mechanical Engineer', 'Electrical Engineer'],
    };
    const titles = titleMap[fn] ?? [`${fn} Specialist`];
    const fnSkills = skills.length > 0 ? skills.slice(0, 6) : [];

    workExperiences.push({
      jobTitle: titles[0],
      startDate: '2020-01',
      endDate: 'Present',
      yearsExperience: 4,
      function: fn,
      skills: fnSkills,
    });

    suggestedClusters.push({
      function: fn,
      jobTitles: titles,
      skills: fnSkills,
      yearsExperience: 4,
    });
  }

  // If nothing detected, emit a single generic cluster
  if (suggestedClusters.length === 0) {
    suggestedClusters.push({
      function: 'operations',
      jobTitles: ['Operations Assistant'],
      skills: skills.slice(0, 3),
      yearsExperience: 1,
    });
  }

  return JSON.stringify({
    workExperiences,
    education,
    skills: Array.from(new Set(skills)),
    suggestedClusters: suggestedClusters.slice(0, 3),
  });
}

// ─── JD stub ────────────────────────────────────────────────────────────────

function stubExtractJd(jdText: string): string {
  const detectedFunctions = detectFunctions(jdText);
  const fn = detectedFunctions[0] ?? 'operations';

  const titleMap: Record<string, string> = {
    finance: 'Accountant',
    technology: 'Software Engineer',
    marketing: 'Marketing Officer',
    sales: 'Sales Executive',
    operations: 'Operations Officer',
    human_resources: 'HR Officer',
    design: 'Graphic Designer',
    customer_service: 'Customer Service Representative',
    healthcare: 'Clinical Officer',
    education: 'Teacher',
    legal: 'Legal Officer',
    engineering: 'Engineer',
  };

  // Sector detection — fall back to a sensible default based on function
  const SECTOR_KEYWORDS: Record<string, string[]> = {
    technology: ['tech', 'software', 'saas', 'fintech', 'it '],
    financial_services: ['bank', 'finance', 'insurance', 'sacco', 'microfinance'],
    healthcare: ['hospital', 'clinic', 'health', 'medical', 'pharma'],
    hospitality: ['hotel', 'tourism', 'restaurant', 'catering'],
    retail: ['retail', 'supermarket', 'ecommerce', 'e-commerce'],
    manufacturing: ['manufacturing', 'factory', 'production'],
    media: ['media', 'broadcasting', 'journalism'],
    non_profit: ['ngo', 'non-profit', 'charity', 'foundation'],
    government: ['government', 'ministry', 'public sector'],
  };
  let sector: string | undefined;
  for (const [s, kws] of Object.entries(SECTOR_KEYWORDS)) {
    if (kws.some((k) => jdText.toLowerCase().includes(k))) {
      sector = s;
      break;
    }
  }
  if (!sector) {
    // Default sector based on detected function
    const FN_TO_DEFAULT_SECTOR: Record<string, string> = {
      finance: 'financial_services',
      technology: 'technology',
      healthcare: 'healthcare',
      education: 'education',
      marketing: 'media',
      engineering: 'manufacturing',
      legal: 'government',
    };
    sector = FN_TO_DEFAULT_SECTOR[fn] ?? 'technology';
  }

  // Education detection
  let minEducation = 'bachelors';
  if (/master|mba|postgraduate/i.test(jdText)) minEducation = 'masters';
  else if (/diploma/i.test(jdText)) minEducation = 'diploma';
  else if (/certificate/i.test(jdText)) minEducation = 'certificate';

  // Experience detection
  const expMatch = jdText.match(/(\d+)\+?\s*years?\s+(?:of\s+)?experience/i);
  const minExperience = expMatch ? parseInt(expMatch[1], 10) : 1;

  // Skills — pull from the same lexicon
  const SKILL_LEXICON = [
    'accounting', 'ifrs', 'audit', 'taxation', 'quickbooks', 'excel', 'sap',
    'bookkeeping', 'financial reporting',
    'javascript', 'react', 'node.js', 'python', 'typescript', 'aws', 'git',
    'sql', 'docker',
    'customer service', 'communication', 'office administration', 'filing',
    'scheduling', 'call center',
    'marketing', 'social media', 'content', 'seo', 'advertising',
    'sales', 'negotiation', 'crm',
    'project management', 'supply chain', 'logistics', 'procurement',
  ];
  const skills = SKILL_LEXICON.filter((s) => jdText.toLowerCase().includes(s));

  // Location detection
  const locMatch = jdText.match(/(?:location|based in|located in)[:\s]+([A-Z][a-zA-Z\s,]+?)(?:\.|$|\n)/);
  const location = locMatch ? locMatch[1].trim() : 'Nairobi, Kenya';

  // Salary detection
  const salaryMatch = jdText.match(/(?:kes|ksh|salary)[:\s]*([0-9,]+\s*[-–to]+\s*[0-9,]+)/i);
  const salaryRange = salaryMatch ? `KES ${salaryMatch[1].trim()}` : undefined;

  // Strip the prompt wrapper if present (the stub receives the user prompt,
  // which wraps the raw JD text in "Parse the following... \n"""\n<text>\n""")
  let cleanDescription = jdText;
  const promptMatch = jdText.match(/"""\n([\s\S]+?)\n"""/);
  if (promptMatch) {
    cleanDescription = promptMatch[1];
  }

  return JSON.stringify({
    title: titleMap[fn] ?? 'Specialist',
    function: fn,
    sector,
    jobType: /part[- ]time/i.test(jdText) ? 'part_time'
      : /contract/i.test(jdText) ? 'contract'
      : /intern/i.test(jdText) ? 'internship'
      : 'full_time',
    minEducation,
    educationField: fn === 'finance' ? 'Accounting'
      : fn === 'technology' ? 'Computer Science'
      : fn === 'marketing' ? 'Marketing'
      : fn === 'human_resources' ? 'Human Resource Management'
      : 'Business Administration',
    minExperience,
    requiredSkills: skills.slice(0, 4),
    preferredSkills: skills.slice(4, 7),
    description: cleanDescription.slice(0, 800),
    location,
    salaryRange,
    administrativeRequirements: [],
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractYear(text: string): number | undefined {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : undefined;
}
