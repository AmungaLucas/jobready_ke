#!/usr/bin/env python3
"""Patch the FUNCTION_KEYWORDS and detectFunctions in gemini-client.ts."""
import re
from pathlib import Path

PATH = Path('/home/z/my-project/src/lib/llm/gemini-client.ts')
src = PATH.read_text()

# Find the block from `const FUNCTION_KEYWORDS` to the end of `detectFunctions` function
pattern = re.compile(
    r'const FUNCTION_KEYWORDS: Record<string, string\[\]> = \{[\s\S]*?\};\s*'
    r'function detectFunctions\(text: string\): string\[\] \{[\s\S]*?^\}',
    re.MULTILINE
)

NEW_BLOCK = """const FUNCTION_KEYWORDS: Record<string, string[]> = {
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
        const pattern = new RegExp(`\\\\b${k}\\\\b`, 'i');
        return pattern.test(lower);
      }
      return lower.includes(k);
    });
    if (isMatch) matched.push(fn);
  }
  return matched;
}"""

new_src, n = pattern.subn(NEW_BLOCK, src, count=1)
if n != 1:
    print(f"ERROR: pattern matched {n} times, expected 1")
    raise SystemExit(1)

PATH.write_text(new_src)
print(f"OK: replaced 1 block in {PATH}")
