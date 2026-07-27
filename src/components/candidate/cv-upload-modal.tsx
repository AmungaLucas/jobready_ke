'use client';

import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, Upload, FileText, Sparkles, CheckCircle2, AlertCircle, File, X,
} from 'lucide-react';
import { toast } from 'sonner';

interface CvUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExtractionSummary {
  clusterCount: number;
  educationCount: number;
  skillsCount: number;
  clusters: Array<{
    function: string;
    jobTitles: string[];
    yearsExperience: number;
  }>;
  parseInfo?: string;
}

export function CvUploadModal({ open, onOpenChange }: CvUploadModalProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'paste' | 'file'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractionSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setPasteText('');
    setSelectedFile(null);
    setConsent(false);
    setResult(null);
  }

  /** Format file size for display */
  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /** File icon based on extension */
  function getFileIcon(name: string) {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    if (['pdf'].includes(ext)) return '📄';
    if (['docx', 'doc'].includes(ext)) return '📝';
    if (['pptx', 'ppt'].includes(ext)) return '📊';
    if (['xlsx', 'xls'].includes(ext)) return '📈';
    if (['md', 'markdown'].includes(ext)) return '📋';
    if (['json'].includes(ext)) return '{}';
    if (['html', 'htm'].includes(ext)) return '🌐';
    return '📄';
  }

  function handleFileSelect(file: File) {
    // Validate extension client-side for immediate feedback
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const allowed = new Set(['pdf', 'docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls', 'txt', 'text', 'md', 'markdown', 'json', 'csv', 'rtf', 'html', 'htm']);
    if (!allowed.has(ext)) {
      toast.error(`Unsupported format: .${ext}. Supported: PDF, DOCX, DOC, PPTX, XLSX, TXT, MD, JSON, CSV, RTF, HTML.`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10 MB.');
      return;
    }
    setSelectedFile(file);
    setResult(null);
  }

  async function handleUpload() {
    if (!consent) {
      toast.error('Please consent to CV processing');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      let res: Response;

      if (mode === 'file' && selectedFile) {
        // ── File upload: send as FormData, server parses ──
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('consent', 'true');
        res = await fetch('/api/cv/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
          // Do NOT set Content-Type — browser sets multipart boundary automatically
        });
      } else {
        // ── Text paste: send as JSON ──
        const rawText = pasteText;
        if (rawText.trim().length < 50) {
          toast.error('Please provide at least 50 characters of your CV');
          setLoading(false);
          return;
        }
        res = await fetch('/api/cv/upload', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawText, consent: true }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Upload failed');
        return;
      }
      setResult(data.extracted);
      if (data.parseInfo) {
        toast.success(`${data.parseInfo}`);
      }
      toast.success(
        `CV processed! ${data.extracted.clusterCount} career trajectories found, ${data.matches.created} matches computed.`,
      );
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      console.error('CV upload error:', err);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleClose(open: boolean) {
    if (!open && result) {
      reset();
    }
    onOpenChange(open);
  }

  const canSubmit =
    !loading &&
    consent &&
    (mode === 'paste' ? pasteText.trim().length >= 50 : !!selectedFile);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Upload your CV
          </DialogTitle>
          <DialogDescription>
            Paste your CV text or upload a file. Our AI extracts your work experience, skills, and education, then groups them into career trajectories.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          // ─── Extraction summary view ──────────────────────────────────
          <div className="space-y-4">
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <p className="font-medium">CV processed successfully</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-2xl font-bold">{result.clusterCount}</p>
                    <p className="text-xs text-muted-foreground">trajectories</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{result.educationCount}</p>
                    <p className="text-xs text-muted-foreground">qualifications</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{result.skillsCount}</p>
                    <p className="text-xs text-muted-foreground">skills</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <p className="text-sm font-medium">Your career trajectories:</p>
              {result.clusters.map((c, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="capitalize">{c.function.replace('_', ' ')}</Badge>
                    <span className="text-xs text-muted-foreground">{c.yearsExperience} yrs exp</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {c.jobTitles.map((t) => (
                      <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              All trajectories are selected by default. You can deselect any in your Profile & Privacy panel if you want to focus on specific paths.
            </p>
          </div>
        ) : (
          // ─── Input view ────────────────────────────────────────────────
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'paste' | 'file')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="paste" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Paste Text
              </TabsTrigger>
              <TabsTrigger value="file" className="gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                Upload File
              </TabsTrigger>
            </TabsList>

            <TabsContent value="paste" className="space-y-3 mt-4">
              <div className="space-y-1.5">
                <Label htmlFor="cv-text">Your CV text</Label>
                <Textarea
                  id="cv-text"
                  placeholder="Paste your CV here. Include your work experience, education, skills, and any certifications..."
                  className="min-h-[280px] font-mono text-xs leading-relaxed"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {pasteText.length} characters · minimum 50 required
                </p>
              </div>
            </TabsContent>

            <TabsContent value="file" className="space-y-3 mt-4">
              <div className="space-y-1.5">
                <Label>Upload your CV file</Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    selectedFile
                      ? 'border-primary/50 bg-primary/5'
                      : 'hover:border-primary/50 hover:bg-muted/30'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handleFileSelect(file);
                  }}
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <File className="h-8 w-8 text-primary" />
                      <div className="text-left">
                        <p className="text-sm font-medium">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatSize(selectedFile.size)} · {selectedFile.type || 'unknown type'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">
                        Click to browse or drag a file here
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PDF, DOCX, DOC, TXT, MD, JSON · Max 10 MB
                      </p>
                    </>
                  )}
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.txt,.text,.md,.markdown,.json,.csv,.rtf,.html,.htm"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                      // Reset so the same file can be re-selected
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Consent checkbox (always visible until result) */}
        {!result && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50">
            <Checkbox
              id="cv-consent"
              checked={consent}
              onCheckedChange={(v) => setConsent(v === true)}
            />
            <Label htmlFor="cv-consent" className="text-xs leading-relaxed font-normal cursor-pointer">
              I consent to JobMatch processing my CV data using AI to extract my work experience, skills, and education. I understand this data will be used to match me to jobs and that I can delete it at any time. (Required)
            </Label>
          </div>
        )}

        <DialogFooter>
          {result ? (
            <>
              <Button variant="ghost" onClick={() => reset()}>
                Upload Another
              </Button>
              <Button onClick={() => handleClose(false)}>
                View My Matches
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => handleClose(false)}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!canSubmit}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Processing CV...' : 'Upload & Process CV'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
