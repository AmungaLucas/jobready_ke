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
  Loader2, Upload, FileText, Sparkles, CheckCircle2, AlertCircle,
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
}

export function CvUploadModal({ open, onOpenChange }: CvUploadModalProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'paste' | 'file'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileText, setFileText] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractionSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setPasteText('');
    setFileName('');
    setFileText('');
    setConsent(false);
    setResult(null);
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setFileText('');
    setResult(null);
    try {
      // Read file as text. PDF/DOCX parsing would need server-side extraction;
      // for now we accept .txt, .md, and try to read any text-like file.
      if (file.type.startsWith('text/') || file.name.match(/\.(txt|md|csv|rtf)$/i)) {
        const text = await file.text();
        setFileText(text);
      } else {
        // For binary formats (PDF, DOCX), we read as text and let the LLM
        // deal with the noise. A proper implementation would use pdf-parse
        // or mammoth on the server side.
        const text = await file.text();
        if (text && text.length > 50) {
          setFileText(text);
          toast.info('Binary file detected — extracted raw text. For best results, paste as plain text.');
        } else {
          toast.error('Could not extract text from this file. Please paste your CV manually.');
          setFileName('');
        }
      }
    } catch (err) {
      toast.error('Failed to read file');
      setFileName('');
    }
  }

  async function handleUpload() {
    const rawText = mode === 'paste' ? pasteText : fileText;
    if (rawText.trim().length < 50) {
      toast.error('Please provide at least 50 characters of your CV');
      return;
    }
    if (!consent) {
      toast.error('Please consent to CV processing');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/cv/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText, consent: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Upload failed');
        return;
      }
      setResult(data.extracted);
      toast.success(
        `CV processed! ${data.extracted.clusterCount} career trajectories found, ${data.matches.created} matches computed.`,
      );
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      // Don't auto-close — show the extraction summary first
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setLoading(false);
    }
  }

  function handleClose(open: boolean) {
    if (!open && result) {
      // If we have a result, reset state on close
      reset();
    }
    onOpenChange(open);
  }

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
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handleFile(file);
                  }}
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">
                    {fileName || 'Click to browse or drag a file here'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports .txt, .md, .csv, .rtf · Max 5MB
                  </p>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.csv,.rtf,text/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                  />
                </div>
                {fileText && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{fileText.length} characters extracted</span>
                      <Button variant="ghost" size="sm" onClick={() => { setFileName(''); setFileText(''); }}>
                        Clear
                      </Button>
                    </div>
                    <Textarea
                      readOnly
                      value={fileText.slice(0, 500) + (fileText.length > 500 ? '...' : '')}
                      className="min-h-[100px] font-mono text-xs"
                    />
                  </div>
                )}
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
              <Button onClick={handleUpload} disabled={loading || (mode === 'paste' ? pasteText.length < 50 : fileText.length < 50) || !consent}>
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
