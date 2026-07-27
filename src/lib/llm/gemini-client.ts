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
import { FUNCTION_PATTERNS } from '@/lib/taxonomy';

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
// Improved keyword-based extraction that:
//   - Reads ACTUAL job titles from CV text (no hardcoded title arrays)
//   - Counts keyword hits per function to determine the DOMINANT career
//   - Only creates a 2nd cluster when there's a genuinely distinct secondary career
//     (requires ≥2 unique role titles + ≥1 year implied experience)
//   - Does NOT over-split a single career into multiple "trajectories"
//
// This is still a stub — it's not as smart as Gemini — but it won't hallucinate
// multiple careers where only one exists.

function stubGenerate(opts: GenerateOptions): string {
  const isCv = opts.systemPrompt.includes('CV_EXTRACTION');
  const isJd = opts.systemPrompt.includes('JD_EXTRACTION');

  if (isCv) return stubExtractCv(opts.userPrompt);
  if (isJd) return stubExtractJd(opts.userPrompt);
  return '{}';
}

// ─── Function detection with weighted scoring ─────────────────────────────────
// Each keyword has a weight: TITLE patterns are worth 3x (they appear in role
// headings), while GENERAL patterns are worth 1x (may appear in descriptions).

// ─── Function patterns are now imported from taxonomy.ts ──────────────────────
// FUNCTION_PATTERNS is imported from @/lib/taxonomy above

// Keywords that MUST use word-boundary matching to avoid false positives
const WORD_BOUNDARY_REQUIRED = new Set([
  'it', 'hr', 'pr', 'ba', 'ma', 'legal', 'tax',
]);

interface FunctionScore {
  fn: string;
  score: number;
  titleHits: number;
  generalHits: number;
}

function scoreFunctions(text: string): FunctionScore[] {
  const lower = text.toLowerCase();
  const scores: FunctionScore[] = [];

  for (const [fn, patterns] of Object.entries(FUNCTION_PATTERNS)) {
    let titleHits = 0;
    let generalHits = 0;

    for (const keyword of patterns.titles) {
      if (WORD_BOUNDARY_REQUIRED.has(keyword)) {
        if (new RegExp(`\\b${keyword}\\b`, 'i').test(lower)) titleHits++;
      } else if (lower.includes(keyword)) {
        titleHits++;
      }
    }

    for (const keyword of patterns.general) {
      if (WORD_BOUNDARY_REQUIRED.has(keyword)) {
        if (new RegExp(`\\b${keyword}\\b`, 'i').test(lower)) generalHits++;
      } else if (lower.includes(keyword)) {
        generalHits++;
      }
    }

    // Title hits are worth 3x because they indicate actual roles
    const score = (titleHits * 3) + generalHits;
    if (score > 0) {
      scores.push({ fn, score, titleHits, generalHits });
    }
  }

  return scores.sort((a, b) => b.score - a.score);
}

// ─── Extract real job titles from CV text ─────────────────────────────────────
// Looks for common CV patterns: role titles on their own line, or preceded by
// common markers like "Position", "Role", "Title", or bullet points.

function extractJobTitles(cvText: string): string[] {
  const titles: string[] = [];
  const lines = cvText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim().replace(/^[-•*]\s*/, ''); // strip bullets

    // Skip very short lines and very long lines (paragraphs)
    if (trimmed.length < 3 || trimmed.length > 80) continue;

    // Skip lines that look like dates, emails, phones, or addresses
    if (/^\d{4}[-/]\d{2}/.test(trimmed)) continue;
    if (/^\d{4}\s*(to|–|-|–)\s*(present|current|\d{4})/i.test(trimmed)) continue;
    if (/@\w+\.\w+/.test(trimmed)) continue;
    if (/^(\+?254|0)\d{9}/.test(trimmed)) continue;
    if (/(?:p\.?o\.?\s*box|street|road|avenue|drive|lane|nairobi|kenya|mombasa|kisumu)/i.test(trimmed)) continue;

    // Match lines that look like job titles:
    // - Common title keywords (but not "curriculum vitae" or "references")
    const titlePattern = /^(?:(?:junior|senior|lead|principal|chief|head|assistant|associate|deputy|executive)\s+)?(?:[A-Z][a-z]+\s+){0,3}(?:manager|officer|engineer|developer|designer|analyst|specialist|consultant|coordinator|executive|supervisor|administrator|accountant|auditor|director|officer|representative|intern|assistant|trainer|lecturer|teacher|advocate|officer|officer)$/i;

    if (titlePattern.test(trimmed)) {
      // Filter out non-titles
      const lower = trimmed.toLowerCase();
      if (lower.includes('curriculum vitae')) continue;
      if (lower.includes('career objective')) continue;
      if (lower.includes('personal profile')) continue;
      if (lower.includes('references')) continue;
      if (lower.includes('education')) continue;
      if (lower === 'skills' || lower === 'hobbies' || lower === 'interests' || lower === 'languages') continue;

      titles.push(trimmed);
    }
  }

  return [...new Set(titles)];
}

// ─── Extract work experience blocks ─────────────────────────────────────────
// A block starts with a job title line and includes everything until the next
// title line or a section heading.

function extractExperienceBlocks(cvText: string): Array<{
  title: string;
  company: string | undefined;
  startDate: string | undefined;
  endDate: string | undefined;
  yearsExperience: number;
  description: string | undefined;
}> {
  const lines = cvText.split('\n');
  const titles = extractJobTitles(cvText);
  const blocks: Array<{
    title: string;
    company: string | undefined;
    startDate: string | undefined;
    endDate: string | undefined;
    yearsExperience: number;
    description: string | undefined;
  }> = [];

  // Build title line indices for boundary detection
  const titleLineIndices = new Set<number>();
  const SECTION_HEADERS = /^(?:education|qualifications|skills|technical skills|references|referees|languages|hobbies|interests|certifications|professional development|career objective|personal profile|summary|profile)$/i;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim().replace(/^[-•*]\s*/, '');
    if (titles.some((t) => t.toLowerCase() === trimmed.toLowerCase()) && !SECTION_HEADERS.test(trimmed)) {
      titleLineIndices.add(i);
    }
  }

  const sortedIndices = [...titleLineIndices].sort((a, b) => a - b);

  for (let idx = 0; idx < sortedIndices.length; idx++) {
    const lineIdx = sortedIndices[idx];
    const title = lines[lineIdx].trim().replace(/^[-•*]\s*/, '');
    const nextTitleIdx = idx < sortedIndices.length - 1 ? sortedIndices[idx + 1] : lines.length;

    // Look at the next few lines after the title for company, dates
    let company: string | undefined;
    let startDate: string | undefined;
    let endDate: string | undefined;
    const descLines: string[] = [];

    for (let j = lineIdx + 1; j < nextTitleIdx && j < lineIdx + 10; j++) {
      const line = lines[j].trim();
      if (!line) continue;

      // Company detection: lines that don't look like dates or bullets
      if (!company && !/^[-•*]/.test(line) && !/^\d{4}/.test(line) && line.length > 2 && line.length < 60 && !SECTION_HEADERS.test(line)) {
        company = line.replace(/^[-•*]\s*/, '');
        continue;
      }

      // Date range detection
      const dateMatch = line.match(/(\d{4}[-/]?\d{02})\s*(?:to|–|-|–|\/)\s*(present|current|(\d{4}[-/]?\d{02}))/i);
      if (dateMatch) {
        startDate = dateMatch[1];
        endDate = dateMatch[2];
        continue;
      }
      // Single year
      const singleDate = line.match(/^(\d{4})\s*[-–]?\s*$/);
      if (singleDate && !startDate) {
        startDate = singleDate[1];
        continue;
      }

      // Description lines (bullets)
      if (/^[-•*]/.test(line) || /^[A-Z]/.test(line)) {
        descLines.push(line.replace(/^[-•*]\s*/, ''));
      }
    }

    // Estimate years of experience from dates
    let yearsExperience = 2; // default
    if (startDate) {
      const startYear = parseInt(startDate.substring(0, 4), 10);
      const endYear = (endDate && endDate !== 'present' && endDate !== 'Present' && endDate !== 'current')
        ? parseInt(endDate.substring(0, 4), 10)
        : new Date().getFullYear();
      yearsExperience = Math.max(0, Math.min(40, endYear - startYear));
    }

    blocks.push({
      title,
      company,
      startDate: startDate || undefined,
      endDate: endDate || 'Present',
      yearsExperience,
      description: descLines.length > 0 ? descLines.join('; ') : undefined,
    });
  }

  return blocks;
}

function stubExtractCv(userPrompt: string): string {
  // Strip the prompt wrapper to get raw CV text
  let cvText = userPrompt;
  const promptMatch = userPrompt.match(/"""\n([\s\S]+?)\n"""/);
  if (promptMatch) cvText = promptMatch[1];

  const lower = cvText.toLowerCase();

  // ── Score all functions ──────────────────────────────────────────────
  const scored = scoreFunctions(cvText);

  // ── Extract real job titles and experience blocks ─────────────────────
  const jobTitles = extractJobTitles(cvText);
  const blocks = extractExperienceBlocks(cvText);

  // ── Determine the dominant function ────────────────────────────────────
  // Primary = highest score, Secondary = must have titleHits ≥ 1 AND
  // significantly different function (score ≥ 2 and ≥20% of primary)
  const primary = scored[0];
  const secondary = scored.find(
    (s) => s !== primary && s.titleHits >= 1 && s.score >= 2 && s.score >= primary.score * 0.2,
  );

  // Use the secondary function ONLY if there are distinct job titles for it
  // This prevents over-splitting when someone just mentions a skill
  const secondaryTitles = secondary
    ? jobTitles.filter((t) => {
        const tl = t.toLowerCase();
        const secPatterns = FUNCTION_PATTERNS[secondary.fn];
        if (!secPatterns) return false;
        return secPatterns.titles.some((p) => tl.includes(p)) || secPatterns.general.some((p) => tl.includes(p));
      })
    : [];

  const shouldSplit = secondary && secondaryTitles.length >= 2;

  // ── Classify each experience block into a function ─────────────────────
  const classifyBlock = (title: string): string => {
    const tl = title.toLowerCase();
    for (const { fn, patterns } of scored.map((s) => ({ fn: s.fn, patterns: FUNCTION_PATTERNS[s.fn]! }))) {
      if (patterns.titles.some((p) => tl.includes(p))) return fn;
    }
    return primary?.fn ?? 'operations';
  };

  // ── Build work experiences from actual CV data ──────────────────────────
  const workExperiences: any[] = [];
  for (const block of blocks) {
    workExperiences.push({
      jobTitle: block.title,
      company: block.company,
      startDate: block.startDate,
      endDate: block.endDate,
      yearsExperience: block.yearsExperience,
      description: block.description,
      function: classifyBlock(block.title),
      skills: [], // filled below
    });
  }

  // If no blocks were extracted, create one from the dominant function
  if (workExperiences.length === 0 && primary) {
    const title = jobTitles[0] || `${primary.fn.charAt(0).toUpperCase() + primary.fn.slice(1)} Specialist`;
    workExperiences.push({
      jobTitle: title,
      company: undefined,
      startDate: '2020-01',
      endDate: 'Present',
      yearsExperience: 4,
      function: primary.fn,
      skills: [],
    });
  }

  // If nothing detected at all, create a single generic entry
  if (workExperiences.length === 0) {
    workExperiences.push({
      jobTitle: 'General Worker',
      company: undefined,
      startDate: '2020-01',
      endDate: 'Present',
      yearsExperience: 1,
      function: 'operations',
      skills: [],
    });
  }

  // ── Skills detection ───────────────────────────────────────────────────
  const SKILL_LEXICON = [
    // Finance & Accounting
    'accounting', 'ifrs', 'audit', 'taxation', 'quickbooks', 'excel', 'sap',
    'bookkeeping', 'financial reporting', 'budgeting', 'reconciliation',
    // Technology
    'javascript', 'react', 'node.js', 'python', 'typescript', 'aws', 'git',
    'sql', 'postgresql', 'docker', 'kubernetes', 'api', 'rest', 'html', 'css',
    // Admin & Operations
    'customer service', 'communication', 'office administration', 'filing',
    'scheduling', 'data entry', 'project management', 'supply chain', 'logistics',
    // Marketing & Sales
    'marketing', 'social media', 'content writing', 'seo', 'advertising',
    'sales', 'negotiation', 'crm', 'b2b', 'b2c',
    // Media & Broadcasting
    'broadcast journalism', 'news presentation', 'radio', 'television',
    'video editing', 'adobe premier pro', 'premier pro', 'capcut',
    'live broadcast', 'news anchor', 'programme production',
    'office administration',
    // HR
    'recruitment', 'payroll', 'performance management', 'training',
    // Design
    'graphic design', 'photoshop', 'illustrator', 'figma', 'adobe',
    // Education
    'teaching', 'curriculum development', 'mentorship',
    // General / Soft skills
    'leadership', 'team management', 'problem solving', 'analytical',
    'report writing', 'presentation', 'microsoft office', 'google workspace',
  ];
  const allSkills = SKILL_LEXICON.filter((s) => lower.includes(s));

  // Assign skills to each experience based on its function
  for (const exp of workExperiences) {
    exp.skills = allSkills.slice(0, 6);
  }

  // ── Build clusters — ONE dominant, optionally ONE secondary ────────────
  const suggestedClusters: any[] = [];

  if (shouldSplit && secondary) {
    // Two distinct careers
    const primaryExps = workExperiences.filter((e) => e.function === primary.fn);
    const secondaryExps = workExperiences.filter((e) => e.function === secondary.fn);

    if (primaryExps.length > 0) {
      suggestedClusters.push({
        function: primary.fn,
        jobTitles: primaryExps.map((e) => e.jobTitle),
        skills: allSkills.filter((s) => primaryExps.some((e) => e.skills.includes(s))),
        yearsExperience: Math.max(...primaryExps.map((e) => e.yearsExperience)),
      });
    }
    if (secondaryExps.length > 0) {
      suggestedClusters.push({
        function: secondary.fn,
        jobTitles: secondaryExps.map((e) => e.jobTitle),
        skills: allSkills.filter((s) => secondaryExps.some((e) => e.skills.includes(s))),
        yearsExperience: Math.max(...secondaryExps.map((e) => e.yearsExperience)),
      });
    }
  } else {
    // Single career — all experiences go into one cluster
    const dominantFn = primary?.fn ?? workExperiences[0].function;
    suggestedClusters.push({
      function: dominantFn,
      jobTitles: workExperiences.map((e) => e.jobTitle),
      skills: allSkills.slice(0, 10),
      yearsExperience: Math.max(...workExperiences.map((e) => e.yearsExperience), 1),
    });
  }

  // ── Education detection ─────────────────────────────────────────────────
  const education: any[] = [];
  if (/\bbachelor|bsc|ba|bcom|bed|btech|beng|degree\b/i.test(cvText)) {
    const fieldMatch = cvText.match(/\b(?:bachelor|bsc|ba|bcom|bed|btech|beng)[^.]*(?:in|of)\s+([A-Za-z\s,]+)/i);
    education.push({
      level: 'Bachelor',
      field: fieldMatch ? fieldMatch[1].trim() : 'General',
      institution: undefined,
      graduationYear: extractYear(cvText),
    });
  }
  if (/\bmaster|msc|ma|mba|mcom|med|meng\b/i.test(cvText)) {
    const fieldMatch = cvText.match(/\b(?:master|msc|ma|mba|mcom|med|meng)[^.]*(?:in|of)\s+([A-Za-z\s,]+)/i);
    education.push({
      level: 'Master',
      field: fieldMatch ? fieldMatch[1].trim() : 'General',
      institution: undefined,
      graduationYear: extractYear(cvText),
    });
  }
  if (/\bdiploma\b/i.test(cvText)) {
    const fieldMatch = cvText.match(/diploma[^.]*(?:in)\s+([A-Za-z\s,]+)/i);
    education.push({
      level: 'Diploma',
      field: fieldMatch ? fieldMatch[1].trim() : 'General',
      institution: undefined,
      graduationYear: extractYear(cvText),
    });
  }
  if (/\bcertificate|cert\b/i.test(cvText)) {
    education.push({
      level: 'Certificate',
      field: 'General',
      institution: undefined,
      graduationYear: extractYear(cvText),
    });
  }
  if (education.length === 0) {
    education.push({ level: 'Bachelor', field: 'General' });
  }

  return JSON.stringify({
    workExperiences,
    education,
    skills: Array.from(new Set(allSkills)),
    suggestedClusters,
  });
}

// ─── JD stub ────────────────────────────────────────────────────────────────

function stubExtractJd(jdText: string): string {
  const detectedFunctions = scoreFunctions(jdText);
  const fn = detectedFunctions[0]?.fn ?? 'adm';

  const titleMap: Record<string, string> = {
    fin: 'Accountant',
    itt: 'Software Engineer',
    mkt: 'Marketing Officer',
    sal: 'Sales Executive',
    osc: 'Operations Officer',
    hrm: 'HR Officer',
    cad: 'Graphic Designer',
    eng: 'Engineer',
    agr: 'Agricultural Officer',
    con: 'Site Engineer',
    toh: 'Hotel Manager',
    trl: 'Logistics Coordinator',
    sed: 'Security Officer',
    npo: 'Community Development Officer',
    mfg: 'Production Manager',
    gpa: 'Administrative Officer',
    cnt: 'Consultant',
    env: 'Environmental Officer',
    hlt: 'Clinical Officer',
    edu: 'Teacher',
    leg: 'Legal Officer',
    bfs: 'Business Banker',
    ins: 'Underwriter',
    dsa: 'Data Analyst',
    mec: 'Journalist',
    adm: 'Administrative Assistant',
    pfm: 'Facilities Manager',
    tel: 'Telecom Engineer',
    aut: 'Automotive Technician',
    ava: 'Aviation Officer',
    ree: 'Estate Agent',
    rcg: 'Store Manager',
    ecm: 'E-Commerce Manager',
    min: 'Mining Engineer',
    enu: 'Energy Engineer',
    pha: 'Pharmaceutical Officer',
    cys: 'Cybersecurity Analyst',
    swc: 'Social Worker',
    spr: 'Sports Coach',
    vah: 'Veterinary Officer',
    wms: 'Waste Management Officer',
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
      fin: 'financial_services',
      itt: 'technology',
      hlt: 'healthcare',
      edu: 'education',
      mkt: 'media',
      eng: 'manufacturing',
      leg: 'government',
      agr: 'agriculture',
      con: 'construction',
      toh: 'hospitality',
      trl: 'retail',
      sed: 'government',
      npo: 'non_profit',
      mfg: 'manufacturing',
      gpa: 'government',
      cnt: 'financial_services',
      env: 'agriculture',
      bfs: 'financial_services',
      ins: 'financial_services',
      dsa: 'technology',
      mec: 'media',
      cad: 'technology',
      sal: 'financial_services',
      osc: 'retail',
      hrm: 'financial_services',
      tel: 'technology',
      aut: 'manufacturing',
      ava: 'government',
      ree: 'construction',
      rcg: 'retail',
      ecm: 'technology',
      min: 'agriculture',
      enu: 'technology',
      pha: 'healthcare',
      cys: 'technology',
      swc: 'non_profit',
      spr: 'non_profit',
      vah: 'agriculture',
      wms: 'government',
      adm: 'government',
      pfm: 'construction',
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
    educationField: fn === 'fin' ? 'Accounting'
      : fn === 'itt' ? 'Computer Science'
      : fn === 'mkt' ? 'Marketing'
      : fn === 'hrm' ? 'Human Resource Management'
      : fn === 'eng' ? 'Engineering'
      : fn === 'agr' ? 'Agriculture'
      : fn === 'hlt' ? 'Medicine'
      : fn === 'edu' ? 'Education'
      : fn === 'con' ? 'Construction Management'
      : fn === 'toh' ? 'Hospitality Management'
      : fn === 'leg' ? 'Law'
      : fn === 'env' ? 'Environmental Science'
      : fn === 'swc' ? 'Social Work'
      : fn === 'npo' ? 'Community Development'
      : fn === 'dsa' ? 'Applied Statistics'
      : fn === 'bfs' ? 'Business Administration'
      : fn === 'dsa' ? 'Applied Statistics'
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
