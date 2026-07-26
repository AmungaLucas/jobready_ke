'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, RefreshCw, Briefcase, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { FUNCTION_LABELS, SECTOR_LABELS, JOB_TYPE_LABELS } from '@/lib/types';

export function AdminJobsList() {
  const queryClient = useQueryClient();
  const [computing, setComputing] = useState(false);

  const { data, isLoading } = useQuery<{ jobs: any[] }>({
    queryKey: ['admin-jobs'],
    queryFn: async () => {
      const res = await fetch('/api/admin/jobs?includeInactive=false');
      if (!res.ok) throw new Error('Failed to load jobs');
      return res.json();
    },
  });

  async function handleComputeMatches() {
    setComputing(true);
    try {
      const res = await fetch('/api/admin/compute-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Compute failed');
        return;
      }
      toast.success(`Computed ${data.matchesComputed} matches across ${data.jobsProcessed} jobs and ${data.candidatesProcessed} candidates.`);
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    } catch (err) {
      toast.error('Compute failed');
    } finally {
      setComputing(false);
    }
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  const jobs = data?.jobs ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Active Jobs ({jobs.length})
          </CardTitle>
          <Button
            size="sm"
            variant="default"
            onClick={handleComputeMatches}
            disabled={computing}
            className="gap-1.5"
          >
            {computing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Compute Matches
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No jobs yet. Create one above or seed demo data.
          </p>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{job.title}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-1">
                      <span>{FUNCTION_LABELS[job.function as keyof typeof FUNCTION_LABELS]}</span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        <Building2 className="h-2.5 w-2.5" />
                        {SECTOR_LABELS[job.sector as keyof typeof SECTOR_LABELS]}
                      </span>
                      <span>·</span>
                      <Badge variant="secondary" className="text-[10px] h-4 py-0">
                        {JOB_TYPE_LABELS[job.jobType as keyof typeof JOB_TYPE_LABELS]}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end max-w-[50%]">
                    {job.requiredSkills.slice(0, 3).map((s: string) => (
                      <Badge key={s} variant="outline" className="text-[9px] h-4 py-0 font-normal">
                        {s}
                      </Badge>
                    ))}
                    {job.requiredSkills.length > 3 && (
                      <Badge variant="outline" className="text-[9px] h-4 py-0 font-normal">
                        +{job.requiredSkills.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2">
                  <span>
                    Min edu: {job.minEducation} · Min exp: {job.minExperience}y · Field: {job.educationField}
                  </span>
                  <span>
                    {new Date(job.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
