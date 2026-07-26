'use client';

import { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Upload, FileText, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface CvUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CvUploadModal({ open, onOpenChange }: CvUploadModalProps) {
  const queryClient = useQueryClient();
  const [pasteText, setPasteText] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleUpload() {
    if (pasteText.trim().length < 50) {
      toast.error('Please paste at least 50 characters of your CV');
      return;
    }
    if (!consent) {
      toast.error('Please consent to CV processing');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/cv/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: pasteText, consent: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Upload failed');
        return;
      }
      toast.success('CV uploaded! We\'ll process it shortly.');
      onOpenChange(false);
      setPasteText('');
      setConsent(false);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Upload your CV
          </DialogTitle>
          <DialogDescription>
            Paste your CV text below. We'll extract your work experience, skills, and education, then group them into career trajectories. You can review and edit everything before we match you to jobs.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="paste">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paste" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Paste Text
            </TabsTrigger>
            <TabsTrigger value="file" disabled className="gap-1.5 opacity-50">
              <Upload className="h-3.5 w-3.5" />
              Upload File (Soon)
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
          </TabsContent>

          <TabsContent value="file" className="mt-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                File upload will be available in Phase 2.
                For now, please copy-paste your CV text.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleUpload} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Upload CV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
