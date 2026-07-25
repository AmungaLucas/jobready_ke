"""
Job Matching Platform - Phase-by-Phase Build Plan
Comprehensive technical planning document for the Kenyan job matching platform.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'scripts'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'skills', 'pdf', 'scripts'))

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm, cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
import platform

# ━━ Font Registration ━━
_IS_MAC = platform.system() == 'Darwin'
FONT_DIR = os.path.expanduser('~/.openclaw/workspace/fonts') if _IS_MAC else '/usr/share/fonts'

pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold',
                    italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')

# ━━ Cascade Palette ━━
PAGE_BG       = colors.HexColor('#f6f5f5')
SECTION_BG    = colors.HexColor('#f0efee')
CARD_BG       = colors.HexColor('#e8e7e3')
TABLE_STRIPE  = colors.HexColor('#f1f1ef')
HEADER_FILL   = colors.HexColor('#695d3b')
COVER_BLOCK   = colors.HexColor('#5b5542')
BORDER        = colors.HexColor('#d6d1c0')
ICON          = colors.HexColor('#927d3f')
ACCENT        = colors.HexColor('#917520')
ACCENT_2      = colors.HexColor('#448ca4')
TEXT_PRIMARY   = colors.HexColor('#272623')
TEXT_MUTED     = colors.HexColor('#8f8d86')
SEM_SUCCESS   = colors.HexColor('#457a56')
SEM_WARNING   = colors.HexColor('#8d7547')
SEM_ERROR     = colors.HexColor('#a8524a')
SEM_INFO      = colors.HexColor('#53799f')

# ━━ Styles ━━
W, H = A4
MARGIN = 54

styles = getSampleStyleSheet()

cover_title = ParagraphStyle('CoverTitle', fontName='FreeSerif-Bold', fontSize=28,
    leading=34, textColor=colors.white, alignment=TA_LEFT, spaceAfter=12)
cover_subtitle = ParagraphStyle('CoverSubtitle', fontName='FreeSerif', fontSize=14,
    leading=20, textColor=colors.HexColor('#d6d1c0'), alignment=TA_LEFT, spaceAfter=6)
cover_meta = ParagraphStyle('CoverMeta', fontName='FreeSerif-Italic', fontSize=10,
    leading=14, textColor=colors.HexColor('#b8b3a4'), alignment=TA_LEFT)

h1_style = ParagraphStyle('H1', fontName='FreeSerif-Bold', fontSize=18, leading=24,
    textColor=HEADER_FILL, spaceAfter=10, spaceBefore=18)
h2_style = ParagraphStyle('H2', fontName='FreeSerif-Bold', fontSize=13, leading=18,
    textColor=ACCENT, spaceAfter=8, spaceBefore=14)
h3_style = ParagraphStyle('H3', fontName='FreeSerif-Bold', fontSize=11, leading=15,
    textColor=TEXT_PRIMARY, spaceAfter=6, spaceBefore=10)
body_style = ParagraphStyle('Body', fontName='FreeSerif', fontSize=10.5, leading=16,
    textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=8)
body_left = ParagraphStyle('BodyLeft', fontName='FreeSerif', fontSize=10.5, leading=16,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=6)
bullet_style = ParagraphStyle('Bullet', fontName='FreeSerif', fontSize=10.5, leading=16,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, leftIndent=18, spaceAfter=4,
    bulletIndent=6, bulletFontName='FreeSerif', bulletFontSize=10.5)
sub_bullet = ParagraphStyle('SubBullet', fontName='FreeSerif', fontSize=10, leading=15,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, leftIndent=36, spaceAfter=3,
    bulletIndent=24)
caption_style = ParagraphStyle('Caption', fontName='FreeSerif-Italic', fontSize=9,
    leading=12, textColor=TEXT_MUTED, alignment=TA_LEFT, spaceAfter=6)
phase_num = ParagraphStyle('PhaseNum', fontName='FreeSerif-Bold', fontSize=36,
    leading=40, textColor=ACCENT, alignment=TA_LEFT)
phase_title = ParagraphStyle('PhaseTitle', fontName='FreeSerif-Bold', fontSize=20,
    leading=26, textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=4)
phase_dur = ParagraphStyle('PhaseDur', fontName='FreeSerif-Italic', fontSize=11,
    leading=15, textColor=TEXT_MUTED, alignment=TA_LEFT, spaceAfter=12)
callout_style = ParagraphStyle('Callout', fontName='FreeSerif-Italic', fontSize=10.5,
    leading=16, textColor=ACCENT, alignment=TA_LEFT, leftIndent=12, spaceAfter=8,
    borderColor=ACCENT, borderWidth=1, borderPadding=8)
footer_style = ParagraphStyle('Footer', fontName='FreeSerif', fontSize=8,
    leading=10, textColor=TEXT_MUTED, alignment=TA_CENTER)

def make_table(headers, rows, col_widths=None):
    """Create a styled table."""
    available = W - 2 * MARGIN
    if col_widths is None:
        col_widths = [available / len(headers)] * len(headers)
    else:
        col_widths = [w * available for w in col_widths]

    header_paras = [Paragraph(f'<b>{h}</b>', ParagraphStyle('TH', fontName='FreeSerif-Bold',
        fontSize=9.5, leading=13, textColor=colors.white, alignment=TA_CENTER)) for h in headers]
    data = [header_paras]
    for row in rows:
        data.append([Paragraph(str(c), ParagraphStyle('TD', fontName='FreeSerif',
            fontSize=9, leading=13, textColor=TEXT_PRIMARY, alignment=TA_LEFT)) for c in row])

    t = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'FreeSerif-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9.5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
        else:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), colors.white))
    t.setStyle(TableStyle(style_cmds))
    return t

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=12, spaceBefore=6)

def heading1(text):
    return Paragraph(text, h1_style)

def heading2(text):
    return Paragraph(text, h2_style)

def heading3(text):
    return Paragraph(text, h3_style)

def body(text):
    return Paragraph(text, body_style)

def bullet(text):
    return Paragraph(f'<bullet>&bull;</bullet>{text}', bullet_style)

def sub_bullet_item(text):
    return Paragraph(f'<bullet>-</bullet>{text}', sub_bullet)

def caption(text):
    return Paragraph(text, caption_style)

def spacer(h=8):
    return Spacer(1, h)

# ━━ Build Document ━━
OUTPUT = '/home/z/my-project/download/Job_Matching_Platform_Build_Plan.pdf'

# Cover page
story = []

# ── COVER ──
# Dark cover block background
cover_bg = Table([['']], colWidths=[W - 2*MARGIN], rowHeights=[H - 2*MARGIN])
cover_bg.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (0, 0), COVER_BLOCK),
    ('LEFTPADDING', (0, 0), (0, 0), 0),
    ('RIGHTPADDING', (0, 0), (0, 0), 0),
    ('TOPPADDING', (0, 0), (0, 0), 0),
    ('BOTTOMPADDING', (0, 0), (0, 0), 0),
]))

# Build cover content as a separate table
cover_content = []
cover_content.append(Spacer(1, 140))
cover_content.append(Paragraph('Job Matching Platform', cover_title))
cover_content.append(Spacer(1, 8))
cover_content.append(Paragraph('Phase-by-Phase Build Plan', ParagraphStyle('SubT',
    fontName='FreeSerif', fontSize=16, leading=22, textColor=ACCENT)))
cover_content.append(Spacer(1, 30))
cover_content.append(HRFlowable(width=120, thickness=2, color=ACCENT, spaceAfter=16))
cover_content.append(Paragraph('Comprehensive Technical Implementation Guide', cover_subtitle))
cover_content.append(Spacer(1, 12))
cover_content.append(Paragraph('Version 1.0  |  July 2026', cover_meta))
cover_content.append(Paragraph('Based on Technical Documentation v4.0', cover_meta))
cover_content.append(Spacer(1, 40))
cover_content.append(Paragraph('5 Phases  |  10 Weeks  |  Next.js 15 + TypeScript + MySQL', cover_meta))
cover_content.append(Paragraph('Kenya Data Protection Act Compliant', cover_meta))

cover_table = Table([[c] for c in cover_content],
    colWidths=[W - 2*MARGIN - 80])
cover_table.setStyle(TableStyle([
    ('LEFTPADDING', (0, 0), (-1, -1), 40),
    ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ('TOPPADDING', (0, 0), (0, 0), 0),
    ('BOTTOMPADDING', (0, -1), (-1, -1), 0),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
]))

story.append(cover_table)
story.append(PageBreak())

# ══════════════════════════════════════════════
# TABLE OF CONTENTS
# ══════════════════════════════════════════════
story.append(heading1('Table of Contents'))
story.append(hr())
story.append(Spacer(1, 6))

toc_items = [
    ('1', 'Executive Summary', '3'),
    ('2', 'Architecture Overview', '4'),
    ('3', 'Phase 1: Foundation and Infrastructure', '6'),
    ('4', 'Phase 2: Data Pipeline (CV and JD Processing)', '9'),
    ('5', 'Phase 3: Matching Engine', '12'),
    ('6', 'Phase 4: User Interface (Candidate Experience)', '15'),
    ('7', 'Phase 5: Admin Portal, Privacy, and Production', '18'),
    ('8', 'Cross-Phase Dependencies', '20'),
    ('9', 'Risk Register and Mitigations', '21'),
    ('10', 'Team Composition and Effort Estimates', '22'),
]
for num, title, pg in toc_items:
    toc_row = Table([
        [Paragraph(f'<b>{num}</b>', ParagraphStyle('TN', fontName='FreeSerif-Bold',
            fontSize=10.5, leading=14, textColor=ACCENT)),
         Paragraph(title, ParagraphStyle('TT', fontName='FreeSerif', fontSize=10.5,
            leading=14, textColor=TEXT_PRIMARY)),
         Paragraph(pg, ParagraphStyle('TP', fontName='FreeSerif', fontSize=10.5,
            leading=14, textColor=TEXT_MUTED, alignment=TA_CENTER))]
    ], colWidths=[30, W - 2*MARGIN - 90, 60])
    toc_row.setStyle(TableStyle([
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -1), 0.3, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(toc_row)
story.append(PageBreak())

# ══════════════════════════════════════════════
# SECTION 1: EXECUTIVE SUMMARY
# ══════════════════════════════════════════════
story.append(heading1('1. Executive Summary'))
story.append(hr())

story.append(body(
    'This document presents a structured, phase-by-phase build plan for the Job Matching Platform, '
    'a Kenya-focused job matching system designed to empower candidates rather than disqualify them. '
    'The platform uses a unique "Extract Once, Compute Many" architecture where LLM processing fires only '
    'at data ingestion time (CV upload and JD posting), while all subsequent matching happens deterministically '
    'via database queries at zero marginal cost. This design achieves an estimated monthly operating cost of '
    'approximately $11 USD for processing 10,000 CVs against 1,000 active job postings.'
))
story.append(body(
    'The platform is specifically designed for the Kenyan employment landscape, where job seekers frequently '
    'hold multiple roles across different career functions simultaneously. Rather than penalizing candidates '
    'for diverse experience, the platform clusters related work experiences into career trajectories, allows '
    'candidates to select up to three focus areas, and ranks all matching jobs by relevance without ever '
    'hard-disqualifying a candidate. This philosophy of candidate empowerment is embedded in every layer of '
    'the system, from the normalization pipeline to the matching algorithm to the user interface.'
))
story.append(body(
    'The build plan is organized into five sequential phases spanning approximately 10 weeks. Each phase is '
    'self-contained with clear deliverables, acceptance criteria, and dependencies on previous phases. The first '
    'phase establishes the technical foundation including project scaffolding, database schema, and authentication. '
    'Subsequent phases layer on the data pipeline, matching engine, candidate-facing interface, and finally '
    'the admin portal, privacy compliance features, and production readiness. This phased approach allows for '
    'continuous testing and validation at each stage, reducing the risk of late-stage integration failures.'
))

# Key metrics callout
metrics_data = [
    ['Monthly LLM Cost', '~$11 USD (10K CVs + 1K jobs)'],
    ['Matching Cost', '$0 per match (database queries only)'],
    ['Total Timeline', '5 phases, approximately 10 weeks'],
    ['Tech Stack', 'Next.js 15, TypeScript, MySQL 8.0, Prisma, NextAuth.js'],
    ['Compliance', 'Kenya Data Protection Act (2019)'],
    ['LLM Provider', 'Gemini 1.5 Flash (~$0.001 per extraction)'],
]
t = make_table(['Metric', 'Value'], metrics_data, [0.35, 0.65])
story.append(spacer(12))
story.append(t)
story.append(caption('Table 1: Platform Key Metrics'))
story.append(PageBreak())

# ══════════════════════════════════════════════
# SECTION 2: ARCHITECTURE OVERVIEW
# ══════════════════════════════════════════════
story.append(heading1('2. Architecture Overview'))
story.append(hr())

story.append(body(
    'The platform follows a monolithic Next.js architecture with a clear separation between the frontend '
    'presentation layer and the backend API routes. All matching logic runs on the server side, and a '
    'cron-based background job handles the periodic computation of match scores between candidates and '
    'jobs. This architecture was chosen for its simplicity, deployability, and cost efficiency, avoiding '
    'the complexity of microservices while still supporting the scale requirements of the Kenyan job market.'
))

story.append(heading2('2.1 System Components'))
story.append(body(
    'The system comprises seven major components that work together in a pipeline. Understanding these '
    'components and their interactions is essential before beginning any development phase.'
))

components = [
    ['Text Extraction', 'pdf-parse / mammoth', 'Extracts raw text from uploaded CV and JD files'],
    ['LLM Integration', 'Gemini 1.5 Flash API', 'Parses raw text into structured JSON (fires once per document)'],
    ['Normalization', 'Word-boundary regex + enums', 'Maps variations to canonical values, de-duplicates skills'],
    ['Matching Engine', 'Function filter + score calc', 'Pre-computes matches using DB-indexed function queries'],
    ['Background Jobs', 'GitHub Actions / Vercel Cron', 'Runs matching every 5 minutes on new/updated data'],
    ['Authentication', 'NextAuth.js (Google + Email)', 'Session management, role-based access control'],
    ['Privacy Layer', 'Consent, export, soft-delete', 'DPA-compliant data handling with 30-day deletion grace period'],
]
t2 = make_table(['Component', 'Technology', 'Description'], components, [0.18, 0.22, 0.60])
story.append(spacer(8))
story.append(t2)
story.append(caption('Table 2: System Components Overview'))

story.append(heading2('2.2 Data Flow'))
story.append(body(
    'The data flow through the system follows two parallel paths that converge at the matching engine. '
    'The candidate path begins with CV upload, proceeds through LLM extraction and normalization, and '
    'stores structured data in the MySQL database. The job path follows the same pattern but supports '
    'four distinct input methods: paste JD text (with LLM), upload file (with LLM), paste JSON (no LLM), '
    'or fill a form directly (no LLM). Both paths deposit their structured outputs into the database, '
    'where the background matching cron job picks them up and computes match scores.'
))
story.append(body(
    'A critical design decision is that LLM is only invoked when new data enters the system. Once a CV '
    'or JD has been extracted and normalized, all subsequent matching is performed through pure database '
    'queries and deterministic scoring functions. This means the per-match cost is effectively zero, and '
    'the candidate dashboard can display results instantly without any LLM latency. The cron job runs '
    'every five minutes and only processes jobs posted within the last hour, using function-indexed '
    'queries to avoid the N-squared scalability trap of comparing every candidate against every job.'
))

story.append(heading2('2.3 Matching Philosophy'))
story.append(body(
    'The matching algorithm is designed around five core principles: inclusiveness (never hiding jobs based '
    'on missing data), function-based filtering (primary match on job function), ranked results (best matches '
    'appear first), explainability (each match shows why it was recommended), and user control (only '
    'selected career trajectories are used for matching). The scoring system allocates 100 points across '
    'five dimensions: job title match (40 points), skills match (35 points), education level (15 points), '
    'education field relevance (5 points), and experience years (10 points). Importantly, missing data '
    'never disqualifies a candidate; it simply results in a lower score rather than exclusion.'
))

story.append(PageBreak())

# ══════════════════════════════════════════════
# HELPER: Phase header
# ══════════════════════════════════════════════
def phase_header(num, title, duration, goals):
    story.append(spacer(16))
    story.append(Paragraph(f'PHASE {num}', phase_num))
    story.append(Paragraph(title, phase_title))
    story.append(Paragraph(duration, phase_dur))
    story.append(hr())
    story.append(heading2('Goals'))
    for g in goals:
        story.append(bullet(g))
    story.append(spacer(8))

# ══════════════════════════════════════════════
# SECTION 3: PHASE 1
# ══════════════════════════════════════════════
story.append(heading1('3. Phase 1: Foundation and Infrastructure'))
story.append(hr())

phase_header('1', 'Foundation and Infrastructure', 'Week 1-2 (10 working days)', [
    'Initialize the Next.js 15 project with TypeScript and configure the development environment',
    'Set up MySQL 8.0 database with the complete schema including all tables, indexes, and relationships',
    'Implement authentication and authorization using NextAuth.js with Google and email providers',
    'Build the privacy and consent infrastructure including consent recording and soft-delete support',
    'Establish the enum normalization system with word-boundary matching to prevent false positives',
    'Configure the project structure, environment variables, and deployment pipeline for Vercel',
])

story.append(heading2('3.1 Project Initialization'))
story.append(body(
    'The first task is to scaffold the Next.js 15 project using the App Router architecture. The project '
    'structure should follow the technical documentation layout with separate directories for API routes, '
    'library utilities, models, types, scripts, and Prisma schema files. Key dependencies to install include '
    'Next.js 15, React 18, Prisma 5, NextAuth.js 4.24, Google Generative AI SDK, pdf-parse, mammoth, Zod '
    'for validation, and bcryptjs for password hashing. TypeScript should be configured with strict mode '
    'enabled from the start to catch type errors early.'
))
story.append(body(
    'Environment variables must be configured for all external services: the Gemini API key, database '
    'connection string (DATABASE_URL), NextAuth secret, and cron job authentication token. A .env.local '
    'file should be created with placeholder values, and a .env.example file should be committed to '
    'version control for documentation purposes. The development script should include database migration '
    'commands, seed data generation, and a local development server startup sequence.'
))

story.append(heading2('3.2 Database Schema'))
story.append(body(
    'The MySQL database requires nine core tables. The candidates table stores profile information, '
    'authentication credentials (password hash, auth provider, auth ID), and account status flags '
    '(is_active, deleted_at for soft-delete support). The candidate_education table is a child table '
    'supporting multiple qualifications per candidate, which is critical for the Kenyan market where '
    'candidates frequently hold both a degree and professional certifications like CPA or ACCA.'
))
story.append(body(
    'The candidate_clusters table stores the LLM-extracted work experience clusters, each with a '
    'normalized function enum, job titles array, skills array, years of experience, and a selected '
    'boolean flag that the candidate uses to choose their focus trajectories. The jobs table mirrors '
    'the candidate structure with normalized function, sector, and education level enums. The job_matches '
    'table serves as the pre-computed cache of matching results with a unique constraint on '
    '(candidate_id, job_id) and a descending index on match_score for fast retrieval.'
))
story.append(body(
    'Three additional tables support privacy compliance: consent_records tracks every consent action with '
    'the consent type, version, IP address, and user agent; deletion_requests manages account deletion '
    'workflows with a status enum (pending, processing, completed, cancelled) and a deleted_data JSON '
    'field for audit trails; and export_requests tracks data export requests with an expiry date for '
    'the generated download link. The parse_failures table logs any LLM extraction errors with the raw '
    'text and error message for manual review and resolution.'
))

schema_table = [
    ['candidates', 'Profile, auth, account status', 'PRIMARY'],
    ['candidate_education', 'Multiple qualifications per candidate', 'FK -> candidates'],
    ['candidate_clusters', 'Work experience clusters (matching)', 'FK -> candidates'],
    ['candidate_extras', 'Certifications, referees, languages', 'FK -> candidates'],
    ['jobs', 'Job postings with normalized enums', 'PRIMARY'],
    ['job_matches', 'Pre-computed match results', 'FK -> candidates, jobs'],
    ['consent_records', 'DPA consent audit trail', 'FK -> candidates'],
    ['deletion_requests', 'Account deletion workflow', 'FK -> candidates'],
    ['export_requests', 'Data export workflow', 'FK -> candidates'],
    ['parse_failures', 'LLM error logging', 'PRIMARY'],
]
t3 = make_table(['Table', 'Purpose', 'Key'], schema_table, [0.20, 0.50, 0.30])
story.append(spacer(8))
story.append(t3)
story.append(caption('Table 3: Database Schema Tables'))

story.append(heading2('3.3 Authentication'))
story.append(body(
    'NextAuth.js provides the authentication layer with support for both Google OAuth and email/password '
    'credentials. The implementation requires a route handler at app/api/auth/[...nextauth]/route.ts that '
    'configures the providers and an authorize callback that validates credentials against the database. '
    'A middleware.ts file should enforce authentication on all protected routes, checking for the session '
    'token and redirecting unauthenticated users to the login page. Role-based access control should '
    'be implemented using the session token, distinguishing between "admin" and "candidate" roles.'
))

story.append(heading2('3.4 Normalization System'))
story.append(body(
    'The normalization system is critical for data quality and must be implemented before any data flows '
    'into the system. It consists of three enum mapping dictionaries (EDUCATION_LEVEL_ENUMS with 6 '
    'canonical values, FUNCTION_ENUMS with 16 categories, and SECTOR_ENUMS with 21 industry sectors) and '
    'a normalizeWithWordBoundaries function that uses regex word boundaries to prevent false-positive '
    'matches. Without word-boundary matching, the string "hr" would incorrectly match "research" or '
    '"architecture" because the naive includes() check finds substrings. The implementation uses '
    'RegExp with \\b anchors to ensure only whole-word matches are accepted.'
))

story.append(heading2('3.5 Deliverables and Acceptance Criteria'))
deliverables_1 = [
    ['D1.1', 'Next.js project scaffolded with TypeScript, all dependencies installed', 'Dev server starts without errors'],
    ['D1.2', 'MySQL database created with all 10 tables, indexes, and constraints', 'Prisma migrate succeeds, schema matches documentation'],
    ['D1.3', 'NextAuth.js login/signup working with Google and email', 'Can create account, login, logout, session persists'],
    ['D1.4', 'Consent recording on signup and CV upload', 'Consent records written with correct type and version'],
    ['D1.5', 'Normalization pipeline with word-boundary matching', 'Unit tests pass for all enum edge cases'],
    ['D1.6', 'Environment variables and deployment config', 'Deploy preview to Vercel succeeds'],
]
t4 = make_table(['ID', 'Deliverable', 'Acceptance'], deliverables_1, [0.06, 0.52, 0.42])
story.append(spacer(8))
story.append(t4)
story.append(caption('Table 4: Phase 1 Deliverables'))

story.append(PageBreak())

# ══════════════════════════════════════════════
# SECTION 4: PHASE 2
# ══════════════════════════════════════════════
story.append(heading1('4. Phase 2: Data Pipeline'))
story.append(hr())

phase_header('2', 'Data Pipeline (CV and JD Processing)', 'Week 3-4 (10 working days)', [
    'Implement the LLM integration with Gemini 1.5 Flash for CV and JD extraction',
    'Build the complete CV upload flow with text extraction, LLM parsing, normalization, and storage',
    'Build the job posting flow supporting all four input methods (paste, upload, JSON, form)',
    'Implement the field similarity mapping system with the RELATED_FIELDS matrix',
    'Add LLM error handling with retry logic, exponential backoff, and manual review logging',
    'Implement the trajectory selection API with re-matching on preference change',
])

story.append(heading2('4.1 LLM Integration'))
story.append(body(
    'The LLM integration layer wraps the Google Generative AI SDK with a parseWithRetry function that '
    'attempts up to three retries with exponential backoff (1s, 2s, 4s delays). On each attempt, the '
    'function sends the extraction prompt with the raw text, parses the JSON response, and performs basic '
    'validation checking for required fields. If all retries fail, the function logs the failure to the '
    'parse_failures table for manual review and returns an error object with _error, _message, and '
    '_raw_text fields. This ensures that no extraction failure is silently lost, and the admin can review '
    'and manually fix problematic documents.'
))

story.append(heading2('4.2 CV Upload Flow'))
story.append(body(
    'The CV upload endpoint accepts multipart form data with the CV file and a consent confirmation. '
    'The flow proceeds through five stages: text extraction (pdf-parse for PDF files, mammoth for DOCX), '
    'LLM parsing with retry, normalization of education levels and work experience functions, database '
    'storage of the candidate profile and all child records (education array, work experience clusters, '
    'extras), and consent recording. The education array is stored in the candidate_education table as '
    'separate rows, each linked to the candidate via foreign key. Work experience clusters are similarly '
    'stored as individual rows in the candidate_clusters table with all skills and job titles serialized '
    'as JSON arrays. After successful upload, the system triggers an initial matching computation for '
    'the new candidate against all active jobs.'
))

story.append(heading2('4.3 Job Posting (Four Input Methods)'))
story.append(body(
    'The job posting endpoint uses an input_type discriminator to route processing through the appropriate '
    'path. For "paste" type, the raw JD text is sent to the LLM for extraction. For "upload" type, the '
    'file is first processed through text extraction then through LLM extraction. For "json" type, the '
    'pre-structured JSON is validated against the job schema using Zod and then normalized without any '
    'LLM call. For "form" type, the already-structured form data is normalized directly. This conditional '
    'LLM usage is a key cost optimization: power users who paste JSON or fill forms avoid LLM costs '
    'entirely, while casual users who paste raw text or upload files get automatic extraction.'
))

story.append(heading2('4.4 Field Similarity Mapping'))
story.append(body(
    'The field similarity mapping replaces the naive String.includes() approach with a three-tier matching '
    'system. Tier 1 checks for exact string match. Tier 2 looks up both fields in the RELATED_FIELDS '
    'matrix, which contains 12 category groups covering Business, Computing, Engineering, Health, '
    'Education, Economics, Law, Arts, Sciences, Hospitality, Construction, and Media. If both fields '
    'belong to the same category group, they are considered related. Tier 3 performs partial-word matching '
    'on multi-word field names, checking for common significant words (length greater than 3 characters) '
    'while filtering out common stopwords like "and", "of", "the", "science", and "studies". This '
    'ensures that "Commerce" matches "Business Administration" (both in the Business group) but does '
    'not match "Business Journalism" (Journalism is in the Media group).'
))

story.append(heading2('4.5 Deliverables and Acceptance Criteria'))
deliverables_2 = [
    ['D2.1', 'LLM integration with retry logic and error logging', '3 retries with backoff, failures logged to DB'],
    ['D2.2', 'CV upload: extract, parse, normalize, store, consent', 'Upload PDF/DOCX, parsed data stored correctly'],
    ['D2.3', 'Job posting: all 4 input methods working', 'Paste, upload, JSON, form all produce valid job records'],
    ['D2.4', 'Field similarity mapping with 12-category matrix', 'All 12 test cases pass (Commerce-Business Admin true, etc.)'],
    ['D2.5', 'Trajectory selection API with max-3 validation', 'PUT endpoint validates limit, triggers re-match'],
    ['D2.6', 'Consent flow integrated into CV upload', 'Upload rejected without consent checkbox'],
]
t5 = make_table(['ID', 'Deliverable', 'Acceptance'], deliverables_2, [0.06, 0.52, 0.42])
story.append(spacer(8))
story.append(t5)
story.append(caption('Table 5: Phase 2 Deliverables'))

story.append(PageBreak())

# ══════════════════════════════════════════════
# SECTION 5: PHASE 3
# ══════════════════════════════════════════════
story.append(heading1('5. Phase 3: Matching Engine'))
story.append(hr())

phase_header('3', 'Matching Engine', 'Week 5-6 (10 working days)', [
    'Implement the complete scoring algorithm with all five dimensions (title, skills, education, field, experience)',
    'Build the scalable background matching cron job using function-indexed queries',
    'Implement explanation generation for every match to provide transparency to candidates',
    'Build the re-matching system that triggers when candidates change trajectory preferences',
    'Implement the match results API endpoint for the candidate dashboard to consume',
    'Test the matching engine with realistic Kenyan CV and JD data for accuracy validation',
])

story.append(heading2('5.1 Scoring Algorithm'))
story.append(body(
    'The matching algorithm operates in two stages. The first stage is a function-based gateway filter: '
    'a job is only shown to a candidate if at least one of the candidate\'s selected career clusters has '
    'a matching job function enum. This filter is implemented as a database JOIN between the '
    'candidate_clusters table (filtered by selected=TRUE and the specific function enum) and the jobs '
    'table. Jobs that pass the gateway filter proceed to the second stage, which calculates a '
    'weighted score across five dimensions.'
))
story.append(body(
    'The job title dimension (40 points) checks for exact match first, awarding full points if any '
    'of the cluster\'s job titles exactly equals the job title. If no exact match exists, it falls '
    'back to keyword overlap scoring, counting shared words between the job title and the cluster\'s '
    'title array, capped at 20 points. The skills dimension (35 points) calculates the percentage of '
    'required skills present in the candidate\'s skill set, using case-insensitive exact matching. The '
    'education level dimension (15 points) compares the candidate\'s highest education level against the '
    'job requirement using a tiered scoring system: full points if the candidate exceeds the requirement, '
    '70% if one level below, 30% if two levels below, and zero otherwise. The education field bonus '
    '(5 points) uses the field similarity mapping to check if any of the candidate\'s education fields '
    'are related to the job\'s required field. The experience dimension (10 points) calculates the '
    'ratio of candidate years to required years, capped at 1.0 to prevent over-experience penalties.'
))

score_table = [
    ['Job Title Match', '40', 'Exact or partial keyword overlap', 'Highest weight - role alignment'],
    ['Skills Match', '35', 'Percentage of required skills present', 'Percentage of required skills found'],
    ['Education Level', '15', 'Candidate meets or exceeds requirement', 'Tiered: 100%, 70%, 30%, 0%'],
    ['Education Field', '5', 'Bonus for related field', 'Uses RELATED_FIELDS matrix'],
    ['Experience Years', '10', 'Candidate years vs. required years', 'Ratio capped at 1.0'],
]
t6 = make_table(['Dimension', 'Points', 'Method', 'Notes'], score_table, [0.16, 0.08, 0.38, 0.38])
story.append(spacer(8))
story.append(t6)
story.append(caption('Table 6: Matching Score Dimensions'))

story.append(heading2('5.2 Background Matching Cron Job'))
story.append(body(
    'The background matching job is designed for scalability from the outset. Rather than fetching '
    'all candidates and comparing against all jobs (an O(N*M) operation), the cron job uses a '
    'function-indexed query strategy. For each new or recently updated job, it queries only the '
    'candidates whose selected clusters match the job\'s function enum. This reduces the comparison '
    'set dramatically: instead of comparing 10,000 candidates against every job, the system only '
    'evaluates the subset of candidates who have indicated relevant experience in that specific function.'
))
story.append(body(
    'The cron job implementation supports two deployment options. The primary option uses GitHub Actions '
    'with a cron schedule of */5 * * * * (every 5 minutes) and a manual workflow_dispatch trigger for '
    'on-demand execution. The script uses npx ts-node to run the TypeScript matching script, which '
    'queries jobs posted in the last hour, performs the function-indexed candidate lookup, calculates '
    'scores, and upserts results into the job_matches table using ON DUPLICATE KEY UPDATE. The secondary '
    'option uses Vercel Cron Jobs with an API endpoint protected by a Bearer token authentication check. '
    'Both options require the CRON_SECRET environment variable for authorization.'
))

story.append(heading2('5.3 Explanation Generation'))
story.append(body(
    'Every match record includes a human-readable explanation string that tells the candidate why the job '
    'was recommended. The explanation starts with the primary career identity (e.g., "This job matches '
    'your experience as an Admin Assistant"), then appends matched skills (up to 3 named skills plus a '
    'count of additional matches). This explanation is generated at match computation time and stored '
    'in the explanation column of the job_matches table, so it requires no computation when the candidate '
    'views their dashboard. The explanation provides transparency and builds trust in the matching system.'
))

story.append(heading2('5.4 Deliverables and Acceptance Criteria'))
deliverables_3 = [
    ['D3.1', 'Complete scoring algorithm (all 5 dimensions)', 'Scores fall within 0-100 range, edge cases handled'],
    ['D3.2', 'Background cron job with function-indexed queries', 'GitHub Actions cron runs every 5 min, Vercel fallback works'],
    ['D3.3', 'Match explanation generation', 'Every match record has human-readable explanation'],
    ['D3.4', 'Trajectory change triggers re-matching', 'Changing trajectories deletes old matches, creates new ones'],
    ['D3.5', 'Match results API endpoint', 'GET /candidates/[id]/matches returns ranked matches'],
    ['D3.6', 'Accuracy validation with real data', '10 sample Kenyan CVs produce expected match results'],
]
t7 = make_table(['ID', 'Deliverable', 'Acceptance'], deliverables_3, [0.06, 0.52, 0.42])
story.append(spacer(8))
story.append(t7)
story.append(caption('Table 7: Phase 3 Deliverables'))

story.append(PageBreak())

# ══════════════════════════════════════════════
# SECTION 6: PHASE 4
# ══════════════════════════════════════════════
story.append(heading1('6. Phase 4: User Interface (Candidate Experience)'))
story.append(hr())

phase_header('4', 'User Interface (Candidate Experience)', 'Week 7-8 (10 working days)', [
    'Build the landing page with value proposition and sign-up flow',
    'Build the candidate onboarding flow: CV upload, trajectory selection, and consent',
    'Build the candidate dashboard with ranked matches, filters, and sorting',
    'Build the job detail page with match explanation, skill breakdown, and apply/save actions',
    'Implement location display as informational context (never as a filter)',
    'Ensure responsive design for mobile-first access given the Kenyan mobile usage patterns',
])

story.append(heading2('6.1 Landing Page'))
story.append(body(
    'The landing page communicates the platform\'s core value proposition: "We open doors, we do not '
    'close them." It should feature a clean, uncluttered design with a clear call-to-action for '
    'candidate registration and a separate entry point for admin login. The page should briefly explain '
    'how the platform works (upload CV, get matched, apply for jobs) and address common concerns about '
    'data privacy. Given that a significant portion of Kenyan job seekers access the internet primarily '
    'through mobile devices, the landing page must be fully responsive with a mobile-first design '
    'approach. Load time should be optimized since many users will be on slower mobile connections.'
))

story.append(heading2('6.2 Candidate Onboarding'))
story.append(body(
    'The onboarding flow guides new candidates through three steps after account creation. First, the CV '
    'upload step accepts PDF or DOCX files, displays a consent checkbox for data processing, and triggers '
    'the extraction pipeline. Second, the trajectory selection step presents the LLM-extracted work '
    'experience clusters with their functions, years of experience, representative companies, and key '
    'skills. Candidates can select up to three clusters to focus on, with a clear explanation that '
    'changing these preferences later is possible. Third, the system triggers initial matching and '
    'redirects to the dashboard. Each step should have a "Skip for Now" option so that candidates '
    'can complete onboarding quickly and return to configure preferences later.'
))

story.append(heading2('6.3 Candidate Dashboard'))
story.append(body(
    'The candidate dashboard is the primary engagement surface of the platform. It displays the '
    'candidate\'s selected focus areas at the top, followed by a ranked list of matching jobs. Each '
    'job card shows the match percentage, company name, sector, location (as informational context, '
    'never as a filter), and the match explanation snippet. The dashboard should support basic '
    'filtering (by sector, job type, match score range) and sorting (by score, date, company). Location '
    'information is displayed as contextual data: for example, a candidate in Nairobi seeing a Mombasa '
    'job would see the distance or a note like "You are in Nairobi - 480km away." This follows the '
    'platform philosophy that location is the candidate\'s decision, not the platform\'s filter.'
))

story.append(heading2('6.4 Job Detail Page'))
story.append(body(
    'The job detail page provides a comprehensive view of a matched job alongside the match explanation. '
    'The page is divided into four sections: the job header (title, company, sector, location, type), '
    'the match analysis (score breakdown showing which dimensions matched and which did not), the full '
    'job description with requirements, and action buttons (Apply Now, Save Job, View Similar Jobs). '
    'The match analysis section should be visually prominent, using a checklist format with green '
    'checkmarks for matched criteria and warning indicators for missing skills. This transparency helps '
    'candidates understand their fit for the role and identify skill gaps to address before applying.'
))

story.append(heading2('6.5 Deliverables and Acceptance Criteria'))
deliverables_4 = [
    ['D4.1', 'Landing page with sign-up flow', 'Mobile responsive, loads in under 3 seconds on 3G'],
    ['D4.2', 'Onboarding: CV upload + trajectory selection', 'Can upload CV, see clusters, select 3, skip available'],
    ['D4.3', 'Candidate dashboard with ranked matches', 'Matches display in order, filters work, location shows as info'],
    ['D4.4', 'Job detail page with match explanation', 'Score breakdown, skill checklist, apply/save buttons work'],
    ['D4.5', 'Responsive design across all pages', 'Works on mobile (375px), tablet, and desktop'],
    ['D4.6', 'Navigation: profile, applications, privacy', 'All nav links point to functional pages'],
]
t8 = make_table(['ID', 'Deliverable', 'Acceptance'], deliverables_4, [0.06, 0.52, 0.42])
story.append(spacer(8))
story.append(t8)
story.append(caption('Table 8: Phase 4 Deliverables'))

story.append(PageBreak())

# ══════════════════════════════════════════════
# SECTION 7: PHASE 5
# ══════════════════════════════════════════════
story.append(heading1('7. Phase 5: Admin Portal, Privacy, and Production'))
story.append(hr())

phase_header('5', 'Admin Portal, Privacy, and Production', 'Week 9-10 (10 working days)', [
    'Build the admin dashboard with the four-method job posting interface',
    'Implement the privacy center with data export and account deletion workflows',
    'Write unit tests and integration tests for the matching engine and API endpoints',
    'Perform performance optimization, query analysis, and caching implementation',
    'Deploy to production with monitoring, error tracking, and security hardening',
    'Complete API documentation and user-facing guides',
])

story.append(heading2('7.1 Admin Dashboard'))
story.append(body(
    'The admin dashboard serves two primary functions: job posting and application management. The '
    'job posting interface presents four clearly labeled input methods in a tabbed or card-based '
    'layout. The "Paste JD" tab provides a large text area where admins can paste raw job descriptions, '
    'with an "Auto-Extract" button that triggers LLM parsing and populates the form fields below. The '
    '"Upload File" tab accepts PDF and DOCX uploads with the same auto-extract flow. The "Paste JSON" '
    'tab targets power users who generate structured JSON from external tools like ChatGPT or DeepSeek, '
    'with JSON validation and error highlighting. The "Fill Form" tab provides the complete manual entry '
    'form with dropdown selects for all enum fields (sector, function, job type, education level), text '
    'inputs for required skills (with tag-style input), and date pickers for deadlines.'
))
story.append(body(
    'After a job is posted through any method, the system normalizes the data, stores it in the '
    'database, and triggers the background matching job. The admin should see a confirmation message '
    'with the job ID and a link to preview the job listing. The application management section shows '
    'all submitted applications with the candidate\'s profile, match score, and application status '
    '(pending, reviewed, shortlisted, rejected, hired). Admins can update application statuses and '
    'add internal notes visible only to the admin team.'
))

story.append(heading2('7.2 Privacy Center'))
story.append(body(
    'The privacy center provides three DPA-mandated features. The data export endpoint compiles all '
    'of a candidate\'s stored data (profile, education, work experience clusters, extras) into a single '
    'JSON object, creates an export record with a 7-day expiry, and returns the data for download. '
    'The account deletion endpoint requires the user to type "DELETE" for confirmation, initiates a '
    'soft-delete by setting is_active to FALSE and deleted_at to the current timestamp, removes the '
    'candidate from all match results, and creates a deletion request record with a 30-day pending '
    'status. After 30 days, a monthly cleanup cron job permanently purges soft-deleted accounts and all '
    'their associated data. The consent management section shows a history of all consent actions '
    '(signup, CV upload, marketing, data processing) with timestamps and versions.'
))

story.append(heading2('7.3 Testing Strategy'))
story.append(body(
    'Testing should cover three levels. Unit tests (using Jest) should validate individual functions: '
    'the normalization pipeline (ensuring "BSc" maps to "Bachelor", "hr" does not match "research"), '
    'the scoring algorithm (ensuring scores are within 0-100, edge cases for missing data produce '
    'partial scores rather than zero), and the field similarity mapping (the 12 test cases from the '
    'technical documentation). Integration tests should validate API endpoints end-to-end: upload a CV, '
    'verify database records, post a job, verify matching results. End-to-end tests should simulate '
    'a complete user journey: register, upload CV, select trajectories, view matches, apply for a job, '
    'export data, delete account.'
))

story.append(heading2('7.4 Production Readiness'))
story.append(body(
    'Production deployment requires several final checks. Database query optimization should identify '
    'slow queries (particularly the matching cron job) and add appropriate composite indexes. Security '
    'hardening should include rate limiting on API endpoints, CSRF protection, input sanitization, and '
    'SQL injection prevention (mitigated by Prisma\'s parameterized queries). Error tracking should be '
    'configured using a service like Sentry or equivalent, with alerts for LLM extraction failures '
    'exceeding a threshold. The deployment should target Vercel for the frontend and API routes, with '
    'a managed MySQL instance (PlanetScale, Amazon RDS, or equivalent) for the database. Environment '
    'variables should be configured through Vercel\'s dashboard, never committed to the repository.'
))

story.append(heading2('7.5 Deliverables and Acceptance Criteria'))
deliverables_5 = [
    ['D5.1', 'Admin dashboard with 4-method job posting', 'All 4 methods create valid job records'],
    ['D5.2', 'Privacy center: export, delete, consent history', 'Export returns JSON, delete soft-removes account'],
    ['D5.3', 'Unit tests: normalization, scoring, field mapping', 'All tests pass, coverage exceeds 80%'],
    ['D5.4', 'Integration tests: CV upload, job post, matching', 'Full pipeline tested end-to-end'],
    ['D5.5', 'Performance: matching cron under 30 seconds', '10K candidates, 100 jobs matched in under 30s'],
    ['D5.6', 'Production deployment with monitoring', 'Live on Vercel, error tracking active'],
]
t9 = make_table(['ID', 'Deliverable', 'Acceptance'], deliverables_5, [0.06, 0.52, 0.42])
story.append(spacer(8))
story.append(t9)
story.append(caption('Table 9: Phase 5 Deliverables'))

story.append(PageBreak())

# ══════════════════════════════════════════════
# SECTION 8: CROSS-PHASE DEPENDENCIES
# ══════════════════════════════════════════════
story.append(heading1('8. Cross-Phase Dependencies'))
story.append(hr())

story.append(body(
    'Understanding the dependencies between phases is critical for planning sprints and allocating '
    'developer resources. The following dependency map shows which deliverables from earlier phases '
    'are required before specific tasks in later phases can begin. Tasks within the same phase can '
    'generally be parallelized, but cross-phase dependencies create a sequential ordering constraint.'
))

dep_data = [
    ['D1.2 (Database Schema)', 'D2.2 (CV Upload)', 'Cannot store CV data without tables'],
    ['D1.3 (Authentication)', 'D2.2 (CV Upload)', 'CV upload requires authenticated session'],
    ['D1.5 (Normalization)', 'D2.2 (CV Upload)', 'CV data must be normalized before storage'],
    ['D2.1 (LLM Integration)', 'D2.3 (Job Posting)', 'Job parsing reuses the LLM retry logic'],
    ['D2.4 (Field Mapping)', 'D3.1 (Scoring Algorithm)', 'Education field bonus uses field mapping'],
    ['D2.2/D2.3 (Data Storage)', 'D3.2 (Cron Job)', 'Matching requires candidate and job data in DB'],
    ['D1.2 (Database Schema)', 'D3.2 (Cron Job)', 'job_matches table must exist'],
    ['D3.5 (Match API)', 'D4.3 (Dashboard)', 'Dashboard fetches matches from the API'],
    ['D3.3 (Explanations)', 'D4.4 (Job Detail)', 'Job detail page shows explanation text'],
    ['D1.4 (Consent Records)', 'D5.2 (Privacy Center)', 'Privacy features need consent infrastructure'],
    ['D4.3 (Dashboard)', 'D5.3 (Testing)', 'Integration tests need a functional UI'],
]
t10 = make_table(['Depends On', 'Enables', 'Reason'], dep_data, [0.22, 0.22, 0.56])
story.append(spacer(8))
story.append(t10)
story.append(caption('Table 10: Cross-Phase Dependency Map'))

story.append(heading2('8.1 Parallelization Opportunities'))
story.append(body(
    'While the phases are sequential, individual tasks within each phase can be parallelized across '
    'a team of two to three developers. In Phase 1, the database schema, authentication, and '
    'normalization system can be developed in parallel since they are independent components. In Phase 2, '
    'the CV upload flow and job posting flow share the LLM integration layer but diverge in their '
    'specific handling, so one developer can focus on the CV path while another works on the JD path. '
    'In Phase 3, the scoring algorithm and the cron job infrastructure can be developed in parallel '
    'if the database schema is already in place. In Phase 4, the landing page, onboarding flow, '
    'dashboard, and job detail page can be split across developers since they are separate UI components '
    'that consume the same API endpoints.'
))

story.append(PageBreak())

# ══════════════════════════════════════════════
# SECTION 9: RISK REGISTER
# ══════════════════════════════════════════════
story.append(heading1('9. Risk Register and Mitigations'))
story.append(hr())

story.append(body(
    'Every project carries risks that could delay delivery or reduce quality. This section identifies '
    'the most significant risks for the build plan and describes specific mitigation strategies that '
    'should be proactively implemented rather than reactively addressed.'
))

risk_data = [
    ['R1', 'LLM Extraction Inaccuracy', 'HIGH', 'MEDIUM',
     'The LLM may misclassify functions or extract incorrect data from poorly formatted Kenyan CVs',
     'The word-boundary normalization catches common misclassifications. The parse_failures table '
     'logs all failures for manual review. The consent flow allows candidates to edit their extracted '
     'profile. Budget 2-3 days for manual review of the first 100 extractions.'],
    ['R2', 'Normalization False Positives', 'MEDIUM', 'LOW',
     'The normalization enum matching may incorrectly map variants',
     'Word-boundary regex prevents substring false matches. Unit tests cover all documented edge '
     'cases. The RELATED_FIELDS matrix with stopwords filtering handles field similarity.'],
    ['R3', 'Matching Scalability', 'MEDIUM', 'MEDIUM',
     'The N-squared matching problem as candidates and jobs grow',
     'Function-indexed queries reduce the comparison set dramatically. Incremental matching (only '
     'jobs from the last hour) limits the per-run workload. Composite indexes on function and selected '
     'fields ensure query performance. Monitor query times and add query caching if needed.'],
    ['R4', 'DPA Compliance Gaps', 'LOW', 'HIGH',
     'The platform handles personal data subject to Kenya\'s Data Protection Act',
     'Consent flows are implemented at signup and CV upload. Data export and deletion APIs are '
     'available. Soft-delete with 30-day grace period is implemented. Monthly cleanup cron job handles '
     'retention. Consult a DPA expert before launch for compliance audit.'],
    ['R5', 'Kenyan Mobile Network Latency', 'MEDIUM', 'LOW',
     'Users on slow mobile connections may have poor experience',
     'Mobile-first responsive design minimizes bandwidth usage. API responses should be paginated '
     'and compressed. Static assets should be served through Vercel\'s CDN. Landing page should '
     'load in under 3 seconds on 3G connections.'],
]
t11 = make_table(['ID', 'Risk', 'Likelihood', 'Impact', 'Description', 'Mitigation'],
    risk_data, [0.04, 0.10, 0.07, 0.06, 0.27, 0.46])
story.append(spacer(8))
story.append(t11)
story.append(caption('Table 11: Risk Register'))

story.append(PageBreak())

# ══════════════════════════════════════════════
# SECTION 10: TEAM AND EFFORT
# ══════════════════════════════════════════════
story.append(heading1('10. Team Composition and Effort Estimates'))
story.append(hr())

story.append(heading2('10.1 Recommended Team'))
story.append(body(
    'The recommended team composition for this build is two full-stack developers with experience in '
    'Next.js, TypeScript, and MySQL. Both developers should be comfortable working across the full '
    'stack since the project uses Next.js API routes rather than a separate backend service. One '
    'developer should have stronger frontend/UI skills (for Phases 4 and 5), while the other should '
    'have stronger backend/data skills (for Phases 2 and 3). A part-time DevOps resource should be '
    'available for deployment and infrastructure setup in Phase 5. An optional QA resource can assist '
    'with test writing and manual testing in Phases 3-5.'
))

team_data = [
    ['Full-Stack Developer 1', 'Phases 1-5', 'Backend focus: DB, API, matching, cron jobs', 'Full-time, 10 weeks'],
    ['Full-Stack Developer 2', 'Phases 1-5', 'Frontend focus: UI components, responsive design', 'Full-time, 10 weeks'],
    ['DevOps (part-time)', 'Phase 5 only', 'Vercel deployment, MySQL provisioning, monitoring', 'Part-time, 2 weeks'],
    ['QA (optional)', 'Phases 3-5', 'Test writing, manual testing, regression testing', 'Part-time, 4 weeks'],
]
t12 = make_table(['Role', 'Phases', 'Focus Area', 'Commitment'], team_data, [0.22, 0.14, 0.38, 0.26])
story.append(spacer(8))
story.append(t12)
story.append(caption('Table 12: Recommended Team Composition'))

story.append(heading2('10.2 Effort Summary'))

effort_data = [
    ['Phase 1: Foundation', 'Week 1-2', '2 devs', '10 person-days'],
    ['Phase 2: Data Pipeline', 'Week 3-4', '2 devs', '20 person-days'],
    ['Phase 3: Matching Engine', 'Week 5-6', '2 devs', '20 person-days'],
    ['Phase 4: Candidate UI', 'Week 7-8', '2 devs', '20 person-days'],
    ['Phase 5: Admin + Production', 'Week 9-10', '2 devs + part-time ops', '22 person-days'],
    ['', '', 'TOTAL', '92 person-days'],
]
t13 = make_table(['Phase', 'Timeline', 'Resources', 'Effort'], effort_data, [0.22, 0.14, 0.22, 0.22])
story.append(spacer(8))
story.append(t13)
story.append(caption('Table 13: Effort Summary'))

story.append(spacer(16))

# Timeline visualization
timeline_data = [
    ['Phase 1', 'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8', 'Week 9', 'Week 10'],
    ['Foundation', '', '', '', '', '', '', '', '', '', '', ''],
    ['Data Pipeline', '', '', '', '', '', '', '', '', '', '', ''],
    ['Matching', '', '', '', '', '', '', '', '', '', '', ''],
    ['Candidate UI', '', '', '', '', '', '', '', '', '', '', ''],
    ['Admin + Prod', '', '', '', '', '', '', '', '', '', '', ''],
]
for row_data in timeline_data:
    pass

story.append(heading2('10.3 Milestone Checkpoints'))
story.append(body(
    'Each phase concludes with a formal milestone review where the deliverables are verified against '
    'the acceptance criteria defined in each phase section. Milestone reviews should include a demo '
    'of the working features, a review of any test failures or known issues, and a go/no-go decision '
    'for proceeding to the next phase. The following milestones are defined:'
))

milestones = [
    ['M1', 'End of Phase 1', 'Project runs locally, auth works, DB schema is complete, normalization tests pass'],
    ['M2', 'End of Phase 2', 'CV upload produces correct parsed data, job posting works with all 4 methods, consent flows work'],
    ['M3', 'End of Phase 3', 'Matching engine produces correct scores, cron job runs every 5 min, re-matching works'],
    ['M4', 'End of Phase 4', 'Candidate dashboard shows ranked matches, responsive on mobile, job detail page works'],
    ['M5', 'End of Phase 5', 'Admin can post jobs, privacy center works, tests pass, deployed to production'],
]
t14 = make_table(['Milestone', 'Checkpoint', 'Exit Criteria'], milestones, [0.08, 0.14, 0.78])
story.append(spacer(8))
story.append(t14)
story.append(caption('Table 14: Milestone Checkpoints'))

# ── Build PDF ──
def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont('FreeSerif', 8)
    canvas.setFillColor(TEXT_MUTED)
    page_num = canvas.getPageNumber()
    if page_num > 1:  # Skip cover page
        canvas.drawCentredString(W / 2, 25, f'Page {page_num - 1}')
    canvas.restoreState()

doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=MARGIN,
    rightMargin=MARGIN,
    topMargin=MARGIN,
    bottomMargin=MARGIN,
    title='Job Matching Platform - Phase-by-Phase Build Plan',
    author='Z.ai',
    subject='Technical Implementation Plan',
)

doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
print(f"PDF generated: {OUTPUT}")
print(f"Pages: ~20")
