'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/layout/empty-state';
import {
  Loader2, MapPin, Briefcase, Calendar, TrendingUp,
  Sparkles, Lock,
} from 'lucide-react';
import {
  MatchRow, FUNCTION_LABELS, SECTOR_LABELS, JOB_TYPE_LABELS,
  EXPLANATION_LABELS,
} from '@/lib/types';

interface MatchesListProps {
  onOpenJob: (jobId: string) => void;
}

export function MatchesList({ onOpenJob }: MatchesListProps) {
  const { data, isLoading, error } = useQuery<{ matches: MatchRow[]; count: number }>({
    queryKey: ['matches'],
    queryFn: async () => {
      const res = await fetch('/api/matches');
      if (!res.ok) throw new Error('Failed to load matches');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Couldn't load matches"
        description="Please refresh the page or try again later."
        icon={<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
      />
    );
  }

  const matches = data?.matches ?? [];

  if (matches.length === 0) {
    return (
      <EmptyState
        title="No matches yet"
        description="We're looking for jobs that match your profile. Upload your CV and select up to 3 career trajectories so we can find jobs that fit your story."
        icon={<Sparkles className="h-10 w-10 text-muted-foreground" />}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{matches.length}</span>{' '}
          {matches.length === 1 ? 'job' : 'jobs'} matched to your profile
        </p>
        <Badge variant="secondary" className="gap-1">
          <TrendingUp className="h-3 w-3" />
          Ranked by relevance
        </Badge>
      </div>
      {matches.map((match, idx) => (
        <MatchCard
          key={match.id}
          match={match}
          rank={idx + 1}
          onOpen={() => onOpenJob(match.jobId)}
        />
      ))}
    </div>
  );
}

function MatchCard({
  match,
  rank,
  onOpen,
}: {
  match: MatchRow;
  rank: number;
  onOpen: () => void;
}) {
  const score = match.totalScore;
  const scoreColor =
    score >= 75 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-muted-foreground';
  const scoreBg =
    score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-muted-foreground';

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md cursor-pointer group" onClick={onOpen}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          {/* Rank badge */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
            {rank}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-base sm:text-lg leading-tight group-hover:text-primary transition-colors truncate">
                  {match.job.title}
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {FUNCTION_LABELS[match.job.function]}
                  </span>
                  <span>·</span>
                  <span>{SECTOR_LABELS[match.job.sector]}</span>
                  {match.job.location && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {match.job.location}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Score circle */}
              <div className="flex-shrink-0 flex flex-col items-end">
                <div className={`text-2xl font-bold ${scoreColor}`}>{score}%</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">match</div>
              </div>
            </div>

            {/* Score breakdown bar */}
            <div className="flex items-center gap-2">
              <Progress value={score} className={`h-1.5 ${scoreBg}`} />
            </div>

            {/* Why this matches */}
            {match.explanations.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {match.explanations.slice(0, 3).map((exp) => (
                  <Badge key={exp} variant="outline" className="text-[10px] py-0 h-5 font-normal">
                    {EXPLANATION_LABELS[exp] ?? exp}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {match.job.salaryRange && (
                  <span className="font-medium text-foreground/80">{match.job.salaryRange}</span>
                )}
                {match.job.applicationDeadline && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(match.job.applicationDeadline).toLocaleDateString('en-KE', {
                      day: 'numeric', month: 'short',
                    })}
                  </span>
                )}
                <Badge variant="secondary" className="text-[10px] py-0 h-5">
                  {JOB_TYPE_LABELS[match.job.jobType]}
                </Badge>
              </div>
              <Button size="sm" variant="ghost" className="text-xs h-7">
                View details →
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
