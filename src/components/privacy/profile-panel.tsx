'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import {
  User, Phone, MapPin, GraduationCap, Briefcase, Shield,
  Download, Trash2, Loader2, FileText, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { ProfileResponse, FUNCTION_LABELS, EDUCATION_LABELS } from '@/lib/types';
import { toast } from 'sonner';

export function ProfilePanel() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<ProfileResponse>({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await fetch('/api/cv/profile');
      if (!res.ok) throw new Error('Failed to load profile');
      return res.json();
    },
  });

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/privacy/export');
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-data-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Your data has been exported');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (deleteConfirm !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch('/api/privacy/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: deleteConfirm }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Deletion failed');
      }
      toast.success('Account scheduled for deletion. You have 30 days to change your mind.');
      // Sign out and reload
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  const selectedClusters = data.clusters.filter((c) => c.isSelected);

  return (
    <div className="space-y-4">
      {/* ─── Personal Info ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow icon={<User className="h-4 w-4" />} label="Full Name" value={data.profile.fullName} />
          <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={data.profile.phone ?? 'Not provided'} />
          <InfoRow icon={<MapPin className="h-4 w-4" />} label="County" value={data.profile.county ?? 'Not provided'} />
          <Separator />
          <InfoRow
            icon={<Shield className="h-4 w-4" />}
            label="Consent Version"
            value={`${data.profile.consentVersion} (granted ${data.profile.consentDate ? new Date(data.profile.consentDate).toLocaleDateString('en-KE') : 'N/A'})`}
          />
        </CardContent>
      </Card>

      {/* ─── CV ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            CV Document
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.hasUploadedCv ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="font-medium">CV uploaded</span>
                <Badge variant="secondary" className="text-xs">
                  {data.rawCvText?.length ?? 0} characters
                </Badge>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  View raw CV text
                </summary>
                <pre className="mt-2 p-3 bg-muted rounded-md max-h-64 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                  {data.rawCvText}
                </pre>
              </details>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              No CV uploaded yet. Upload one to start matching.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Education ─── */}
      {data.education.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Education
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.education.map((edu) => (
              <div key={edu.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{EDUCATION_LABELS[edu.level]}</p>
                  <p className="text-muted-foreground text-xs">{edu.field}</p>
                  {edu.institution && (
                    <p className="text-muted-foreground text-xs">{edu.institution}</p>
                  )}
                </div>
                {edu.graduationYear && (
                  <Badge variant="outline" className="text-xs">{edu.graduationYear}</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ─── Career Trajectories ─── */}
      {data.clusters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Career Trajectories
              <Badge variant="secondary" className="ml-auto text-xs">
                {selectedClusters.length}/3 selected
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.clusters.map((cluster) => (
              <div
                key={cluster.id}
                className={`p-3 rounded-lg border ${cluster.isSelected ? 'border-primary/30 bg-primary/5' : 'border-border opacity-70'}`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-medium text-sm">{FUNCTION_LABELS[cluster.function]}</span>
                  {cluster.isSelected ? (
                    <Badge className="text-xs">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Not selected</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {cluster.yearsExperience} year{cluster.yearsExperience === 1 ? '' : 's'} experience
                </div>
                <div className="flex flex-wrap gap-1">
                  {cluster.jobTitles.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px] font-normal">{t}</Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {cluster.skills.slice(0, 8).map((s) => (
                    <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
                  ))}
                  {cluster.skills.length > 8 && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      +{cluster.skills.length - 8} more
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ─── Privacy Controls ─── */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Your Data, Your Rights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Under the Kenya Data Protection Act (2019), you have the right to access and erase your personal data. Use the controls below to manage your data.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
              className="gap-2"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export My Data
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete My Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <span className="block">
                      This will deactivate your account immediately. Your data will be permanently purged after a 30-day grace period. During this time, you can contact support to cancel the deletion.
                    </span>
                    <span className="block">
                      To confirm, type <strong className="font-mono">DELETE</strong> below:
                    </span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  placeholder="Type DELETE"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="font-mono"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteConfirm('')}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting || deleteConfirm !== 'DELETE'}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <div className="flex-1">
        <span className="text-muted-foreground text-xs uppercase tracking-wide block">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
    </div>
  );
}
