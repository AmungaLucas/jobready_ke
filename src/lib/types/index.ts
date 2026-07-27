// Shared TypeScript types for the frontend

export type JobFunction =
  | 'engineering' | 'finance' | 'marketing' | 'sales' | 'operations'
  | 'human_resources' | 'technology' | 'design' | 'customer_service'
  | 'healthcare' | 'education' | 'legal';

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
  educationScore: number;
  fieldScore: number;
  experienceScore: number;
  explanations: string[];
}

export interface MatchRow {
  id: string;
  jobId: string;
  totalScore: number;
  titleScore: number;
  skillsScore: number;
  educationScore: number;
  fieldScore: number;
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
  engineering: 'Engineering',
  finance: 'Finance & Accounting',
  marketing: 'Marketing & Media',
  sales: 'Sales & Business Dev',
  operations: 'Operations & Logistics',
  human_resources: 'Human Resources',
  technology: 'Technology',
  design: 'Design & Creative',
  customer_service: 'Customer Service',
  healthcare: 'Healthcare',
  education: 'Education & Training',
  legal: 'Legal & Compliance',
  // Kenya-market expansions
  agriculture: 'Agriculture & Agribusiness',
  construction: 'Construction & Infrastructure',
  hospitality: 'Hospitality & Tourism',
  transport: 'Transport & Logistics',
  security: 'Security & Safety',
  community_social: 'Community & Social Work',
  manufacturing: 'Manufacturing & Production',
  government: 'Government & Public Admin',
  consulting: 'Consulting & Advisory',
  environment: 'Environment & Natural Resources',
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
  exact_function_match: 'Your career trajectory matches this job\'s function',
  strong_skill_overlap: 'Strong overlap between your skills and required skills',
  education_meets_minimum: 'Your education meets the minimum requirement',
  education_field_related: 'Your field of study is related to this role',
  experience_meets_minimum: 'Your experience meets the minimum requirement',
  title_keyword_overlap: 'Your past job titles match this role',
};
