'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/layout/empty-state';
import {
  Loader2, MapPin, Briefcase, Calendar, TrendingUp,
  Sparkles, Route, Clock,
} from 'lucide-react';
import {
  MatchRow, FUNCTION_LABELS, SECTOR_LABELS, JOB_TYPE_LABELS,
  EXPLANATION_LABELS,
} from '@/lib/types';

interface MatchesListProps {
  onOpenJob: (jobId: string) => void;
}

interface ClusterInfo {
  id: string;
  function: string;
  jobTitles: string[];
  skills: string[];
  yearsExperience: number;
  isSelected: boolean;
}

// ─── Trajectory cards shown above the matches list ────────────────────────

function TrajectoryBar() {
  const { data: profileData } = useQuery<{
    clusters: ClusterInfo[];
    selectedTrajectoryCount: number;
  }>({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await fetch('/api/cv/profile');
      if (!res.ok) return null;
      return res.json();
    },
    // Don't refetch on window focus to avoid flicker
    staleTime: 60_000,
  });

  const clusters = profileData?.clusters ?? [];

  // Don't show the bar if no CV has been uploaded
  if (clusters.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Route className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">Your Career Trajectories</p>
        <Badge variant="secondary" className="text-[10px]">
          {clusters.filter((c) => c.isSelected).length} active
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {clusters.map((cluster) => (
          <Card
            key={cluster.id}
            className={`flex-1 min-w-[200px] max-w-[300px] ${
              cluster.isSelected
                ? 'border-primary/40 bg-primary/5'
                : 'border-border/50 opacity-70'
            }`}
          >
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Badge
                  variant={cluster.isSelected ? 'default' : 'secondary'}
                  className="text-[10px] capitalize"
                >
                  {FUNCTION_LABELS[cluster.function as keyof typeof FUNCTION_LABELS]
                    ?? cluster.function.replace(/_/g, ' ')}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {cluster.yearsExperience} yrs
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {cluster.jobTitles.slice(0, 4).map((title) => (
                  <Badge key={title} variant="outline" className="text-[10px] font-normal">
                    {title}
                  </Badge>
                ))}
                {cluster.jobTitles.length > 4 && (
                  <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                    +{cluster.jobTitles.length - 4} more
                  </Badge>
                )}
              </div>
              {cluster.skills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {cluster.skills.slice(0, 5).map((skill) => (
                    <span
                      key={skill}
                      className="text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5"
                    >
                      {skill}
                    </span>
                  ))}
                  {cluster.skills.length > 5 && (
                    <span className="text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
                      +{cluster.skills.length - 5}
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Main matches list ────────────────────────────────────────────────────

export function MatchesList({ onOpenJob }: MatchesListProps) {
  const { data, isLoading, error } = useQuery<{ matches: MatchRow[]; count: number }>({
    queryKey: ['matches'],
    queryFn: async () => {
      const res = await fetch('/api/matches');
      if (!res.ok) throw new Error('Failed to load matches');
      return res.json();
    },
  });

  // Always show trajectories bar (it has its own loading state)
  const showTrajectories = !isLoading;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <TrajectoryBar />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <TrajectoryBar />
        <EmptyState
          title="Couldn't load matches"
          description="Please refresh the page or try again later."
          icon={<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
        />
      </div>
    );
  }

  const matches = data?.matches ?? [];

  return (
    <div className="space-y-4">
      {showTrajectories && <TrajectoryBar />}

      {matches.length === 0 ? (
        <EmptyState
          title="No matches yet"
          description="We're looking for jobs that match your profile. Upload your CV and select up to 3 career trajectories so we can find jobs that fit your story."
          icon={<Sparkles className="h-10 w-10 text-muted-foreground" />}
        />
      ) : (
        <>
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
        </>
      )}
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
