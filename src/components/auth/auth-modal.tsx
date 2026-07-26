'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Mail, Lock, User, Phone, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>(
    searchParams.get('auth') === 'signin' ? 'signin' : 'signup',
  );

  // Sign-in fields
  const [signinEmail, setSigninEmail] = useState('');
  const [signinPassword, setSigninPassword] = useState('');

  // Sign-up fields
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupCounty, setSignupCounty] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [dataProcessing, setDataProcessing] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!signinEmail || !signinPassword) {
      toast.error('Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      const result = await signIn('credentials', {
        email: signinEmail,
        password: signinPassword,
        redirect: false,
      });
      if (result?.error) {
        toast.error('Invalid email or password');
      } else {
        toast.success('Signed in successfully');
        onOpenChange(false);
        router.refresh();
      }
    } catch (err) {
      toast.error('Sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!signupName || !signupEmail || !signupPassword) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (signupPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!termsAccepted || !dataProcessing) {
      toast.error('Please accept the terms and data processing consent');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signupEmail,
          password: signupPassword,
          fullName: signupName,
          phone: signupPhone || undefined,
          county: signupCounty || undefined,
          consent: {
            dataProcessing,
            marketing,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Registration failed');
        return;
      }
      toast.success('Account created! Please sign in.');
      // Auto-switch to sign-in tab with email pre-filled
      setMode('signin');
      setSigninEmail(signupEmail);
      setSigninPassword(signupPassword);
    } catch (err) {
      toast.error('Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'signin'
              ? 'Sign in to see your matched jobs and manage your profile.'
              : 'Join JobMatch Kenya to find work that fits your story.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'signin' | 'signup')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          {/* ─── Sign In ─── */}
          <TabsContent value="signin" className="space-y-4 mt-4">
            <form onSubmit={handleSignIn} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="signin-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    className="pl-9"
                    value={signinEmail}
                    onChange={(e) => setSigninEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signin-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-9"
                    value={signinPassword}
                    onChange={(e) => setSigninPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Demo accounts:</p>
              <p>Candidate: <code className="font-mono">candidate@demo.com</code> / <code className="font-mono">password123</code></p>
              <p>Admin: <code className="font-mono">admin@demo.com</code> / <code className="font-mono">password123</code></p>
            </div>
          </TabsContent>

          {/* ─── Sign Up ─── */}
          <TabsContent value="signup" className="space-y-3 mt-4">
            <form onSubmit={handleSignUp} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="signup-name">Full Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-name"
                    placeholder="Wanjiru Kamau"
                    className="pl-9"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-email">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    className="pl-9"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-phone">Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-phone"
                      placeholder="+254 712 345 678"
                      className="pl-9"
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-county">County</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-county"
                      placeholder="Nairobi"
                      className="pl-9"
                      value={signupCounty}
                      onChange={(e) => setSignupCounty(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-password">Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="At least 8 characters"
                    className="pl-9"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms-data"
                    checked={dataProcessing}
                    onCheckedChange={(v) => setDataProcessing(v === true)}
                  />
                  <Label htmlFor="terms-data" className="text-xs leading-relaxed font-normal cursor-pointer">
                    I consent to JobMatch processing my CV data to find job matches for me. (Required)
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms-marketing"
                    checked={marketing}
                    onCheckedChange={(v) => setMarketing(v === true)}
                  />
                  <Label htmlFor="terms-marketing" className="text-xs leading-relaxed font-normal cursor-pointer">
                    Send me emails about new features and career resources. (Optional)
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms-accept"
                    checked={termsAccepted}
                    onCheckedChange={(v) => setTermsAccepted(v === true)}
                  />
                  <Label htmlFor="terms-accept" className="text-xs leading-relaxed font-normal cursor-pointer">
                    I agree to the Terms of Service and Privacy Policy. (Required)
                  </Label>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
