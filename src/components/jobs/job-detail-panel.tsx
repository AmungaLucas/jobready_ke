'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, MapPin, Briefcase, Calendar, Banknote,
  GraduationCap, Wrench, TrendingUp, FileText, Building2,
  CheckCircle2, Info,
} from 'lucide-react';
import {
  JobDetail, ScoreBreakdown, FUNCTION_LABELS, SECTOR_LABELS,
  JOB_TYPE_LABELS, EDUCATION_LABELS, EXPLANATION_LABELS,
} from '@/lib/types';
import { toast } from 'sonner';

interface JobDetailPanelProps {
  jobId: string;
  onBack: () => void;
}

export function JobDetailPanel({ jobId, onBack }: JobDetailPanelProps) {
  const { data, isLoading, error } = useQuery<{ job: JobDetail; match: ScoreBreakdown | null }>({
    queryKey: ['job', jobId],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) throw new Error('Failed to load job');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Couldn't load this job.</p>
        <Button variant="ghost" onClick={onBack} className="mt-4">← Back to matches</Button>
      </div>
    );
  }

  const { job, match } = data;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Back to matches
      </Button>

      {/* ─── Match Score Banner ─── */}
      {match && (
        <Card className="bg-gradient-to-br from-primary/5 via-primary/5 to-transparent border-primary/20">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="text-4xl font-bold text-primary">{match.totalScore}%</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">match score</div>
              </div>
              <div className="flex-1 space-y-2">
                <p className="font-medium text-sm">Why we matched you</p>
                <div className="flex flex-wrap gap-1.5">
                  {match.explanations.map((exp) => (
                    <Badge key={exp} variant="secondary" className="text-xs gap-1 font-normal">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      {EXPLANATION_LABELS[exp] ?? exp}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="grid grid-cols-6 gap-3 text-center">
              <ScoreBar label="Title" value={match.titleScore} max={40} />
              <ScoreBar label="Skills" value={match.skillsScore} max={35} />
              <ScoreBar label="Education" value={match.educationScore} max={15} />
              <ScoreBar label="Specialization" value={match.specializationScore} max={10} />
              <ScoreBar label="Family" value={match.familyScore} max={5} />
              <ScoreBar label="Experience" value={match.experienceScore} max={10} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Job Header ─── */}
      <Card>
        <CardContent className="p-5 sm:p-6 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold leading-tight">{job.title}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  {FUNCTION_LABELS[job.function]}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {SECTOR_LABELS[job.sector]}
                </span>
              </div>
            </div>
            <Badge variant="secondary">{JOB_TYPE_LABELS[job.jobType]}</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            {job.location && (
              <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location" value={job.location} />
            )}
            {job.salaryRange && (
              <InfoRow icon={<Banknote className="h-4 w-4" />} label="Salary" value={job.salaryRange} />
            )}
            <InfoRow
              icon={<GraduationCap className="h-4 w-4" />}
              label="Min. Education"
              value={`${EDUCATION_LABELS[job.minEducation]} in ${job.educationField}`}
            />
            <InfoRow
              icon={<Calendar className="h-4 w-4" />}
              label="Experience"
              value={`${job.minExperience}+ year${job.minExperience === 1 ? '' : 's'}`}
            />
            {job.applicationDeadline && (
              <InfoRow
                icon={<Calendar className="h-4 w-4" />}
                label="Apply by"
                value={new Date(job.applicationDeadline).toLocaleDateString('en-KE', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Job Description ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Job Description
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
            {job.description}
          </p>
        </CardContent>
      </Card>

      {/* ─── Required Skills ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Required Skills
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {job.requiredSkills.map((skill) => (
              <Badge key={skill} variant="default" className="font-normal">
                {skill}
              </Badge>
            ))}
          </div>
          {job.preferredSkills.length > 0 && (
            <>
              <Separator className="my-4" />
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Preferred (Bonus)</p>
              <div className="flex flex-wrap gap-1.5">
                {job.preferredSkills.map((skill) => (
                  <Badge key={skill} variant="outline" className="font-normal">
                    {skill}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── Administrative Requirements ─── */}
      {job.administrativeRequirements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4" />
              Additional Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              These are listed by the employer. You decide whether you meet them — we never filter you out.
            </p>
            <ul className="space-y-1.5">
              {job.administrativeRequirements.map((req, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-muted-foreground">•</span>
                  {req}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ─── Apply CTA ─── */}
      <div className="sticky bottom-4 z-10">
        <Card className="shadow-lg border-primary/20">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-medium">Interested in this job?</p>
              <p className="text-xs text-muted-foreground">You decide if you qualify. Apply with one click.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => toast.info('Save feature coming in Phase 4')}>
                Save
              </Button>
              <Button size="sm" onClick={() => toast.info('Application flow coming in Phase 4')}>
                Apply Now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm font-bold">{value}/{max}</div>
      <Progress value={pct} className="h-1" />
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <span className="text-muted-foreground text-xs uppercase tracking-wide">{label}:</span>{' '}
        <span className="font-medium">{value}</span>
      </div>
    </div>
  );
}
