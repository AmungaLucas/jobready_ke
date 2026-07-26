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
import { Loader2, Plus, Sparkles, X, Database } from 'lucide-react';
import { toast } from 'sonner';
import {
  FUNCTION_LABELS, SECTOR_LABELS, JOB_TYPE_LABELS, EDUCATION_LABELS,
} from '@/lib/types';

const FUNCTIONS = Object.keys(FUNCTION_LABELS) as (keyof typeof FUNCTION_LABELS)[];
const SECTORS = Object.keys(SECTOR_LABELS) as (keyof typeof SECTOR_LABELS)[];
const JOB_TYPES = Object.keys(JOB_TYPE_LABELS) as (keyof typeof JOB_TYPE_LABELS)[];
const EDUCATION_LEVELS = Object.keys(EDUCATION_LABELS) as (keyof typeof EDUCATION_LABELS)[];

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
  const [form, setForm] = useState<JobFormState>(EMPTY_FORM);
  const [newSkill, setNewSkill] = useState('');
  const [newPreferredSkill, setNewPreferredSkill] = useState('');
  const [newAdminReq, setNewAdminReq] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.function || !form.sector || !form.educationField) {
      toast.error('Please fill in all required fields');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          inputMethod: 'form',
          minExperience: parseInt(form.minExperience, 10) || 0,
          applicationDeadline: form.applicationDeadline || undefined,
          salaryRange: form.salaryRange || undefined,
          location: form.location || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to create job');
        return;
      }
      toast.success('Job created successfully');
      setForm(EMPTY_FORM);
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
      const res = await fetch('/api/admin/seed-demo', {
        method: 'POST',
      });
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeed}
            disabled={seeding}
            className="gap-1.5"
          >
            {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
            Seed Demo Data
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Job Title *</Label>
            <Input
              id="title"
              placeholder="e.g. Senior Accountant"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
            />
          </div>

          {/* Function + Sector + Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Function *</Label>
              <Select value={form.function} onValueChange={(v) => update('function', v)}>
                <SelectTrigger><SelectValue placeholder="Select function" /></SelectTrigger>
                <SelectContent>
                  {FUNCTIONS.map((f) => (
                    <SelectItem key={f} value={f}>{FUNCTION_LABELS[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sector *</Label>
              <Select value={form.sector} onValueChange={(v) => update('sector', v)}>
                <SelectTrigger><SelectValue placeholder="Select sector" /></SelectTrigger>
                <SelectContent>
                  {SECTORS.map((s) => (
                    <SelectItem key={s} value={s}>{SECTOR_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Job Type</Label>
              <Select value={form.jobType} onValueChange={(v) => update('jobType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JOB_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{JOB_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Education + Experience */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Min. Education</Label>
              <Select value={form.minEducation} onValueChange={(v) => update('minEducation', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EDUCATION_LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>{EDUCATION_LABELS[l]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="educationField">Education Field *</Label>
              <Input
                id="educationField"
                placeholder="e.g. Accounting"
                value={form.educationField}
                onChange={(e) => update('educationField', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minExperience">Min. Experience (years)</Label>
              <Input
                id="minExperience"
                type="number"
                min="0"
                value={form.minExperience}
                onChange={(e) => update('minExperience', e.target.value)}
              />
            </div>
          </div>

          {/* Required Skills */}
          <div className="space-y-1.5">
            <Label>Required Skills</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Type a skill and press Enter"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
              />
              <Button type="button" variant="outline" onClick={addSkill}>Add</Button>
            </div>
            {form.requiredSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.requiredSkills.map((s) => (
                  <Badge key={s} className="gap-1">
                    {s}
                    <button
                      type="button"
                      onClick={() => update('requiredSkills', form.requiredSkills.filter((x) => x !== s))}
                      className="ml-1 hover:text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Preferred Skills */}
          <div className="space-y-1.5">
            <Label>Preferred Skills (Optional)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Bonus skills"
                value={newPreferredSkill}
                onChange={(e) => setNewPreferredSkill(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPreferredSkill(); } }}
              />
              <Button type="button" variant="outline" onClick={addPreferredSkill}>Add</Button>
            </div>
            {form.preferredSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.preferredSkills.map((s) => (
                  <Badge key={s} variant="outline" className="gap-1">
                    {s}
                    <button
                      type="button"
                      onClick={() => update('preferredSkills', form.preferredSkills.filter((x) => x !== s))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Job Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the role, responsibilities, and what the candidate will do..."
              className="min-h-[120px]"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
            />
          </div>

          {/* Location + Salary + Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="Nairobi, Kenya"
                value={form.location}
                onChange={(e) => update('location', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="salaryRange">Salary Range</Label>
              <Input
                id="salaryRange"
                placeholder="KES 80,000 - 120,000"
                value={form.salaryRange}
                onChange={(e) => update('salaryRange', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="applicationDeadline">Application Deadline</Label>
              <Input
                id="applicationDeadline"
                type="date"
                value={form.applicationDeadline}
                onChange={(e) => update('applicationDeadline', e.target.value)}
              />
            </div>
          </div>

          {/* Administrative Requirements */}
          <div className="space-y-1.5">
            <Label>Additional Requirements (Optional)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. CPA K, Portfolio required"
                value={newAdminReq}
                onChange={(e) => setNewAdminReq(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAdminReq(); } }}
              />
              <Button type="button" variant="outline" onClick={addAdminReq}>Add</Button>
            </div>
            {form.administrativeRequirements.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.administrativeRequirements.map((s) => (
                  <Badge key={s} variant="secondary" className="gap-1">
                    {s}
                    <button
                      type="button"
                      onClick={() => update('administrativeRequirements', form.administrativeRequirements.filter((x) => x !== s))}
                    >
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
      </CardContent>
    </Card>
  );
}
