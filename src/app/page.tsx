'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { AuthModal } from '@/components/auth/auth-modal';
import { MatchesList } from '@/components/candidate/matches-list';
import { CvUploadModal } from '@/components/candidate/cv-upload-modal';
import { JobDetailPanel } from '@/components/jobs/job-detail-panel';
import { ProfilePanel } from '@/components/privacy/profile-panel';
import { AdminJobForm } from '@/components/admin/admin-job-form';
import { AdminJobsList } from '@/components/admin/admin-jobs-list';
import {
  Sparkles, User, LogOut, LayoutDashboard, Briefcase, Shield,
  Upload, ChevronDown, Heart, Zap, Target, Lock,
} from 'lucide-react';
import { toast } from 'sonner';

type CandidateView = 'matches' | 'job-detail' | 'profile';
type AdminView = 'jobs' | 'create';

export default function Home() {
  const { data: session, status } = useSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [cvUploadOpen, setCvUploadOpen] = useState(false);
  const [candidateView, setCandidateView] = useState<CandidateView>('matches');
  const [adminView, setAdminView] = useState<AdminView>('jobs');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  // Mount gate: ensures the first client render matches the server render
  // exactly (both render the loading shell). This prevents hydration
  // mismatches triggered by browser extensions (e.g. screen recorders)
  // that mutate <body> before React hydrates.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Open auth modal automatically when URL has ?auth=signin
  useEffect(() => {
    if (!mounted) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('auth') === 'signin' && status !== 'authenticated') {
      // Defer to avoid synchronous setState in effect
      const t = setTimeout(() => setAuthOpen(true), 0);
      return () => clearTimeout(t);
    }
  }, [status, mounted]);

  function openJob(jobId: string) {
    setSelectedJobId(jobId);
    setCandidateView('job-detail');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // ─── Loading state ───
  // Rendered on the server AND during the first client render (before mount),
  // so server HTML and client HTML match. Once mounted, we transition to the
  // real session-aware UI.
  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // ─── Authenticated ───
  if (session) {
    const isAdmin = session.user.role === 'ADMIN';

    return (
      <div className="min-h-screen flex flex-col bg-background">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm sm:text-base">JobMatch Kenya</span>
              {isAdmin && <Badge variant="secondary" className="text-[10px]">Admin</Badge>}
            </div>

            <div className="flex items-center gap-1.5">
              <ThemeToggle />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {session.user.name?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <span className="hidden sm:inline text-sm">{session.user.name?.split(' ')[0]}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{session.user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{session.user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {isAdmin ? (
                    <>
                      <DropdownMenuItem onClick={() => setAdminView('jobs')} className="gap-2 cursor-pointer">
                        <LayoutDashboard className="h-4 w-4" />
                        Manage Jobs
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAdminView('create')} className="gap-2 cursor-pointer">
                        <Briefcase className="h-4 w-4" />
                        Create Job
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem
                        onClick={() => { setCandidateView('matches'); setSelectedJobId(null); }}
                        className="gap-2 cursor-pointer"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        My Matches
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setCvUploadOpen(true)} className="gap-2 cursor-pointer">
                        <Upload className="h-4 w-4" />
                        Upload / Update CV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setCandidateView('profile')} className="gap-2 cursor-pointer">
                        <Shield className="h-4 w-4" />
                        Profile & Privacy
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 sm:py-8">
          {isAdmin ? (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Create and manage job postings. Matches are computed automatically when jobs are posted.
                </p>
              </div>
              {adminView === 'jobs' ? <AdminJobsList /> : <AdminJobForm />}
              {adminView === 'jobs' && (
                <Button variant="outline" onClick={() => setAdminView('create')} className="gap-2">
                  <Briefcase className="h-4 w-4" />
                  Create a new job
                </Button>
              )}
              {adminView === 'create' && (
                <Button variant="outline" onClick={() => setAdminView('jobs')} className="gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Back to jobs list
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {candidateView === 'matches' && 'Your Job Matches'}
                  {candidateView === 'job-detail' && 'Job Details'}
                  {candidateView === 'profile' && 'Profile & Privacy'}
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  {candidateView === 'matches' && 'Jobs ranked by how well they fit your selected career trajectories.'}
                  {candidateView === 'job-detail' && 'Review the details and decide if this role is right for you.'}
                  {candidateView === 'profile' && 'Manage your data, consents, and account.'}
                </p>
              </div>

              {candidateView === 'matches' && (
                <>
                  <Card className="bg-gradient-to-br from-primary/5 via-primary/5 to-transparent border-primary/20">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Upload className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Update your CV</p>
                          <p className="text-xs text-muted-foreground">Get better matches by keeping your CV current.</p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => setCvUploadOpen(true)}>Upload</Button>
                    </CardContent>
                  </Card>

                  <MatchesList onOpenJob={openJob} />
                </>
              )}

              {candidateView === 'job-detail' && selectedJobId && (
                <JobDetailPanel
                  jobId={selectedJobId}
                  onBack={() => { setCandidateView('matches'); setSelectedJobId(null); }}
                />
              )}

              {candidateView === 'profile' && <ProfilePanel />}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t mt-auto">
          <div className="max-w-6xl mx-auto px-4 py-4 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>© 2026 JobMatch Kenya · Built for Kenyan job seekers</p>
            <p className="flex items-center gap-1.5">
              <Shield className="h-3 w-3" />
              Kenya DPA 2019 Compliant
            </p>
          </div>
        </footer>

        {/* Modals */}
        <CvUploadModal
          open={cvUploadOpen}
          onOpenChange={setCvUploadOpen}
          onViewMatches={() => { setCandidateView('matches'); setSelectedJobId(null); }}
        />
      </div>
    );
  }

  // ─── Landing page (unauthenticated) ───
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm sm:text-base">JobMatch Kenya</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button size="sm" variant="ghost" onClick={() => setAuthOpen(true)}>Sign In</Button>
            <Button size="sm" onClick={() => setAuthOpen(true)}>Get Started</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="relative max-w-6xl mx-auto px-4 py-16 sm:py-24 text-center">
            <Badge variant="secondary" className="mb-4 gap-1.5">
              <Sparkles className="h-3 w-3" />
              Built for the Kenyan job market
            </Badge>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight max-w-3xl mx-auto leading-tight">
              Find work that fits <span className="text-primary">your story</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Upload your CV once. We group your experience into career trajectories and match you to jobs — without ever disqualifying you for missing a checkbox.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-2 justify-center">
              <Button size="lg" onClick={() => setAuthOpen(true)} className="gap-2 h-12 px-6">
                <Sparkles className="h-4 w-4" />
                Get Started — It's Free
              </Button>
              <Button size="lg" variant="outline" onClick={() => setAuthOpen(true)} className="h-12 px-6">
                Sign In
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              No credit card required · Your data is protected under Kenya's Data Protection Act
            </p>
          </div>
        </section>

        {/* Feature cards */}
        <section className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <FeatureCard
              icon={<Heart className="h-6 w-6" />}
              title="Never Disqualified"
              description="We rank jobs by fit — we never hide them because you missed a checkbox. You decide which opportunities are right for you."
            />
            <FeatureCard
              icon={<Target className="h-6 w-6" />}
              title="3 Career Trajectories"
              description="Got experience across multiple fields? Pick up to 3 career paths and we'll match jobs to each one separately."
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="Instant Matching"
              description="Once your CV is processed, new jobs are matched to you automatically. No refreshing, no spamming apply."
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="You Own Your Data"
              description="Export or delete your data anytime. Soft-delete with 30-day grace period. Full Kenya DPA 2019 compliance."
            />
            <FeatureCard
              icon={<Lock className="h-6 w-6" />}
              title="Transparent Scoring"
              description="Every match shows why it ranked where it did — see your score broken down by title, skills, education, and experience."
            />
            <FeatureCard
              icon={<Briefcase className="h-6 w-6" />}
              title="Real Kenyan Jobs"
              description="From Nairobi tech startups to Mombasa hospitality — we focus on roles that actually exist in the Kenyan market."
            />
          </div>
        </section>

        {/* How it works */}
        <section className="bg-muted/30 border-y">
          <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2">How it works</h2>
            <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">
              Three simple steps to start getting matched jobs
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Step
                num={1}
                title="Create your account"
                description="Sign up with your email. We record your consent — you're in control of your data from day one."
              />
              <Step
                num={2}
                title="Upload your CV"
                description="Paste your CV text. Our AI extracts your experience, skills, and education, then groups them into trajectories."
              />
              <Step
                num={3}
                title="Get matched jobs"
                description="We rank jobs by fit and show you why each one matched. You decide which to apply to."
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-6xl mx-auto px-4 py-16 sm:py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to find your next role?</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Join JobMatch Kenya today. It's free to start.
          </p>
          <Button size="lg" onClick={() => setAuthOpen(true)} className="h-12 px-8 gap-2">
            <Sparkles className="h-4 w-4" />
            Create Your Free Account
          </Button>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© 2026 JobMatch Kenya · Built for Kenyan job seekers</p>
          <p className="flex items-center gap-1.5">
            <Shield className="h-3 w-3" />
            Kenya DPA 2019 Compliant
          </p>
        </div>
      </footer>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="h-full">
      <CardContent className="p-5 space-y-2">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
        <h3 className="font-semibold text-base">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

function Step({ num, title, description }: { num: number; title: string; description: string }) {
  return (
    <div className="text-center space-y-2">
      <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground font-bold text-lg mx-auto flex items-center justify-center">
        {num}
      </div>
      <h3 className="font-semibold text-base">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{description}</p>
    </div>
  );
}
