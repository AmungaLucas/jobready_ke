// ============================================================================
// lib/field-mapping.ts
// Section 14 of v4.0 doc: replaces naive String.includes() with 3-tier matching
// - Tier 1: Exact field match
// - Tier 2: Group-based match (fields in same RELATED_FIELDS group)
// - Tier 3: Partial-word match (word-boundary regex on group members)
// ============================================================================

/**
 * Predefined mapping of related education fields.
 * Each key is a canonical field category; values are known aliases/related fields.
 */
export const RELATED_FIELDS: Record<string, string[]> = {
  // Business and Commerce
  business: [
    'commerce', 'business administration', 'business management',
    'marketing', 'finance', 'accounting', 'management',
    'entrepreneurship', 'international business', 'supply chain',
  ],
  // Technology and Computing
  computing: [
    'computer science', 'information technology', 'software engineering',
    'data science', 'programming', 'systems analysis', 'web development',
    'cybersecurity', 'networking', 'database management', 'ai', 'machine learning',
  ],
  // Engineering
  engineering: [
    'mechanical engineering', 'civil engineering', 'electrical engineering',
    'automotive engineering', 'structural engineering', 'chemical engineering',
    'industrial engineering', 'aerospace engineering', 'mechatronics',
  ],
  // Health and Medical
  health: [
    'medicine', 'nursing', 'clinical medicine', 'pharmacy', 'public health',
    'healthcare', 'biomedical', 'physiotherapy', 'dentistry', 'nutrition',
  ],
  // Education and Teaching
  education: [
    'teaching', 'training', 'curriculum development', 'pedagogy',
    'instruction', 'educational leadership', 'special education',
  ],
  // Economics and Finance
  economics: [
    'econometrics', 'finance', 'statistics', 'actuarial science',
    'investment', 'banking', 'financial management',
  ],
  // Law and Legal
  law: [
    'legal', 'jurisprudence', 'advocacy', 'constitutional law',
    'criminal law', 'contract law', 'property law', 'arbitration',
  ],
  // Arts and Humanities
  arts: [
    'humanities', 'social sciences', 'literature', 'history',
    'sociology', 'psychology', 'political science', 'anthropology',
  ],
  // Sciences
  science: [
    'biology', 'chemistry', 'physics', 'mathematics', 'geology',
    'environmental science', 'agriculture', 'biotechnology', 'zoology',
  ],
  // Hospitality and Tourism
  hospitality: [
    'hotel management', 'tourism', 'travel', 'catering',
    'event management', 'culinary arts', 'leisure management',
  ],
  // Construction and Architecture
  construction: [
    'architecture', 'building construction', 'quantity surveying',
    'land surveying', 'urban planning', 'real estate management',
  ],
  // Media and Communications
  media: [
    'journalism', 'broadcasting', 'mass communication', 'public relations',
    'film production', 'media studies', 'advertising',
  ],
};

// Reverse lookup: each known field string -> the category it belongs to
// (built once at module load for O(1) lookup)
const FIELD_TO_CATEGORY: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [category, fields] of Object.entries(RELATED_FIELDS)) {
    for (const field of fields) {
      map.set(field.toLowerCase().trim(), category);
    }
  }
  return map;
})();

/**
 * Find the category for a given field string.
 * Returns null if no category contains this exact field.
 */
function findCategoryExact(field: string): string | null {
  return FIELD_TO_CATEGORY.get(field.toLowerCase().trim()) ?? null;
}

/**
 * Find the category for a given field using partial-word matching.
 * Used as the third tier of the matching cascade.
 */
function findCategoryByPartialWord(field: string): string | null {
  const normalized = field.toLowerCase().trim();
  for (const [category, fields] of Object.entries(RELATED_FIELDS)) {
    for (const knownField of fields) {
      // Word-boundary match: check if any word of the input appears in known fields
      const escaped = knownField.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
      if (pattern.test(normalized)) {
        return category;
      }
      // Also reverse: does any word of known field appear in input?
      const inputEscaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reversePattern = new RegExp(`\\b${inputEscaped}\\b`, 'i');
      if (reversePattern.test(knownField)) {
        return category;
      }
    }
  }
  return null;
}

/**
 * Determine whether a candidate's education field is related to a job's required field.
 *
 * 3-tier matching:
 * 1. Exact match (case-insensitive)
 * 2. Same category (both fields belong to the same RELATED_FIELDS group)
 * 3. Partial-word match (word-boundary regex on group members)
 *
 * @returns true if the fields are related
 */
export function isFieldRelated(candidateField: string, jobField: string): boolean {
  const cField = (candidateField ?? '').toLowerCase().trim();
  const jField = (jobField ?? '').toLowerCase().trim();

  if (!cField || !jField) return false;

  // Tier 1: Exact match
  if (cField === jField) return true;

  // Tier 2: Same category
  const cCategory = findCategoryExact(cField) ?? findCategoryByPartialWord(cField);
  const jCategory = findCategoryExact(jField) ?? findCategoryByPartialWord(jField);

  if (cCategory && jCategory && cCategory === jCategory) {
    return true;
  }

  // Tier 3: Partial-word match (cross-category)
  // Check if any word of one field appears in the other
  const cWords = cField.split(/\s+/).filter((w) => w.length > 2);
  const jWords = jField.split(/\s+/).filter((w) => w.length > 2);

  for (const word of cWords) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
    if (pattern.test(jField)) return true;
  }
  for (const word of jWords) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
    if (pattern.test(cField)) return true;
  }

  return false;
}

/**
 * Score the field relatedness for the 5-point field bonus (Section 6).
 *
 * - Exact match:        5 points
 * - Same category:      4 points
 * - Partial word match: 2 points
 * - No match:           0 points
 */
export function scoreFieldRelatedness(candidateField: string, jobField: string): number {
  const cField = (candidateField ?? '').toLowerCase().trim();
  const jField = (jobField ?? '').toLowerCase().trim();

  if (!cField || !jField) return 0;

  // Tier 1: Exact match
  if (cField === jField) return 5;

  // Tier 2: Same category
  const cCategory = findCategoryExact(cField) ?? findCategoryByPartialWord(cField);
  const jCategory = findCategoryExact(jField) ?? findCategoryByPartialWord(jField);

  if (cCategory && jCategory && cCategory === jCategory) {
    return 4;
  }

  // Tier 3: Partial word match
  const cWords = cField.split(/\s+/).filter((w) => w.length > 2);
  const jWords = jField.split(/\s+/).filter((w) => w.length > 2);

  for (const word of cWords) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
    if (pattern.test(jField)) return 2;
  }
  for (const word of jWords) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
    if (pattern.test(cField)) return 2;
  }

  return 0;
}
