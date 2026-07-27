// Shared TypeScript types for the frontend

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
  | 'technology' | 'financial_services' | 'healthcare' | 'education'
  | 'manufacturing' | 'retail' | 'agriculture' | 'construction'
  | 'hospitality' | 'government' | 'non_profit' | 'media';

export type JobType =
  | 'full_time' | 'part_time' | 'contract' | 'internship' | 'temporary' | 'freelance';

export type EducationLevel =
  | 'none' | 'certificate' | 'diploma' | 'bachelors' | 'masters' | 'phd';

export interface JobSummary {
  id: string;
  title: string;
  function: JobFunction;
  specialization?: string | null;
  sector: Sector;
  jobType: JobType;
  minEducation: EducationLevel;
  minExperience: number;
  location: string | null;
  salaryRange: string | null;
  applicationDeadline: string | null;
  createdAt: string;
}

export interface JobDetail extends JobSummary {
  educationField: string;
  requiredSkills: string[];
  preferredSkills: string[];
  description: string;
  administrativeRequirements: string[];
}

export interface ScoreBreakdown {
  totalScore: number;
  titleScore: number;
  skillsScore: number;
  specializationScore: number;
  familyScore: number;
  educationScore: number;
  experienceScore: number;
  explanations: string[];
}

export interface MatchRow {
  id: string;
  jobId: string;
  totalScore: number;
  titleScore: number;
  skillsScore: number;
  specializationScore: number;
  familyScore: number;
  educationScore: number;
  experienceScore: number;
  explanations: string[];
  computedAt: string;
  job: JobSummary;
}

export interface CandidateProfile {
  id: string;
  fullName: string;
  phone: string | null;
  county: string | null;
  consentVersion: string;
  consentDate: string | null;
}

export interface EducationRow {
  id: string;
  level: EducationLevel;
  field: string;
  institution: string | null;
  graduationYear: number | null;
}

export interface ClusterRow {
  id: string;
  function: JobFunction;
  specialization?: string | null;
  jobTitles: string[];
  skills: string[];
  yearsExperience: number;
  isSelected: boolean;
}

export interface ProfileResponse {
  profile: CandidateProfile;
  rawCvText: string | null;
  hasUploadedCv: boolean;
  education: EducationRow[];
  clusters: ClusterRow[];
  selectedTrajectoryCount: number;
}

// Display labels for enums (human-readable)
export const FUNCTION_LABELS: Record<JobFunction, string> = {
  // Engineering & Technical
  eng: 'Engineering',
  itt: 'Information Technology',
  cys: 'Cybersecurity',
  // Science & Health
  hlt: 'Healthcare & Medical',
  pha: 'Pharmaceutical & Life Sciences',
  // Business & Finance
  fin: 'Finance & Accounting',
  bfs: 'Banking & Financial Services',
  ins: 'Insurance',
  // Building & Infrastructure
  con: 'Construction & Built Environment',
  min: 'Mining & Resources',
  enu: 'Energy & Utilities',
  mfg: 'Manufacturing & Production',
  // Government & Social
  gpa: 'Government & Public Admin',
  swc: 'Social Work & Community',
  npo: 'Non-Profit & Development',
  // Creative & Media
  mkt: 'Marketing & Advertising',
  cad: 'Creative Arts & Design',
  mec: 'Media & Communications',
  // Sales & Operations
  sal: 'Sales & Business Development',
  osc: 'Operations & Supply Chain',
  // People & Education
  hrm: 'Human Resources',
  edu: 'Education & Training',
  // Professional Services
  leg: 'Legal & Compliance',
  cnt: 'Consulting & Advisory',
  dsa: 'Data Science & Analytics',
  // Trade & Transport
  toh: 'Tourism & Hospitality',
  trl: 'Transportation & Logistics',
  tel: 'Telecommunications',
  aut: 'Automotive',
  ava: 'Aviation & Aerospace',
  // Sector-Specific
  agr: 'Agriculture & Agribusiness',
  ree: 'Real Estate & Property',
  rcg: 'Retail & Consumer Goods',
  ecm: 'E-Commerce & Digital',
  env: 'Environmental & Sustainability',
  // Support Functions
  sed: 'Security & Defense',
  pfm: 'Facilities & Property Management',
  spr: 'Sports & Recreation',
  vah: 'Veterinary & Animal Health',
  wms: 'Waste & Sanitation',
  adm: 'Administration & Office Support',
};

export const SECTOR_LABELS: Record<Sector, string> = {
  technology: 'Technology',
  financial_services: 'Financial Services',
  healthcare: 'Healthcare',
  education: 'Education',
  manufacturing: 'Manufacturing',
  retail: 'Retail',
  agriculture: 'Agriculture',
  construction: 'Construction',
  hospitality: 'Hospitality',
  government: 'Government',
  non_profit: 'Non-Profit',
  media: 'Media',
};

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
  internship: 'Internship',
  temporary: 'Temporary',
  freelance: 'Freelance',
};

export const EDUCATION_LABELS: Record<EducationLevel, string> = {
  none: 'No Formal Education',
  certificate: 'Certificate',
  diploma: 'Diploma',
  bachelors: 'Bachelor\'s Degree',
  masters: 'Master\'s Degree',
  phd: 'PhD',
};

export const EXPLANATION_LABELS: Record<string, string> = {
  exact_function_match: 'Your career family matches this job\'s function',
  strong_skill_overlap: 'Strong overlap between your skills and required skills',
  specialization_match: 'Your specialization matches this job\'s specialization',
  education_meets_minimum: 'Your education meets the minimum requirement',
  education_field_related: 'Your field of study is related to this role',
  experience_meets_minimum: 'Your experience meets the minimum requirement',
  title_keyword_overlap: 'Your past job titles match this role',
};
