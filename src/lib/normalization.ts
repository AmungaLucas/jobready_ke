// ============================================================================
// lib/normalization.ts
// Word-boundary normalization for enums (Section 4.6 of v4.0 doc)
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
  | 'engineering'
  | 'finance'
  | 'marketing'
  | 'sales'
  | 'operations'
  | 'human_resources'
  | 'technology'
  | 'design'
  | 'customer_service'
  | 'healthcare'
  | 'education'
  | 'legal';

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
// Variants are matched case-insensitively using word boundaries (\b)
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
  engineering: [
    'engineering', 'engineer', 'mechanical', 'electrical', 'civil',
    'structural', 'chemical', 'automotive', 'industrial', 'mechatronics',
  ],
  finance: [
    'finance', 'accounting', 'accountant', 'audit', 'auditing', 'tax',
    'treasury', 'bookkeeping', 'financial', 'cpa',
  ],
  marketing: [
    'marketing', 'brand', 'advertising', 'digital marketing', 'content',
    'seo', 'social media', 'communications', 'pr', 'public relations',
  ],
  sales: [
    'sales', 'business development', 'b2b', 'b2c', 'account management',
    'sales representative', 'sales executive', 'territory',
  ],
  operations: [
    'operations', 'supply chain', 'logistics', 'procurement', 'warehouse',
    'inventory', 'project management', 'operations management',
  ],
  human_resources: [
    'human resources', 'hr', 'recruitment', 'talent acquisition',
    'people operations', 'personnel', 'staffing', 'payroll',
  ],
  technology: [
    'technology', 'software', 'it', 'information technology',
    'developer', 'programmer', 'data science', 'devops', 'cybersecurity',
    'systems administrator', 'frontend', 'backend', 'fullstack',
  ],
  design: [
    'design', 'graphic design', 'ui', 'ux', 'product design',
    'visual design', 'web design', 'creative',
  ],
  customer_service: [
    'customer service', 'customer support', 'client service',
    'call center', 'helpdesk', 'customer success', 'customer care',
  ],
  healthcare: [
    'healthcare', 'health', 'medical', 'nursing', 'clinical', 'pharmacy',
    'patient care', 'hospital', 'physiotherapy', 'public health',
  ],
  education: [
    'education', 'teaching', 'teacher', 'tutor', 'lecturer', 'trainer',
    'curriculum', 'instructional', 'academic',
  ],
  legal: [
    'legal', 'law', 'lawyer', 'attorney', 'counsel', 'paralegal',
    'compliance', 'regulatory', 'advocate',
  ],
};

export const SECTOR_VARIANTS: Record<Sector, string[]> = {
  technology: ['technology', 'tech', 'software', 'it', 'saas', 'fintech'],
  financial_services: [
    'financial services', 'banking', 'finance', 'insurance',
    'investment', 'microfinance', 'sacco',
  ],
  healthcare: ['healthcare', 'health', 'medical', 'hospital', 'pharma'],
  education: ['education', 'school', 'university', 'college', 'training'],
  manufacturing: ['manufacturing', 'factory', 'production', 'industrial'],
  retail: ['retail', 'ecommerce', 'e-commerce', 'supermarket', 'wholesale'],
  agriculture: ['agriculture', 'agribusiness', 'farming', 'agritech'],
  construction: ['construction', 'real estate', 'property', 'civil works'],
  hospitality: ['hospitality', 'hotel', 'tourism', 'restaurant', 'catering'],
  government: ['government', 'public sector', 'civil service', 'ministry'],
  non_profit: ['non profit', 'ngo', 'charity', 'non-profit', 'foundation'],
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
// Uses word-boundary regex to prevent substring false positives
// ============================================================================

/**
 * Normalize a free-text value to a canonical enum using word-boundary matching.
 * Returns null if no variant matches.
 *
 * @example
 * normalizeEnum('HR Manager', JOB_FUNCTION_VARIANTS) => 'human_resources'
 * normalizeEnum('Research Scientist', JOB_FUNCTION_VARIANTS) => null (NOT 'human_resources')
 */
export function normalizeEnum<T extends string>(
  input: string | null | undefined,
  variants: Record<T, string[]>,
): T | null {
  if (!input || typeof input !== 'string') return null;

  // Normalize the input: lowercase, trim, collapse whitespace
  const normalized = input.toLowerCase().trim().replace(/\s+/g, ' ');

  // First try exact match (fastest path)
  for (const [canonical, list] of Object.entries(variants) as [T, string[]][]) {
    if (list.includes(normalized)) return canonical;
  }

  // Then try word-boundary regex for each variant
  for (const [canonical, list] of Object.entries(variants) as [T, string[]][]) {
    for (const variant of list) {
      // Escape regex special chars, then wrap with word boundaries
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Multi-word variants need \b on each end; word chars in middle are fine
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

/**
 * Normalize a list of skill strings.
 * - Lowercase
 * - Trim
 * - Remove empty
 * - Deduplicate
 */
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

/**
 * Compare two education levels.
 * Returns positive if `candidate` is higher than `required`,
 * negative if lower, 0 if equal.
 */
export function compareEducationLevels(
  candidate: EducationLevel,
  required: EducationLevel,
): number {
  return educationLevelIndex(candidate) - educationLevelIndex(required);
}
