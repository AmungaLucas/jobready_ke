'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Sparkles, X, Database, FileText, Upload, Code, ClipboardList, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  FUNCTION_LABELS, SECTOR_LABELS, JOB_TYPE_LABELS, EDUCATION_LABELS,
} from '@/lib/types';

const FUNCTIONS = Object.keys(FUNCTION_LABELS) as (keyof typeof FUNCTION_LABELS)[];
const SECTORS = Object.keys(SECTOR_LABELS) as (keyof typeof SECTOR_LABELS)[];
const JOB_TYPES = Object.keys(JOB_TYPE_LABELS) as (keyof typeof JOB_TYPE_LABELS)[];
const EDUCATION_LEVELS = Object.keys(EDUCATION_LABELS) as (keyof typeof EDUCATION_LABELS)[];

type InputMethod = 'paste_text' | 'upload_file' | 'paste_json' | 'form';

interface JobFormState {
  title: string;
  function: string;
  sector: string;
  jobType: string;
  minEducation: string;
  educationField: string;
  minExperience: string;
  requiredSkills: string[];
  preferredSkills: string[];
  description: string;
  location: string;
  salaryRange: string;
  applicationDeadline: string;
  administrativeRequirements: string[];
}

const EMPTY_FORM: JobFormState = {
  title: '',
  function: '',
  sector: '',
  jobType: 'full_time',
  minEducation: 'bachelors',
  educationField: '',
  minExperience: '0',
  requiredSkills: [],
  preferredSkills: [],
  description: '',
  location: '',
  salaryRange: '',
  applicationDeadline: '',
  administrativeRequirements: [],
};

export function AdminJobForm() {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<InputMethod>('form');
  const [form, setForm] = useState<JobFormState>(EMPTY_FORM);
  const [newSkill, setNewSkill] = useState('');
  const [newPreferredSkill, setNewPreferredSkill] = useState('');
  const [newAdminReq, setNewAdminReq] = useState('');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [jsonText, setJsonText] = useState('');

  function update<K extends keyof JobFormState>(key: K, value: JobFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addSkill() {
    const s = newSkill.trim().toLowerCase();
    if (s && !form.requiredSkills.includes(s)) {
      update('requiredSkills', [...form.requiredSkills, s]);
    }
    setNewSkill('');
  }
  function addPreferredSkill() {
    const s = newPreferredSkill.trim().toLowerCase();
    if (s && !form.preferredSkills.includes(s)) {
      update('preferredSkills', [...form.preferredSkills, s]);
    }
    setNewPreferredSkill('');
  }
  function addAdminReq() {
    const s = newAdminReq.trim();
    if (s && !form.administrativeRequirements.includes(s)) {
      update('administrativeRequirements', [...form.administrativeRequirements, s]);
    }
    setNewAdminReq('');
  }

  async function handleExtract() {
    if (pasteText.trim().length < 50) {
      toast.error('Please paste at least 50 characters of the job description');
      return;
    }
    setExtracting(true);
    try {
      const res = await fetch('/api/jobs/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: pasteText }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Extraction failed');
        return;
      }
      const j = data.job;
      setForm({
        title: j.title ?? '',
        function: j.function ?? '',
        sector: j.sector ?? '',
        jobType: j.jobType ?? 'full_time',
        minEducation: j.minEducation ?? 'bachelors',
        educationField: j.educationField ?? '',
        minExperience: String(j.minExperience ?? 0),
        requiredSkills: j.requiredSkills ?? [],
        preferredSkills: j.preferredSkills ?? [],
        description: j.description ?? '',
        location: j.location ?? '',
        salaryRange: j.salaryRange ?? '',
        applicationDeadline: j.applicationDeadline ?? '',
        administrativeRequirements: j.administrativeRequirements ?? [],
      });
      toast.success(`Extracted via ${data.provider}. Review the fields below, then click "Create Job" to save.`);
      setMethod('form');
    } catch (err) {
      toast.error('Extraction failed');
    } finally {
      setExtracting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.function || !form.sector || !form.educationField) {
      toast.error('Please fill in all required fields');
      return;
    }

    let body: any;
    if (method === 'paste_text') {
      if (pasteText.trim().length < 50) {
        toast.error('Please paste the JD text or extract first');
        return;
      }
      body = { inputMethod: 'paste_text', rawText: pasteText };
    } else if (method === 'paste_json') {
      let parsed: any;
      try {
        parsed = JSON.parse(jsonText);
      } catch (err) {
        toast.error('Invalid JSON');
        return;
      }
      body = { inputMethod: 'paste_json', job: parsed };
    } else {
      body = {
        ...form,
        inputMethod: 'form',
        minExperience: parseInt(form.minExperience, 10) || 0,
        applicationDeadline: form.applicationDeadline || undefined,
        salaryRange: form.salaryRange || undefined,
        location: form.location || undefined,
      };
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to create job');
        return;
      }
      toast.success(`Job created! ${data.matchesCreated} matches computed across ${data.candidatesConsidered} candidates.`);
      setForm(EMPTY_FORM);
      setPasteText('');
      setJsonText('');
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
    } catch (err) {
      toast.error('Failed to create job');
    } finally {
      setLoading(false);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      const res = await fetch('/api/admin/seed-demo', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Seed failed');
        return;
      }
      toast.success(`Demo data seeded! ${data.jobsCreated} jobs, ${data.matchesCreated} matches.`);
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
    } catch (err) {
      toast.error('Seed failed');
    } finally {
      setSeeding(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Job Posting
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding} className="gap-1.5">
            {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
            Seed Demo Data
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={method} onValueChange={(v) => setMethod(v as InputMethod)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="form" className="gap-1.5 text-xs">
              <ClipboardList className="h-3.5 w-3.5" />
              Form
            </TabsTrigger>
            <TabsTrigger value="paste_text" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" />
              Paste JD
            </TabsTrigger>
            <TabsTrigger value="upload_file" className="gap-1.5 text-xs" disabled>
              <Upload className="h-3.5 w-3.5" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="paste_json" className="gap-1.5 text-xs">
              <Code className="h-3.5 w-3.5" />
              JSON
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste_json" className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="json-text">Job JSON</Label>
              <Textarea
                id="json-text"
                placeholder={`{\n  "title": "Senior Accountant",\n  "function": "finance",\n  "sector": "financial_services",\n  "jobType": "full_time",\n  "minEducation": "bachelors",\n  "educationField": "Accounting",\n  "minExperience": 3,\n  "requiredSkills": ["accounting", "ifrs", "audit"],\n  "preferredSkills": ["quickbooks"],\n  "description": "...",\n  "location": "Nairobi, Kenya",\n  "salaryRange": "KES 120,000 - 180,000"\n}`}
                className="min-h-[280px] font-mono text-xs"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Paste a complete job object as JSON. No LLM is used — fields are validated and saved directly.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="paste_text" className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="jd-text">Job description text</Label>
              <Textarea
                id="jd-text"
                placeholder="Paste the full job description here. Our AI will extract the title, function, sector, skills, education requirements, and more..."
                className="min-h-[280px] text-sm leading-relaxed"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {pasteText.length} characters · minimum 50 required
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleExtract} disabled={extracting || pasteText.length < 50} className="gap-1.5">
                {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                Extract & Preview
              </Button>
              <Button type="button" onClick={handleSubmit as any} disabled={loading || pasteText.length < 50} className="gap-1.5">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Extract & Create
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Click "Extract & Preview" to populate the form fields (editable). Click "Extract & Create" to skip preview and save directly.
            </p>
          </TabsContent>

          <TabsContent value="upload_file" className="mt-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                File upload will be available in Phase 3. For now, please paste the JD text.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="form" className="mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Job Title *</Label>
                <Input id="title" placeholder="e.g. Senior Accountant" value={form.title} onChange={(e) => update('title', e.target.value)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Function *</Label>
                  <Select value={form.function} onValueChange={(v) => update('function', v)}>
                    <SelectTrigger><SelectValue placeholder="Select function" /></SelectTrigger>
                    <SelectContent>
                      {FUNCTIONS.map((f) => (<SelectItem key={f} value={f}>{FUNCTION_LABELS[f]}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Sector *</Label>
                  <Select value={form.sector} onValueChange={(v) => update('sector', v)}>
                    <SelectTrigger><SelectValue placeholder="Select sector" /></SelectTrigger>
                    <SelectContent>
                      {SECTORS.map((s) => (<SelectItem key={s} value={s}>{SECTOR_LABELS[s]}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Job Type</Label>
                  <Select value={form.jobType} onValueChange={(v) => update('jobType', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {JOB_TYPES.map((t) => (<SelectItem key={t} value={t}>{JOB_TYPE_LABELS[t]}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Min. Education</Label>
                  <Select value={form.minEducation} onValueChange={(v) => update('minEducation', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EDUCATION_LEVELS.map((l) => (<SelectItem key={l} value={l}>{EDUCATION_LABELS[l]}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="educationField">Education Field *</Label>
                  <Input id="educationField" placeholder="e.g. Accounting" value={form.educationField} onChange={(e) => update('educationField', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="minExperience">Min. Experience (years)</Label>
                  <Input id="minExperience" type="number" min="0" value={form.minExperience} onChange={(e) => update('minExperience', e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Required Skills</Label>
                <div className="flex gap-2">
                  <Input placeholder="Type a skill and press Enter" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} />
                  <Button type="button" variant="outline" onClick={addSkill}>Add</Button>
                </div>
                {form.requiredSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.requiredSkills.map((s) => (
                      <Badge key={s} className="gap-1">
                        {s}
                        <button type="button" onClick={() => update('requiredSkills', form.requiredSkills.filter((x) => x !== s))} className="ml-1 hover:text-destructive-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Preferred Skills (Optional)</Label>
                <div className="flex gap-2">
                  <Input placeholder="Bonus skills" value={newPreferredSkill} onChange={(e) => setNewPreferredSkill(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPreferredSkill(); } }} />
                  <Button type="button" variant="outline" onClick={addPreferredSkill}>Add</Button>
                </div>
                {form.preferredSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.preferredSkills.map((s) => (
                      <Badge key={s} variant="outline" className="gap-1">
                        {s}
                        <button type="button" onClick={() => update('preferredSkills', form.preferredSkills.filter((x) => x !== s))}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Job Description</Label>
                <Textarea id="description" placeholder="Describe the role, responsibilities, and what the candidate will do..." className="min-h-[120px]" value={form.description} onChange={(e) => update('description', e.target.value)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" placeholder="Nairobi, Kenya" value={form.location} onChange={(e) => update('location', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="salaryRange">Salary Range</Label>
                  <Input id="salaryRange" placeholder="KES 80,000 - 120,000" value={form.salaryRange} onChange={(e) => update('salaryRange', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="applicationDeadline">Application Deadline</Label>
                  <Input id="applicationDeadline" type="date" value={form.applicationDeadline} onChange={(e) => update('applicationDeadline', e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Additional Requirements (Optional)</Label>
                <div className="flex gap-2">
                  <Input placeholder="e.g. CPA K, Portfolio required" value={newAdminReq} onChange={(e) => setNewAdminReq(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAdminReq(); } }} />
                  <Button type="button" variant="outline" onClick={addAdminReq}>Add</Button>
                </div>
                {form.administrativeRequirements.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.administrativeRequirements.map((s) => (
                      <Badge key={s} variant="secondary" className="gap-1">
                        {s}
                        <button type="button" onClick={() => update('administrativeRequirements', form.administrativeRequirements.filter((x) => x !== s))}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  These are shown to candidates but never used to filter them out — the candidate decides if they qualify.
                </p>
              </div>

              <Button type="submit" disabled={loading} className="w-full gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Create Job
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
