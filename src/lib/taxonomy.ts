// ============================================================================
// lib/taxonomy.ts
// Career Family taxonomy reference data for JobReady KE.
//
// Structure:
//   - CAREER_FAMILIES: 42 families with code, name, description
//   - SPECIALIZATIONS: ~150 specializations grouped by family
//   - SKILL_LEXICON: ~500 core skills mapped by specialization
//
// This is the SINGLE SOURCE OF TRUTH for all taxonomy data.
// LLM prompts, stub extraction, normalization, and matching all reference this file.
// ============================================================================

import type { JobFunction } from './normalization';

// ============================================================================
// Career Families
// ============================================================================

export interface CareerFamily {
  code: JobFunction;
  name: string;
  description: string;
}

export const CAREER_FAMILIES: CareerFamily[] = [
  // ── Engineering & Technical ──
  { code: 'eng', name: 'Engineering', description: 'Design, build, and maintain physical and technical systems' },
  { code: 'itt', name: 'Information Technology', description: 'Software development, infrastructure, systems administration, and IT support' },
  { code: 'cys', name: 'Cybersecurity', description: 'Information security, threat detection, penetration testing, and security architecture' },

  // ── Science & Health ──
  { code: 'hlt', name: 'Healthcare & Medical', description: 'Clinical care, medical diagnostics, public health, and patient management' },
  { code: 'pha', name: 'Pharmaceutical & Life Sciences', description: 'Drug development, clinical research, pharmacy operations, and pharmacovigilance' },

  // ── Business & Finance ──
  { code: 'fin', name: 'Finance & Accounting', description: 'Financial management, auditing, taxation, and financial planning' },
  { code: 'bfs', name: 'Banking & Financial Services', description: 'Retail and corporate banking, lending, fintech, and microfinance' },
  { code: 'ins', name: 'Insurance', description: 'Risk assessment, underwriting, claims management, and actuarial services' },

  // ── Building & Infrastructure ──
  { code: 'con', name: 'Construction & Built Environment', description: 'Building construction, civil works, architecture, and project management' },
  { code: 'min', name: 'Mining & Resources', description: 'Mineral extraction, mine planning, geology, and resource processing' },
  { code: 'enu', name: 'Energy & Utilities', description: 'Power generation, renewable energy, water systems, and utility management' },
  { code: 'mfg', name: 'Manufacturing & Production', description: 'Factory operations, production planning, quality control, and process engineering' },

  // ── Government & Social ──
  { code: 'gpa', name: 'Government & Public Administration', description: 'Public policy, civil service, municipal administration, and governance' },
  { code: 'swc', name: 'Social Work & Community', description: 'Social services, community development, counseling, and child protection' },
  { code: 'npo', name: 'Non-Profit & Development', description: 'NGO operations, program management, fundraising, and community development' },

  // ── Creative & Media ──
  { code: 'mkt', name: 'Marketing & Advertising', description: 'Brand management, digital marketing, market research, and creative campaigns' },
  { code: 'cad', name: 'Creative Arts & Design', description: 'Graphic design, UX/UI design, photography, videography, and fashion design' },
  { code: 'mec', name: 'Media & Communications', description: 'Journalism, public relations, content creation, and broadcasting' },

  // ── Sales & Operations ──
  { code: 'sal', name: 'Sales & Business Development', description: 'Revenue generation, client acquisition, partnerships, and account management' },
  { code: 'osc', name: 'Operations & Supply Chain', description: 'Procurement, logistics, inventory management, and operational efficiency' },

  // ── People & Education ──
  { code: 'hrm', name: 'Human Resources', description: 'Talent acquisition, employee relations, compensation, and organizational development' },
  { code: 'edu', name: 'Education & Training', description: 'Teaching, curriculum development, academic administration, and vocational training' },

  // ── Professional Services ──
  { code: 'leg', name: 'Legal & Compliance', description: 'Legal advisory, litigation, regulatory compliance, and governance' },
  { code: 'cnt', name: 'Consulting & Advisory', description: 'Management consulting, strategy, business advisory, and professional services' },
  { code: 'dsa', name: 'Data Science & Analytics', description: 'Data engineering, statistical analysis, business intelligence, and visualization' },

  // ── Trade & Transport ──
  { code: 'toh', name: 'Tourism & Hospitality', description: 'Hotel management, travel services, food service, and event planning' },
  { code: 'trl', name: 'Transportation & Logistics', description: 'Fleet management, freight, warehousing, and distribution operations' },
  { code: 'tel', name: 'Telecommunications', description: 'Network engineering, mobile services, satellite communications, and ISP operations' },
  { code: 'aut', name: 'Automotive', description: 'Vehicle assembly, auto repair, parts management, and automotive engineering' },
  { code: 'ava', name: 'Aviation & Aerospace', description: 'Flight operations, air traffic control, aircraft maintenance, and airport management' },

  // ── Sector-Specific ──
  { code: 'agr', name: 'Agriculture & Agribusiness', description: 'Crop production, livestock management, agri-processing, and farm management' },
  { code: 'ree', name: 'Real Estate & Property', description: 'Property management, valuation, real estate development, and agency' },
  { code: 'rcg', name: 'Retail & Consumer Goods', description: 'Store operations, merchandising, buying, and consumer product management' },
  { code: 'ecm', name: 'E-Commerce & Digital', description: 'Online marketplace operations, digital payments, and platform management' },
  { code: 'env', name: 'Environmental & Sustainability', description: 'Environmental management, conservation, ESG compliance, and climate adaptation' },

  // ── Support Functions ──
  { code: 'sed', name: 'Security & Defense', description: 'Physical security, cybersecurity governance, investigation, and defense operations' },
  { code: 'pfm', name: 'Facilities & Property Management', description: 'Building maintenance, space planning, vendor management, and lease administration' },
  { code: 'spr', name: 'Sports & Recreation', description: 'Sports management, coaching, fitness, recreation programming, and event management' },
  { code: 'vah', name: 'Veterinary & Animal Health', description: 'Animal medicine, livestock health, veterinary diagnostics, and animal welfare' },
  { code: 'wms', name: 'Waste & Sanitation Management', description: 'Waste collection, recycling, water treatment, and public sanitation' },
  { code: 'adm', name: 'Administration & Office Support', description: 'Reception, office management, data entry, and executive assistance' },
];

// Lookup maps
export const FAMILY_BY_CODE = new Map(CAREER_FAMILIES.map((f) => [f.code, f]));
export const FAMILY_BY_NAME = new Map(CAREER_FAMILIES.map((f) => [f.name.toLowerCase(), f]));

// ============================================================================
// Specializations (grouped by family)
// ============================================================================

export interface Specialization {
  code: string;   // e.g. "ITT-NET"
  familyCode: JobFunction;
  name: string;
  description: string;
}

export const SPECIALIZATIONS: Specialization[] = [
  // ── ENG ──
  { code: 'ENG-MEC', familyCode: 'eng', name: 'Mechanical Engineering', description: 'Design, analysis, and maintenance of mechanical systems and machinery' },
  { code: 'ENG-ELE', familyCode: 'eng', name: 'Electrical Engineering', description: 'Power systems, electrical design, and electrical infrastructure' },
  { code: 'ENG-CIV', familyCode: 'eng', name: 'Civil Engineering', description: 'Structural design, transportation infrastructure, and geotechnical engineering' },
  { code: 'ENG-CHE', familyCode: 'eng', name: 'Chemical Engineering', description: 'Process design, chemical processing, and petrochemical operations' },
  { code: 'ENG-IND', familyCode: 'eng', name: 'Industrial Engineering', description: 'Process optimization, lean manufacturing, and systems efficiency' },
  { code: 'ENG-AUT', familyCode: 'eng', name: 'Automation & Control', description: 'PLC, SCADA, DCS, robotics, and industrial automation systems' },
  { code: 'ENG-ENE', familyCode: 'eng', name: 'Energy Engineering', description: 'Power plant design, renewable energy systems, and energy management' },
  { code: 'ENG-QUA', familyCode: 'eng', name: 'Quality Engineering', description: 'Quality systems, inspection, testing, and reliability engineering' },
  { code: 'ENG-SUR', familyCode: 'eng', name: 'Surveying & Geomatics', description: 'Land surveying, GIS, mapping, and geospatial analysis' },

  // ── ITT ──
  { code: 'ITT-SFT', familyCode: 'itt', name: 'Software Development', description: 'Application development, coding, and software engineering' },
  { code: 'ITT-WEB', familyCode: 'itt', name: 'Web Development', description: 'Frontend, backend, and full-stack web application development' },
  { code: 'ITT-MOB', familyCode: 'itt', name: 'Mobile Development', description: 'iOS, Android, and cross-platform mobile application development' },
  { code: 'ITT-DEV', familyCode: 'itt', name: 'DevOps & SRE', description: 'CI/CD, site reliability, containerization, and infrastructure as code' },
  { code: 'ITT-DBA', familyCode: 'itt', name: 'Database Administration', description: 'Database design, administration, and data management' },
  { code: 'ITT-NET', familyCode: 'itt', name: 'Network Engineering', description: 'Network design, implementation, and network administration' },
  { code: 'ITT-QAT', familyCode: 'itt', name: 'QA & Testing', description: 'Software testing, quality assurance, and test automation' },
  { code: 'ITT-UID', familyCode: 'itt', name: 'UI/UX Design', description: 'User interface design, user experience research, and interaction design' },
  { code: 'ITT-DTA', familyCode: 'itt', name: 'Data Engineering', description: 'Data pipeline development, ETL, and data architecture' },
  { code: 'ITT-HLP', familyCode: 'itt', name: 'IT Support & Helpdesk', description: 'Technical support, troubleshooting, and end-user computing' },

  // ── CYS ──
  { code: 'CYS-SOC', familyCode: 'cys', name: 'Security Operations Center', description: 'Security monitoring, incident response, and threat hunting' },
  { code: 'CYS-PEN', familyCode: 'cys', name: 'Penetration Testing', description: 'Vulnerability assessment, penetration testing, and red teaming' },
  { code: 'CYS-GOV', familyCode: 'cys', name: 'Security Governance', description: 'Security policy, risk management, and compliance frameworks' },
  { code: 'CYS-FRS', familyCode: 'cys', name: 'Forensics & Incident Response', description: 'Digital forensics, incident investigation, and evidence analysis' },

  // ── HLT ──
  { code: 'HLT-MED', familyCode: 'hlt', name: 'General Medicine', description: 'Primary care, internal medicine, and general practice' },
  { code: 'HLT-SUR', familyCode: 'hlt', name: 'Surgery', description: 'General and specialized surgical procedures and perioperative care' },
  { code: 'HLT-NUR', familyCode: 'hlt', name: 'Nursing', description: 'Patient care, clinical nursing, and nursing administration' },
  { code: 'HLT-PHA', familyCode: 'hlt', name: 'Pharmacy', description: 'Drug dispensing, pharmacology, and pharmaceutical care' },
  { code: 'HLT-LAB', familyCode: 'hlt', name: 'Medical Laboratory', description: 'Clinical laboratory science, diagnostics, and pathology' },
  { code: 'HLT-PUB', familyCode: 'hlt', name: 'Public Health', description: 'Epidemiology, health policy, disease prevention, and community health' },
  { code: 'HLT-PSY', familyCode: 'hlt', name: 'Psychiatry & Mental Health', description: 'Mental health care, psychiatric treatment, and counseling' },

  // ── PHA ──
  { code: 'PHA-RND', familyCode: 'pha', name: 'Pharmaceutical R&D', description: 'Drug discovery, formulation, and clinical trials' },
  { code: 'PHA-REG', familyCode: 'pha', name: 'Pharmacovigilance & Regulatory', description: 'Drug safety, regulatory affairs, and compliance' },
  { code: 'PHA-MFG', familyCode: 'pha', name: 'Pharmaceutical Manufacturing', description: 'Drug production, GMP, and pharmaceutical operations' },
  { code: 'PHA-SAL', familyCode: 'pha', name: 'Pharmaceutical Sales', description: 'Medical detailing, pharma sales, and key opinion leader engagement' },

  // ── FIN ──
  { code: 'FIN-AUD', familyCode: 'fin', name: 'Auditing', description: 'Internal and external auditing, forensic accounting, and compliance audit' },
  { code: 'FIN-TAX', familyCode: 'fin', name: 'Taxation', description: 'Tax planning, tax compliance, and tax advisory services' },
  { code: 'FIN-ACC', familyCode: 'fin', name: 'Financial Accounting', description: 'Financial reporting, bookkeeping, and general ledger management' },
  { code: 'FIN-MGT', familyCode: 'fin', name: 'Management Accounting', description: 'Cost accounting, budgeting, and financial analysis' },
  { code: 'FIN-INV', familyCode: 'fin', name: 'Investment & Asset Management', description: 'Portfolio management, investment analysis, and wealth management' },

  // ── BFS ──
  { code: 'BFS-RET', familyCode: 'bfs', name: 'Retail Banking', description: 'Personal banking, savings, loans, and branch operations' },
  { code: 'BFS-COR', familyCode: 'bfs', name: 'Corporate & Investment Banking', description: 'Corporate lending, investment banking, and capital markets' },
  { code: 'BFS-MIC', familyCode: 'bfs', name: 'Microfinance', description: 'Micro-lending, group lending, and financial inclusion' },
  { code: 'BFS-MBN', familyCode: 'bfs', name: 'Mobile & Digital Banking', description: 'Mobile money, digital wallets, and fintech banking' },
  { code: 'BFS-RCM', familyCode: 'bfs', name: 'Risk & Credit Management', description: 'Credit scoring, risk assessment, and loan portfolio management' },

  // ── INS ──
  { code: 'INS-UND', familyCode: 'ins', name: 'Underwriting', description: 'Risk evaluation, policy pricing, and underwriting decisions' },
  { code: 'INS-CLM', familyCode: 'ins', name: 'Claims Management', description: 'Claims processing, assessment, and settlement' },
  { code: 'INS-ACT', familyCode: 'ins', name: 'Actuarial Services', description: 'Risk modeling, pricing, and statistical analysis' },
  { code: 'INS-BRK', familyCode: 'ins', name: 'Insurance Broking', description: 'Insurance advisory, brokerage, and client service' },

  // ── CON ──
  { code: 'CON-BLD', familyCode: 'con', name: 'Building Construction', description: 'Residential, commercial, and institutional building construction' },
  { code: 'CON-CIV', familyCode: 'con', name: 'Civil Works & Infrastructure', description: 'Roads, bridges, water systems, and civil infrastructure' },
  { code: 'CON-ARC', familyCode: 'con', name: 'Architecture & Design', description: 'Architectural design, building planning, and space design' },
  { code: 'CON-QSM', familyCode: 'con', name: 'Quantity Surveying', description: 'Cost estimation, measurement, and construction economics' },
  { code: 'CON-SIT', familyCode: 'con', name: 'Site Management', description: 'Construction site supervision, safety, and project coordination' },

  // ── MIN ──
  { code: 'MIN-SRF', familyCode: 'min', name: 'Surface Mining', description: 'Open-pit mining, strip mining, and quarrying operations' },
  { code: 'MIN-GEO', familyCode: 'min', name: 'Geology & Exploration', description: 'Geological surveying, mineral exploration, and resource estimation' },
  { code: 'MIN-PRO', familyCode: 'min', name: 'Mineral Processing', description: 'Crushing, grinding, flotation, and extractive metallurgy' },

  // ── ENU ──
  { code: 'ENU-REN', familyCode: 'enu', name: 'Renewable Energy', description: 'Solar, wind, hydro, and geothermal energy systems' },
  { code: 'ENU-PPG', familyCode: 'enu', name: 'Power Generation', description: 'Thermal, nuclear, and conventional power plant operations' },
  { code: 'ENU-TND', familyCode: 'enu', name: 'Transmission & Distribution', description: 'Power grid, substations, and electrical transmission' },

  // ── MFG ──
  { code: 'MFG-ASM', familyCode: 'mfg', name: 'Assembly & Production', description: 'Product assembly, line operations, and production execution' },
  { code: 'MFG-PRC', familyCode: 'mfg', name: 'Process Engineering', description: 'Manufacturing process design, optimization, and control' },
  { code: 'MFG-MNT', familyCode: 'mfg', name: 'Maintenance & Reliability', description: 'Plant maintenance, predictive maintenance, and reliability engineering' },
  { code: 'MFG-QLT', familyCode: 'mfg', name: 'Quality Control', description: 'Product inspection, testing, and quality management systems' },
  { code: 'MFG-WLD', familyCode: 'mfg', name: 'Welding & Fabrication', description: 'Welding, metal fabrication, and structural steelwork' },

  // ── GPA ──
  { code: 'GPA-POL', familyCode: 'gpa', name: 'Public Policy', description: 'Policy development, analysis, and government strategy' },
  { code: 'GPA-CIV', familyCode: 'gpa', name: 'Civil Service', description: 'Public administration, government operations, and service delivery' },
  { code: 'GPA-MUN', familyCode: 'gpa', name: 'Municipal & Local Government', description: 'County/municipal governance, urban planning, and local services' },

  // ── SWC ──
  { code: 'SWC-CSW', familyCode: 'swc', name: 'Community Social Work', description: 'Community development, social services, and case management' },
  { code: 'SWC-CHD', familyCode: 'swc', name: 'Child & Family Services', description: 'Child protection, family support, and welfare services' },
  { code: 'SWC-CNS', familyCode: 'swc', name: 'Counseling & Psychotherapy', description: 'Psychological counseling, therapy, and mental health support' },

  // ── NPO ──
  { code: 'NPO-PRG', familyCode: 'npo', name: 'Program Management', description: 'Development programs, project implementation, and M&E' },
  { code: 'NPO-FND', familyCode: 'npo', name: 'Fundraising & Grants', description: 'Grant writing, donor relations, and fundraising strategy' },
  { code: 'NPO-MNE', familyCode: 'npo', name: 'Monitoring & Evaluation', description: 'Program evaluation, impact assessment, and data collection' },
  { code: 'NPO-ADV', familyCode: 'npo', name: 'Advocacy & Campaigns', description: 'Policy advocacy, public campaigns, and community mobilization' },
  { code: 'NPO-HUM', familyCode: 'npo', name: 'Humanitarian & Emergency', description: 'Disaster response, relief operations, and humanitarian coordination' },

  // ── MKT ──
  { code: 'MKT-DIG', familyCode: 'mkt', name: 'Digital Marketing', description: 'SEO, SEM, social media marketing, and online advertising' },
  { code: 'MKT-BRD', familyCode: 'mkt', name: 'Brand Management', description: 'Brand strategy, brand identity, and brand positioning' },
  { code: 'MKT-MRE', familyCode: 'mkt', name: 'Market Research & Insights', description: 'Consumer research, data analytics, and market intelligence' },
  { code: 'MKT-COM', familyCode: 'mkt', name: 'Communications & PR', description: 'Public relations, corporate communications, and media relations' },

  // ── CAD ──
  { code: 'CAD-GRD', familyCode: 'cad', name: 'Graphic Design', description: 'Visual design, branding, print design, and digital graphics' },
  { code: 'CAD-UXD', familyCode: 'cad', name: 'UX/UI Design', description: 'User experience, interface design, and design systems' },
  { code: 'CAD-PHO', familyCode: 'cad', name: 'Photography & Videography', description: 'Photography, video production, and visual storytelling' },
  { code: 'CAD-FSH', familyCode: 'cad', name: 'Fashion & Textile Design', description: 'Fashion design, textile design, and apparel creation' },

  // ── MEC ──
  { code: 'MEC-JRN', familyCode: 'mec', name: 'Journalism & News', description: 'News reporting, editing, and investigative journalism' },
  { code: 'MEC-BRD', familyCode: 'mec', name: 'Broadcasting & Production', description: 'TV and radio production, broadcasting, and media production' },
  { code: 'MEC-SOC', familyCode: 'mec', name: 'Social Media & Digital Content', description: 'Social media management, content creation, and digital engagement' },

  // ── SAL ──
  { code: 'SAL-COR', familyCode: 'sal', name: 'Corporate & B2B Sales', description: 'Enterprise sales, account management, and business solutions' },
  { code: 'SAL-KEY', familyCode: 'sal', name: 'Key Account Management', description: 'Strategic account management, relationship building, and retention' },
  { code: 'SAL-TEC', familyCode: 'sal', name: 'Technical Sales', description: 'Solution selling, presales engineering, and technical demonstrations' },

  // ── OSC ──
  { code: 'OSC-PRO', familyCode: 'osc', name: 'Procurement & Purchasing', description: 'Strategic sourcing, vendor management, and purchasing operations' },
  { code: 'OSC-LOG', familyCode: 'osc', name: 'Logistics & Distribution', description: 'Transportation, warehousing, and last-mile delivery' },
  { code: 'OSC-SCM', familyCode: 'osc', name: 'Supply Chain Management', description: 'End-to-end supply chain strategy, optimization, and analytics' },

  // ── HRM ──
  { code: 'HRM-REC', familyCode: 'hrm', name: 'Talent Acquisition & Recruitment', description: 'Sourcing, interviewing, hiring, and onboarding' },
  { code: 'HRM-CBN', familyCode: 'hrm', name: 'Compensation & Benefits', description: 'Payroll, salary structures, benefits administration, and rewards' },
  { code: 'HRM-TRN', familyCode: 'hrm', name: 'Learning & Development', description: 'Training programs, skills development, and organizational learning' },
  { code: 'HRM-ODV', familyCode: 'hrm', name: 'Organizational Development', description: 'Change management, culture, and organizational design' },

  // ── EDU ──
  { code: 'EDU-EAR', familyCode: 'edu', name: 'Early Childhood Education', description: 'Pre-school, kindergarten, and early childhood development' },
  { code: 'EDU-SEC', familyCode: 'edu', name: 'Secondary Education', description: 'High school teaching and subject specialization' },
  { code: 'EDU-TER', familyCode: 'edu', name: 'Tertiary Education', description: 'University teaching, lecturing, and academic research' },
  { code: 'EDU-VOG', familyCode: 'edu', name: 'Vocational & Technical Education', description: 'TVET, skills training, and practical education' },
  { code: 'EDU-ADM', familyCode: 'edu', name: 'Education Administration', description: 'School leadership, education management, and policy' },

  // ── LEG ──
  { code: 'LEG-COR', familyCode: 'leg', name: 'Corporate & Commercial Law', description: 'Business law, M&A, corporate governance, and contracts' },
  { code: 'LEG-LIT', familyCode: 'leg', name: 'Litigation & Dispute Resolution', description: 'Court representation, arbitration, and dispute resolution' },
  { code: 'LEG-CRI', familyCode: 'leg', name: 'Criminal Law', description: 'Criminal defense, prosecution, and criminal justice' },
  { code: 'LEG-CMP', familyCode: 'leg', name: 'Compliance & Regulatory', description: 'Regulatory compliance, anti-corruption, and governance frameworks' },

  // ── CNT ──
  { code: 'CNT-MGT', familyCode: 'cnt', name: 'Management Consulting', description: 'Strategy consulting, business transformation, and advisory' },
  { code: 'CNT-FIN', familyCode: 'cnt', name: 'Financial Advisory', description: 'Transaction advisory, restructuring, and financial consulting' },
  { code: 'CNT-TCH', familyCode: 'cnt', name: 'Technology Consulting', description: 'IT strategy, digital transformation, and tech advisory' },

  // ── DSA ──
  { code: 'DSA-ANA', familyCode: 'dsa', name: 'Data Analysis', description: 'Statistical analysis, data interpretation, and reporting' },
  { code: 'DSA-BIZ', familyCode: 'dsa', name: 'Business Intelligence', description: 'BI tools, dashboards, KPI reporting, and data warehousing' },
  { code: 'DSA-VIZ', familyCode: 'dsa', name: 'Data Visualization', description: 'Visual analytics, dashboard design, and data storytelling' },
  { code: 'DSA-ENR', familyCode: 'dsa', name: 'Data Engineering', description: 'Data pipelines, ETL, data architecture, and big data' },

  // ── TOH ──
  { code: 'TOH-HOT', familyCode: 'toh', name: 'Hotel & Lodge Management', description: 'Hotel operations, front office, and accommodation management' },
  { code: 'TOH-CUL', familyCode: 'toh', name: 'Culinary & Kitchen', description: 'Chef and kitchen operations, menu planning, and food preparation' },
  { code: 'TOH-TRV', familyCode: 'toh', name: 'Travel & Tours', description: 'Travel agency, tour operations, and travel planning' },

  // ── TRL ──
  { code: 'TRL-FLT', familyCode: 'trl', name: 'Fleet Management', description: 'Vehicle fleet operations, maintenance scheduling, and fleet analytics' },
  { code: 'TRL-FRG', familyCode: 'trl', name: 'Freight & Cargo', description: 'Freight forwarding, cargo handling, and shipping coordination' },
  { code: 'TRL-DRV', familyCode: 'trl', name: 'Professional Driving', description: 'Commercial driving, heavy vehicle operation, and transport logistics' },

  // ── TEL ──
  { code: 'TEL-NET', familyCode: 'tel', name: 'Network Infrastructure', description: 'Telecom network design, deployment, and optimization' },
  { code: 'TEL-MOB', familyCode: 'tel', name: 'Mobile Services', description: 'Mobile network operations, MVNO, and wireless services' },

  // ── AUT ──
  { code: 'AUT-REP', familyCode: 'aut', name: 'Auto Repair & Servicing', description: 'Vehicle diagnostics, repair, and maintenance services' },
  { code: 'AUT-PTS', familyCode: 'aut', name: 'Parts & Accessories', description: 'Auto parts sales, inventory, and supply chain' },

  // ── AVA ──
  { code: 'AVA-PLT', familyCode: 'ava', name: 'Flight Operations', description: 'Piloting, flight planning, and cockpit operations' },
  { code: 'AVA-AMT', familyCode: 'ava', name: 'Aircraft Maintenance', description: 'Aircraft maintenance, repair, overhaul (MRO), and line maintenance' },
  { code: 'AVA-APM', familyCode: 'ava', name: 'Airport Management', description: 'Airport operations, terminal management, and ground services' },

  // ── AGR ──
  { code: 'AGR-CRP', familyCode: 'agr', name: 'Crop Production', description: 'Field crops, horticulture, and agronomy' },
  { code: 'AGR-LIV', familyCode: 'agr', name: 'Livestock & Animal Husbandry', description: 'Cattle, poultry, dairy, and animal production' },
  { code: 'AGR-AGI', familyCode: 'agr', name: 'Agribusiness & Value Chains', description: 'Agricultural business, value addition, and market access' },

  // ── REE ──
  { code: 'REE-AGN', familyCode: 'ree', name: 'Real Estate Agency', description: 'Property sales, leasing, and real estate brokerage' },
  { code: 'REE-MGT', familyCode: 'ree', name: 'Property Management', description: 'Tenant management, property maintenance, and lease administration' },
  { code: 'REE-VAL', familyCode: 'ree', name: 'Property Valuation', description: 'Property appraisal, valuation, and assessment' },

  // ── RCG ──
  { code: 'RCG-STO', familyCode: 'rcg', name: 'Store Operations', description: 'Retail store management, visual merchandising, and customer experience' },
  { code: 'RCG-BUY', familyCode: 'rcg', name: 'Buying & Merchandising', description: 'Product sourcing, assortment planning, and buying strategy' },

  // ── ECM ──
  { code: 'ECM-PLT', familyCode: 'ecm', name: 'Platform Management', description: 'Marketplace operations, seller management, and platform strategy' },
  { code: 'ECM-PAY', familyCode: 'ecm', name: 'Digital Payments', description: 'Mobile money, payment gateways, digital wallets, and fintech' },

  // ── ENV ──
  { code: 'ENV-ESG', familyCode: 'env', name: 'ESG & Sustainability', description: 'ESG reporting, sustainability strategy, and carbon accounting' },
  { code: 'ENV-CNS', familyCode: 'env', name: 'Conservation & Biodiversity', description: 'Wildlife conservation, ecosystem management, and biodiversity' },

  // ── SED ──
  { code: 'SED-PHY', familyCode: 'sed', name: 'Physical Security', description: 'Guarding, access control, and security operations' },
  { code: 'SED-INV', familyCode: 'sed', name: 'Investigation & Intelligence', description: 'Private investigation, fraud detection, and intelligence' },
  { code: 'SED-ELE', familyCode: 'sed', name: 'Electronic Security', description: 'CCTV, alarms, access systems, and security technology' },

  // ── PFM ──
  { code: 'PFM-MNT', familyCode: 'pfm', name: 'Building Maintenance', description: 'Preventive maintenance, HVAC systems, electrical systems' },

  // ── SPR ──
  { code: 'SPR-COA', familyCode: 'spr', name: 'Coaching & Training', description: 'Sports coaching, fitness training, and athletic development' },
  { code: 'SPR-MGT', familyCode: 'spr', name: 'Sports Management', description: 'Sports administration, club management, and sports business' },

  // ── VAH ──
  { code: 'VAH-CLN', familyCode: 'vah', name: 'Veterinary Clinical Practice', description: 'Small and large animal medicine, surgery, and diagnostics' },

  // ── WMS ──
  { code: 'WMS-COL', familyCode: 'wms', name: 'Waste Collection', description: 'Solid waste collection, fleet management, and route optimization' },

  // ── ADM ──
  { code: 'ADM-OFC', familyCode: 'adm', name: 'Office Management', description: 'Office administration, operations, and facilities coordination' },
  { code: 'ADM-EXC', familyCode: 'adm', name: 'Executive Assistance', description: 'Executive PA, C-suite support, and board administration' },
  { code: 'ADM-DTE', familyCode: 'adm', name: 'Data Entry & Clerical', description: 'Data entry, typing, filing, and clerical support' },
];

// Lookup maps
export const SPEC_BY_CODE = new Map(SPECIALIZATIONS.map((s) => [s.code, s]));
export const SPECS_BY_FAMILY = new Map<string, Specialization[]>();
for (const spec of SPECIALIZATIONS) {
  const list = SPECS_BY_FAMILY.get(spec.familyCode) ?? [];
  list.push(spec);
  SPECS_BY_FAMILY.set(spec.familyCode, list);
}

// ============================================================================
// Skills (mapped by specialization code)
// Each specialization has an array of canonical skill names.
// Duplicates across specializations are intentional — skills are many-to-many.
// ============================================================================

export const SKILLS_BY_SPECIALIZATION: Record<string, string[]> = {
  // ── ENG-MEC ──
  'ENG-MEC': [
    'AutoCAD', 'SolidWorks', 'CATIA', 'ANSYS', 'MATLAB', 'Thermodynamics',
    'Fluid Mechanics', 'Heat Transfer', 'Machine Design', 'FEA', 'GD&T',
    'HVAC Design', 'Piping Design', 'Pressure Vessel Design', 'Welding Engineering',
    'Materials Science', 'Metallurgy', 'Failure Analysis', 'Predictive Maintenance',
    'Condition Monitoring', 'Vibration Analysis', 'NDT', 'SAP PM', 'CMMS',
    'Mechanical Drawing', 'Technical Drawing', '3D Modeling',
  ],

  // ── ENG-ELE ──
  'ENG-ELE': [
    'Power Systems Analysis', 'Short Circuit Analysis', 'Protection Coordination',
    'Electrical Design', 'Cable Sizing', 'Load Flow Analysis', 'ETAP',
    'PLC Basics', 'Substation Design', 'Transformer Sizing', 'Switchgear Selection',
    'Solar PV Systems', 'Electrical Safety', 'AutoCAD Electrical', 'EPLAN',
  ],

  // ── ENG-CIV ──
  'ENG-CIV': [
    'Structural Analysis', 'Structural Design', 'Reinforced Concrete Design',
    'Steel Design', 'Foundation Design', 'STAAD Pro', 'SAP2000', 'ETABS',
    'AutoCAD Civil 3D', 'Road Design', 'Drainage Design', 'Site Planning',
    'Concrete Technology', 'Soil Mechanics', 'Geotechnical Investigation',
    'Bridge Design', 'Traffic Analysis', 'Transportation Planning',
  ],

  // ── ENG-IND ──
  'ENG-IND': [
    'Lean Manufacturing', 'Six Sigma', '5S', 'Kaizen', 'Value Stream Mapping',
    'Process Mapping', 'Time & Motion Study', 'Facility Layout', 'Line Balancing',
    'Kanban', 'Just-in-Time', 'Minitab', 'FMEA', 'Process Improvement',
  ],

  // ── ENG-AUT ──
  'ENG-AUT': [
    'PLC Programming', 'Siemens S7', 'Allen-Bradley', 'SCADA Systems',
    'Wonderware', 'WinCC', 'DCS Systems', 'HMI Design', 'Control Logic Design',
    'Instrumentation', 'PID Tuning', 'Process Control', 'VFD Configuration',
    'Motion Control', 'Robotics', 'OPC UA', 'Modbus',
  ],

  // ── ENG-SUR ──
  'ENG-SUR': [
    'Land Surveying', 'GPS Survey', 'Total Station', 'GIS', 'QGIS', 'ArcGIS',
    'Cadastral Surveying', 'Topographic Survey', 'LiDAR', 'Spatial Analysis',
  ],

  // ── ITT-SFT ──
  'ITT-SFT': [
    'Python', 'Java', 'JavaScript', 'TypeScript', 'C#', 'PHP', 'Go', 'Rust',
    'React', 'Angular', 'Vue.js', 'Next.js', 'Node.js', 'Django', 'Spring Boot',
    '.NET', 'REST API', 'GraphQL', 'SQL', 'Git', 'Docker', 'Kubernetes',
    'CI/CD', 'AWS', 'Azure', 'GCP', 'Terraform', 'Linux', 'Unit Testing',
    'Agile', 'Scrum', 'Microservices', 'System Design',
  ],

  // ── ITT-WEB ──
  'ITT-WEB': [
    'HTML5', 'CSS3', 'JavaScript', 'TypeScript', 'React', 'Next.js',
    'Vue.js', 'Tailwind CSS', 'SASS', 'Webpack', 'Vite',
    'SEO', 'Responsive Design', 'Figma', 'Accessibility', 'WCAG',
  ],

  // ── ITT-MOB ──
  'ITT-MOB': [
    'React Native', 'Flutter', 'Swift', 'SwiftUI', 'Kotlin',
    'Jetpack Compose', 'Xcode', 'Android Studio', 'Firebase', 'Push Notifications',
  ],

  // ── ITT-DEV ──
  'ITT-DEV': [
    'Docker', 'Kubernetes', 'Helm', 'Terraform', 'CloudFormation',
    'Ansible', 'AWS', 'Azure', 'GCP', 'CI/CD', 'Jenkins', 'GitHub Actions',
    'Prometheus', 'Grafana', 'Linux Administration', 'Nginx',
    'Infrastructure as Code', 'GitOps',
  ],

  // ── ITT-DBA ──
  'ITT-DBA': [
    'MySQL', 'PostgreSQL', 'Oracle Database', 'SQL Server', 'MongoDB',
    'Redis', 'Elasticsearch', 'Database Design', 'Normalization', 'Indexing',
    'Query Optimization', 'Backup & Recovery', 'Database Security', 'Performance Tuning',
  ],

  // ── ITT-NET ──
  'ITT-NET': [
    'TCP/IP', 'DNS', 'DHCP', 'VPN', 'Cisco IOS', 'MikroTik RouterOS',
    'BGP', 'OSPF', 'VLAN', 'STP', 'SD-WAN', 'MPLS',
    'Firewall Configuration', 'Cisco ASA', 'Palo Alto', 'Fortinet',
    'Network Monitoring', 'Nagios', 'Zabbix', 'Wi-Fi',
    'Network Design', 'Network Security', 'Fiber Optics',
    'Wireless Networking', 'UniFi', 'Huawei CloudEngine', 'Cisco Nexus',
  ],

  // ── ITT-QAT ──
  'ITT-QAT': [
    'Manual Testing', 'Test Automation', 'Selenium', 'Cypress', 'Playwright',
    'API Testing', 'Postman', 'Performance Testing', 'JMeter', 'Jest',
    'TDD', 'BDD', 'Cucumber',
  ],

  // ── ITT-UID ──
  'ITT-UID': [
    'User Research', 'Usability Testing', 'Wireframing', 'Prototyping',
    'Figma', 'Sketch', 'Adobe XD', 'User Journey Mapping', 'Information Architecture',
    'Interaction Design', 'Visual Design', 'Design Systems',
  ],

  // ── ITT-DTA ──
  'ITT-DTA': [
    'Apache Spark', 'Apache Kafka', 'Apache Airflow', 'ETL', 'Data Pipelines',
    'Data Lakes', 'Snowflake', 'Databricks', 'BigQuery', 'Python', 'SQL', 'Scala',
    'Data Quality', 'Data Governance',
  ],

  // ── ITT-HLP ──
  'ITT-HLP': [
    'Active Directory', 'Microsoft 365', 'Google Workspace', 'ServiceNow',
    'Windows 10/11', 'macOS', 'Linux Desktop', 'Printer Management',
    'Network Troubleshooting', 'Hardware Repair', 'Endpoint Security',
    'Patch Management', 'User Provisioning',
  ],

  // ── CYS-SOC ──
  'CYS-SOC': [
    'SIEM', 'Splunk', 'QRadar', 'Sentinel', 'Incident Response',
    'Threat Hunting', 'Malware Analysis', 'SOAR', 'Threat Intelligence',
    'MITRE ATT&CK', 'Playbooks',
  ],

  // ── CYS-PEN ──
  'CYS-PEN': [
    'Penetration Testing', 'Vulnerability Assessment', 'Burp Suite', 'Nmap',
    'Metasploit', 'Nessus', 'OWASP Top 10', 'Web Application Testing',
  ],

  // ── CYS-GOV ──
  'CYS-GOV': [
    'ISO 27001', 'NIST Framework', 'SOC 2', 'PCI DSS', 'Risk Assessment',
    'Security Policy', 'Compliance', 'Business Continuity', 'Security Architecture',
  ],

  // ── HLT-MED ──
  'HLT-MED': [
    'Clinical Diagnosis', 'Patient Assessment', 'Medical History Taking',
    'Treatment Planning', 'Clinical Decision Making', 'Evidence-Based Medicine',
    'Vital Signs Monitoring', 'Infection Control', 'Wound Care', 'IV Therapy',
    'Pharmacology', 'Drug Administration', 'Patient Counseling',
  ],

  // ── HLT-NUR ──
  'HLT-NUR': [
    'Patient Care', 'Medication Administration', 'Nursing Assessment',
    'Wound Management', 'Infection Prevention', 'Patient Education', 'Triage',
    'IV Therapy', 'Vital Signs', 'Patient Monitoring', 'Nursing Documentation',
    'Palliative Care', 'Pain Management', 'Midwifery', 'Maternal Healthcare',
  ],

  // ── HLT-LAB ──
  'HLT-LAB': [
    'Hematology', 'Microbiology', 'Clinical Chemistry', 'Blood Banking',
    'PCR', 'ELISA', 'Histology', 'ISO 15189', 'Laboratory Quality Control',
  ],

  // ── HLT-PUB ──
  'HLT-PUB': [
    'Epidemiology', 'Disease Surveillance', 'Health Promotion',
    'Maternal & Child Health', 'Immunization Programs', 'Health Education',
    'M&E - Health Programs', 'Health Policy', 'Disease Prevention',
  ],

  // ── PHA-SAL ──
  'PHA-SAL': [
    'Medical Detailing', 'Pharmaceutical Sales', 'Key Opinion Leader Engagement',
    'Clinical Knowledge', 'Drug Information', 'Sales Force Effectiveness',
  ],

  // ── FIN-AUD ──
  'FIN-AUD': [
    'Internal Audit', 'External Audit', 'Risk-Based Auditing', 'Audit Procedures',
    'ISA Standards', 'ISA 315', 'ISA 540', 'Forensic Accounting', 'Fraud Detection',
    'Compliance Audit', 'Audit Report Writing',
  ],

  // ── FIN-TAX ──
  'FIN-TAX': [
    'Tax Planning', 'Tax Compliance', 'Corporate Tax', 'Personal Tax',
    'VAT', 'Withholding Tax', 'Transfer Pricing', 'Tax Returns',
  ],

  // ── FIN-ACC ──
  'FIN-ACC': [
    'Financial Reporting', 'IFRS', 'GAAP', 'Bookkeeping', 'General Ledger',
    'Accounts Payable', 'Accounts Receivable', 'Bank Reconciliation',
    'Sage', 'QuickBooks', 'Xero', 'SAP FI', 'Excel', 'VLOOKUP', 'Pivot Tables',
    'Payroll', 'PAYE', 'NSSF', 'SHIF', 'Statutory Deductions',
  ],

  // ── FIN-MGT ──
  'FIN-MGT': [
    'Management Accounting', 'Cost Accounting', 'Budgeting', 'Forecasting',
    'Financial Modeling', 'Power BI', 'Tableau', 'Advanced Excel',
  ],

  // ── FIN-INV ──
  'FIN-INV': [
    'Portfolio Management', 'Investment Analysis', 'Asset Allocation',
    'Bloomberg Terminal', 'Financial Modeling', 'Valuation', 'DCF Analysis',
  ],

  // ── BFS-RET ──
  'BFS-RET': [
    'Retail Banking', 'Account Opening', 'Cash Handling', 'Loan Processing',
    'Credit Assessment', 'KYC', 'AML', 'Mobile Banking', 'Branch Operations',
    'FINNACLE', 'Flexcube', 'ALO System', 'Credit Quest', 'PERFIOS',
    'Compliance', 'Regulatory Reporting',
  ],

  // ── BFS-COR ──
  'BFS-COR': [
    'Corporate Banking', 'Trade Finance', 'Letters of Credit',
    'Syndicated Lending', 'Project Finance', 'Foreign Exchange',
    'Relationship Management', 'Risk Assessment', 'Financial Analysis',
  ],

  // ── BFS-MIC ──
  'BFS-MIC': [
    'Microfinance', 'Group Lending', 'Micro-Insurance', 'Financial Inclusion',
    'Agent Banking', 'Mobile Money', 'Credit Scoring', 'Digital Financial Services',
  ],

  // ── INS-UND ──
  'INS-UND': [
    'Underwriting', 'Risk Assessment', 'Policy Pricing', 'Claims Assessment',
    'Reinsurance', 'Premium Calculation', 'Loss Ratio Analysis',
  ],

  // ── CON-ARC ──
  'CON-ARC': [
    'Architectural Design', 'Building Planning', 'Space Planning', 'Revit',
    'AutoCAD Architecture', 'SketchUp', '3ds Max', 'BIM',
    'Green Building Design', 'Building Regulations',
  ],

  // ── CON-BLD ──
  'CON-BLD': [
    'Building Construction', 'Concrete Works', 'Steel Structures', 'Blockwork',
    'Plastering', 'Roofing', 'Scaffolding', 'Formwork', 'Site Supervision',
  ],

  // ── CON-QSM ──
  'CON-QSM': [
    'Quantity Surveying', 'Cost Estimation', 'Bill of Quantities',
    'Cost Planning', 'Value Engineering', 'Cost Control', 'Contract Administration',
  ],

  // ── NPO-PRG ──
  'NPO-PRG': [
    'Program Design', 'Logical Framework', 'Theory of Change', 'Proposal Writing',
    'Donor Reporting', 'Budget Management', 'Stakeholder Engagement',
    'Community Mobilization', 'Gender Mainstreaming', 'Results-Based Management',
  ],

  // ── NPO-MNE ──
  'NPO-MNE': [
    'Monitoring & Evaluation', 'Logic Models', 'Indicator Development',
    'Survey Design', 'Impact Evaluation', 'Data Collection Methods',
    'M&E Frameworks', 'Kobo Toolbox', 'Redcap',
  ],

  // ── NPO-HUM ──
  'NPO-HUM': [
    'Humanitarian Response', 'Disaster Response', 'Relief Operations',
    'Food Distribution', 'Beneficiary Targeting', 'Community Cash Transfers',
    'Post Distribution Monitoring', 'DFID', 'USAID', 'WFP', 'UNICEF',
  ],

  // ── EDU-SEC ──
  'EDU-SEC': [
    'Lesson Planning', 'Curriculum Delivery', 'Classroom Management',
    'Student Assessment', 'Differentiated Instruction', 'Pedagogy',
    'Formative Assessment', 'Summative Assessment', 'Subject Matter Expertise',
    'KCSE Curriculum', 'TSC Registration',
  ],

  // ── EDU-TER ──
  'EDU-TER': [
    'Lecturing', 'Academic Research', 'Research Methodology', 'Publishing',
    'Grant Writing', 'Supervision', 'Thesis Examination',
  ],

  // ── LEG-COR ──
  'LEG-COR': [
    'Corporate Law', 'Company Formation', 'Corporate Governance',
    'Contract Drafting', 'Contract Review', 'Due Diligence',
    'M&A Transactions', 'Legal Research', 'Legal Writing',
  ],

  // ── LEG-LIT ──
  'LEG-LIT': [
    'Litigation', 'Court Procedures', 'Case Management', 'Legal Research',
    'Brief Writing', 'Oral Advocacy', 'Arbitration', 'Negotiation',
    'Trial Preparation',
  ],

  // ── LEG-CRI ──
  'LEG-CRI': [
    'Criminal Law', 'Criminal Defense', 'Prosecution', 'Criminal Justice',
    'Evidence', 'Court Procedures',
  ],

  // ── MKT-DIG ──
  'MKT-DIG': [
    'SEO', 'SEM', 'Google Ads', 'Facebook Ads', 'Google Analytics',
    'Email Marketing', 'Social Media Management', 'Content Marketing',
    'Hootsuite', 'A/B Testing', 'Growth Hacking',
  ],

  // ── SAL-COR ──
  'SAL-COR': [
    'B2B Sales', 'Consultative Selling', 'Solution Selling',
    'Sales Pipeline Management', 'CRM', 'Salesforce', 'Lead Generation',
    'Negotiation', 'Sales Presentations', 'Proposal Writing',
  ],

  // ── DSA-ANA ──
  'DSA-ANA': [
    'Python', 'R', 'SQL', 'Statistics', 'Machine Learning',
    'Pandas', 'NumPy', 'Matplotlib', 'Seaborn', 'Jupyter Notebook',
    'Regression Analysis', 'Clustering', 'Classification', 'A/B Testing',
  ],

  // ── DSA-BIZ ──
  'DSA-BIZ': [
    'Power BI', 'Tableau', 'SQL', 'Excel', 'Dashboard Design',
    'KPI Development', 'Data Modeling', 'Data Visualization',
  ],

  // ── TOH-HOT ──
  'TOH-HOT': [
    'Hotel Operations', 'Front Office Management', 'Revenue Management',
    'Guest Relations', 'Opera PMS', 'Hotel Budgeting',
  ],

  // ── TOH-CUL ──
  'TOH-CUL': [
    'Food Preparation', 'Menu Planning', 'Kitchen Management', 'Food Safety',
    'HACCP', 'Food Costing', 'Recipe Development',
  ],

  // ── TEL-NET ──
  'TEL-NET': [
    'Telecom Network Design', 'RF Engineering', 'Network Optimization',
    '2G/3G/4G/5G Networks', 'RAN Planning', 'Core Network', 'Fiber Optic Design',
    'Ericsson', 'Huawei', 'Nokia', 'ZTE',
  ],

  // ── ECM-PAY ──
  'ECM-PAY': [
    'Mobile Money', 'M-Pesa', 'Payment Gateway', 'Digital Wallets',
    'USSD', 'API Integration', 'PCI DSS Compliance', 'Fraud Prevention',
  ],

  // ── ENV-ESG ──
  'ENV-ESG': [
    'ESG Reporting', 'Sustainability Reporting', 'GRI Standards', 'SASB',
    'TCFD', 'Carbon Footprint', 'GHG Accounting', 'Climate Risk Assessment',
  ],

  // ── OSC-PRO ──
  'OSC-PRO': [
    'Strategic Sourcing', 'Vendor Management', 'Contract Negotiation',
    'Purchase Orders', 'SAP MM', 'Spend Analysis', 'RFQ/RFP Process',
  ],

  // ── OSC-LOG ──
  'OSC-LOG': [
    'Freight Forwarding', 'Customs Clearance', 'Import/Export', 'Incoterms',
    'Warehouse Management', 'Inventory Control', 'Fleet Management',
    'Last Mile Delivery',
  ],

  // ── HRM-REC ──
  'HRM-REC': [
    'Sourcing', 'Boolean Search', 'LinkedIn Recruiting', 'Candidate Screening',
    'Interview Techniques', 'ATS Systems', 'Workday', 'BambooHR',
    'Onboarding', 'Employer Branding',
  ],

  // ── HRM-CBN ──
  'HRM-CBN': [
    'Payroll Processing', 'Salary Structures', 'Job Grading',
    'Benefits Administration', 'Pension Management', 'Medical Insurance',
    'Statutory Deductions', 'Compensation Benchmarking',
  ],

  // ── AGR-CRP ──
  'AGR-CRP': [
    'Crop Management', 'Soil Science', 'Plant Nutrition', 'Irrigation',
    'Pest Management', 'Crop Rotation', 'Greenhouse Management', 'Precision Agriculture',
  ],

  // ── AGR-LIV ──
  'AGR-LIV': [
    'Animal Husbandry', 'Animal Nutrition', 'Animal Breeding', 'Herd Health Management',
    'Dairy Farming', 'Poultry Farming', 'Pasture Management',
  ],

  // ── REE-AGN ──
  'REE-AGN': [
    'Property Sales', 'Property Leasing', 'Real Estate Brokerage',
    'Property Marketing', 'Client Relations', 'Property Valuation Basics',
  ],

  // ── SED-PHY ──
  'SED-PHY': [
    'Physical Security', 'Guarding', 'Access Control', 'Security Operations',
    'Surveillance Systems', 'CCTV', 'Incident Reporting',
    'Loss Prevention', 'Emergency Response',
  ],

  // ── ADM-OFC ──
  'ADM-OFC': [
    'Office Administration', 'Records Management', 'Filing', 'Scheduling',
    'Office Equipment', 'Vendor Coordination', 'Meeting Coordination',
    'Microsoft Office Suite', 'Email Management',
  ],

  // ── ADM-DTE ──
  'ADM-DTE': [
    'Data Entry', 'Typing', 'Records Keeping', 'Filing',
    'Microsoft Office Suite', 'Excel', 'Attention to Detail',
  ],

  // ── SWC-CSW ──
  'SWC-CSW': [
    'Community Development', 'Social Services', 'Case Management',
    'Community Mobilization', 'Beneficiary Targeting', 'Counseling',
    'Humanitarian Response', 'Food Aid', 'Cash Transfers', 'Drought Assessment',
  ],

  // ── SWC-CNS ──
  'SWC-CNS': [
    'Psychological Counseling', 'Therapy', 'Mental Health Support',
    'Crisis Intervention', 'Trauma-Informed Care',
  ],
};

// Build a flat skill set (unique across all specializations)
export const ALL_SKILLS: string[] = Array.from(
  new Set(Object.values(SKILLS_BY_SPECIALIZATION).flat()),
).sort();

// ============================================================================
// Soft Skills (cross-cutting)
// ============================================================================

export const SOFT_SKILLS: string[] = [
  'Communication', 'Teamwork', 'Leadership', 'Problem Solving',
  'Critical Thinking', 'Time Management', 'Decision Making', 'Adaptability',
  'Conflict Resolution', 'Negotiation', 'Presentation Skills', 'Stakeholder Management',
  'Emotional Intelligence', 'Creativity', 'Innovation', 'Analytical Thinking',
  'Attention to Detail', 'Planning & Organization', 'Delegation', 'Mentoring',
  'Coaching', 'Accountability', 'Resilience', 'Stress Management',
  'Self-Motivation', 'Customer Service', 'Active Listening', 'Feedback',
  'Persuasion', 'Cross-Cultural Communication', 'Diversity & Inclusion',
  'Ethics', 'Work Ethic', 'Initiative', 'Collaboration', 'Networking',
  'Report Writing', 'Business Writing', 'Multi-Tasking', 'Prioritization',
];

// ============================================================================
// Keyword-to-family mapping for stub extraction
// (used by gemini-client.ts stub fallback)
// ============================================================================

export interface FunctionKeywordPatterns {
  general: string[];  // skills/keywords found anywhere (weight 1x)
  titles: string[];   // job title patterns (weight 3x)
}

export const FUNCTION_PATTERNS: Record<string, FunctionKeywordPatterns> = {
  eng: {
    general: ['engineering', 'mechanical', 'electrical', 'civil', 'structural', 'chemical', 'industrial', 'mechatronics'],
    titles: ['engineer', 'mechanical engineer', 'electrical engineer', 'civil engineer', 'structural engineer', 'chemical engineer', 'industrial engineer'],
  },
  itt: {
    general: ['software', 'information technology', 'it support', 'systems administration', 'networking', 'cloud', 'server', 'infrastructure'],
    titles: ['software engineer', 'developer', 'programmer', 'ict technician', 'ict officer', 'it support', 'systems administrator', 'network administrator', 'devops engineer'],
  },
  cys: {
    general: ['cybersecurity', 'information security', 'penetration testing', 'vulnerability', 'siem'],
    titles: ['cybersecurity analyst', 'security engineer', 'penetration tester', 'infosec officer', 'soc analyst'],
  },
  hlt: {
    general: ['healthcare', 'medical', 'clinical', 'nursing', 'patient care', 'hospital', 'pharmacy', 'midwifery'],
    titles: ['nurse', 'registered nurse', 'clinical officer', 'doctor', 'pharmacist', 'matron', 'lead nurse'],
  },
  pha: {
    general: ['pharmaceutical', 'drug development', 'clinical research', 'pharmacovigilance', 'gmp'],
    titles: ['pharmacist', 'pharmaceutical scientist', 'regulatory affairs', 'quality assurance pharma'],
  },
  fin: {
    general: ['accounting', 'audit', 'tax', 'bookkeeping', 'financial reporting', 'ifrs', 'treasury', 'cpa'],
    titles: ['accountant', 'auditor', 'tax consultant', 'bookkeeper', 'accounts assistant', 'finance manager', 'chief accountant'],
  },
  bfs: {
    general: ['banking', 'lending', 'credit', 'branch banking', 'loans', 'fintech', 'microfinance'],
    titles: ['banker', 'business banker', 'relationship officer', 'credit officer', 'branch manager', 'loan officer', 'microfinance officer'],
  },
  ins: {
    general: ['insurance', 'underwriting', 'claims', 'actuarial', 'policy'],
    titles: ['underwriter', 'claims officer', 'insurance agent', 'actuary', 'insurance broker'],
  },
  con: {
    general: ['construction', 'building', 'site management', 'quantity surveying', 'masonry', 'foreman'],
    titles: ['site engineer', 'site manager', 'quantity surveyor', 'architect', 'foreman', 'construction manager', 'project manager construction'],
  },
  min: {
    general: ['mining', 'geology', 'mineral', 'extraction', 'quarry'],
    titles: ['mining engineer', 'geologist', 'mine manager', 'surveyor'],
  },
  enu: {
    general: ['energy', 'power', 'renewable', 'solar', 'geothermal', 'utility'],
    titles: ['energy engineer', 'power plant operator', 'renewable energy technician'],
  },
  mfg: {
    general: ['manufacturing', 'production', 'assembly', 'factory', 'quality control', 'packaging'],
    titles: ['production manager', 'factory manager', 'quality controller', 'shift supervisor', 'assembly operator'],
  },
  gpa: {
    general: ['government', 'civil service', 'public service', 'county', 'ministry', 'parastatal'],
    titles: ['administrative officer', 'civil servant', 'county officer', 'policy analyst'],
  },
  swc: {
    general: ['social work', 'community development', 'counseling', 'child protection', 'social services'],
    titles: ['social worker', 'community development officer', 'counselor', 'child protection officer'],
  },
  npo: {
    general: ['ngo', 'non-profit', 'humanitarian', 'development program', 'donor', 'relief', 'beneficiary'],
    titles: ['programme officer', 'field officer', 'm&e officer', 'humanitarian coordinator', 'grants manager', 'food aid monitor'],
  },
  mkt: {
    general: ['marketing', 'brand', 'advertising', 'digital marketing', 'seo', 'content', 'social media'],
    titles: ['marketing officer', 'brand manager', 'digital marketer', 'content creator', 'marketing manager'],
  },
  cad: {
    general: ['graphic design', 'ui design', 'ux design', 'photography', 'fashion', 'interior design'],
    titles: ['graphic designer', 'ui/ux designer', 'photographer', 'fashion designer', 'interior designer'],
  },
  mec: {
    general: ['journalism', 'broadcasting', 'media', 'news', 'production', 'public relations'],
    titles: ['journalist', 'reporter', 'news anchor', 'producer', 'editor', 'broadcast journalist', 'media producer'],
  },
  sal: {
    general: ['sales', 'business development', 'account management', 'revenue', 'crm'],
    titles: ['sales executive', 'sales manager', 'business development manager', 'account manager', 'sales representative'],
  },
  osc: {
    general: ['operations', 'supply chain', 'logistics', 'procurement', 'warehouse', 'inventory'],
    titles: ['operations manager', 'supply chain manager', 'procurement officer', 'logistics coordinator', 'warehouse manager'],
  },
  hrm: {
    general: ['human resources', 'hr', 'recruitment', 'talent', 'payroll', 'compensation'],
    titles: ['hr officer', 'hr manager', 'recruiter', 'talent acquisition', 'payroll administrator', 'hr business partner'],
  },
  edu: {
    general: ['teaching', 'education', 'curriculum', 'lecturing', 'school', 'tvet'],
    titles: ['teacher', 'lecturer', 'tutor', 'headteacher', 'principal', 'dean', 'director of studies'],
  },
  leg: {
    general: ['legal', 'law', 'compliance', 'litigation', 'regulatory', 'contract'],
    titles: ['lawyer', 'advocate', 'legal officer', 'prosecutor', 'compliance officer', 'paralegal', 'attorney'],
  },
  cnt: {
    general: ['consulting', 'consultancy', 'advisory', 'strategy', 'professional services'],
    titles: ['consultant', 'advisor', 'management consultant', 'strategy consultant'],
  },
  dsa: {
    general: ['data analysis', 'data science', 'statistics', 'bi', 'analytics', 'visualization', 'machine learning'],
    titles: ['data analyst', 'data scientist', 'bi analyst', 'statistician', 'business intelligence analyst', 'data enumerator'],
  },
  toh: {
    general: ['hotel', 'hospitality', 'tourism', 'restaurant', 'catering', 'travel', 'safari'],
    titles: ['hotel manager', 'chef', 'tour guide', 'restaurant manager', 'travel agent', 'front office manager'],
  },
  trl: {
    general: ['transport', 'driving', 'fleet', 'freight', 'delivery', 'logistics', 'customs'],
    titles: ['driver', 'fleet manager', 'logistics coordinator', 'dispatcher', 'freight forwarder', 'clearing agent'],
  },
  tel: {
    general: ['telecom', 'telecommunications', 'mobile network', 'isp', 'fiber'],
    titles: ['telecom engineer', 'network engineer', 'rf engineer', 'transmission engineer'],
  },
  aut: {
    general: ['automotive', 'vehicle', 'motor', 'mechanic', 'parts'],
    titles: ['mechanic', 'auto electrician', 'parts manager', 'vehicle inspector', 'sales engineer automotive'],
  },
  ava: {
    general: ['aviation', 'aircraft', 'flight', 'airport', 'airline'],
    titles: ['pilot', 'aircraft maintenance engineer', 'air traffic controller', 'airport manager'],
  },
  agr: {
    general: ['agriculture', 'farming', 'agribusiness', 'crop', 'livestock', 'agronomy'],
    titles: ['agronomist', 'farm manager', 'agricultural officer', 'extension officer', 'agribusiness manager'],
  },
  ree: {
    general: ['real estate', 'property', 'valuation', 'estate agent', 'letting'],
    titles: ['estate agent', 'property manager', 'property valuer', 'real estate developer'],
  },
  rcg: {
    general: ['retail', 'supermarket', 'merchandising', 'store', 'consumer goods'],
    titles: ['store manager', 'merchandiser', 'retail buyer', 'shop manager'],
  },
  ecm: {
    general: ['e-commerce', 'marketplace', 'digital payments', 'mobile money', 'online'],
    titles: ['e-commerce manager', 'marketplace manager', 'digital payments specialist', 'platform manager'],
  },
  env: {
    general: ['environment', 'conservation', 'sustainability', 'climate', 'wildlife', 'esg'],
    titles: ['environmental officer', 'conservation officer', 'sustainability manager', 'esg analyst'],
  },
  sed: {
    general: ['security', 'guard', 'safety', 'surveillance', 'investigation', 'cctv'],
    titles: ['security guard', 'security officer', 'investigator', 'safety officer', 'cctv operator'],
  },
  pfm: {
    general: ['facilities', 'building maintenance', 'property management', 'hvac', 'janitorial'],
    titles: ['facilities manager', 'maintenance manager', 'building superintendent', 'caretaker'],
  },
  spr: {
    general: ['sports', 'coaching', 'fitness', 'athletics', 'recreation'],
    titles: ['coach', 'fitness trainer', 'sports manager', 'recreation officer'],
  },
  vah: {
    general: ['veterinary', 'animal health', 'livestock health', 'animal medicine'],
    titles: ['veterinary officer', 'vet', 'animal health technician'],
  },
  wms: {
    general: ['waste', 'sanitation', 'recycling', 'water treatment', 'garbage'],
    titles: ['waste management officer', 'sanitation officer', 'environmental health officer'],
  },
  adm: {
    general: ['administration', 'office', 'reception', 'data entry', 'clerical', 'filing'],
    titles: ['administrative assistant', 'office manager', 'receptionist', 'data entry clerk', 'clerk', 'executive assistant'],
  },
};

// ============================================================================
// Lookup helpers
// ============================================================================

/** Find a career family by its code */
export function getFamily(code: string): CareerFamily | undefined {
  return FAMILY_BY_CODE.get(code as JobFunction);
}

/** Find a specialization by its code */
export function getSpecialization(code: string): Specialization | undefined {
  return SPEC_BY_CODE.get(code);
}

/** Get all specializations for a given family */
export function getSpecializationsForFamily(familyCode: string): Specialization[] {
  return SPECS_BY_FAMILY.get(familyCode) ?? [];
}

/** Get skills for a given specialization */
export function getSkillsForSpecialization(specCode: string): string[] {
  return SKILLS_BY_SPECIALIZATION[specCode] ?? [];
}

/** Validate that a specialization code exists and belongs to the given family */
export function isValidSpecialization(specCode: string, familyCode: string): boolean {
  const spec = SPEC_BY_CODE.get(specCode);
  return spec?.familyCode === familyCode;
}

/** Resolve a family name or code to a canonical family code */
export function resolveFamily(input: string): JobFunction | null {
  const normalized = input.toLowerCase().trim().replace(/\s+/g, '_');
  // Try direct code match
  if (FAMILY_BY_CODE.has(normalized as JobFunction)) {
    return normalized as JobFunction;
  }
  // Try name match
  const byName = FAMILY_BY_NAME.get(normalized);
  if (byName) return byName.code;
  return null;
}

/** Resolve a specialization code/name to canonical code */
export function resolveSpecialization(input: string, familyCode?: string): string | null {
  const normalized = input.toUpperCase().trim();
  if (SPEC_BY_CODE.has(normalized)) {
    const spec = SPEC_BY_CODE.get(normalized)!;
    // If family is provided, ensure the spec belongs to it
    if (familyCode && spec.familyCode !== familyCode) return null;
    return spec.code;
  }
  // Try by name within family
  if (familyCode) {
    const specs = SPECS_BY_FAMILY.get(familyCode) ?? [];
    const match = specs.find((s) => s.name.toLowerCase() === input.toLowerCase().trim());
    return match?.code ?? null;
  }
  return null;
}
