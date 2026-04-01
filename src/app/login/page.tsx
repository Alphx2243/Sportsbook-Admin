'use client';
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import ErrorModal from "@/components/ui/ErrorModal";

export default function AuthPage() {
  const { showToast } = useToast();
  const { login, user, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [mounted, setMounted] = useState(false);
  const [errorModal, setErrorModal] = useState({ isOpen: false, title: "", message: "" });
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user !== null && user.role === 'Admin') {
      router.push("/admin");
    }
  }, [user, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { email, password } = formData;

      if (!email.endsWith("@iiitd.ac.in")) {
        setErrorModal({
          isOpen: true,
          title: "IIITD Email Required",
          message: "Access restricted to IIIT Delhi members only. Please use your official @iiitd.ac.in email address to continue."
        });
        return;
      }

      if (!email || !password) {
        showToast({ message: 'Enter all details', type: 'warning' });
        return;
      }

      const res = await login(email, password);
      if (!res.success) {
        throw new Error(res.error);
      }

      showToast({
        message: 'Login Successful',
        type: 'success',
      });

      router.push('/admin');
    }
    catch (err: any) {
      console.error("Login failed:", err);
      showToast({ message: err.message || 'Invalid Email/Password', type: 'error' });
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden pt-16">
      {}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border-white/10 shadow-2xl bg-card/20 backdrop-blur-xl">
          <CardHeader className="text-center pb-8 border-b border-border/50">
            <CardTitle className="text-3xl font-black text-gradient-premium tracking-tighter">
              Admin Portal
            </CardTitle>
            <p className="text-muted-foreground mt-2 font-medium">
              SportsBook Management & Control
            </p>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground ml-1 uppercase tracking-widest flex items-center gap-2">
                  Email Address
                </label>
                <Input
                  type="email"
                  name="email"
                  placeholder="admin@iiitd.ac.in"
                  value={formData.email}
                  onChange={handleChange}
                  className="bg-background/50 border-white/5 focus:border-primary/50 transition-all"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => router.push("/forgot-password")}
                    className="text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    className="bg-background/50 border-white/5 focus:border-primary/50 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full py-7 text-lg font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all border-none"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Authenticating</span>
                  </div>
                ) : (
                  "Enter Portal"
                )}
              </Button>
            </form>

            <div className="mt-8 pt-8 border-t border-border/50 text-center">
              <p className="text-xs text-muted-foreground/60 font-medium leading-relaxed">
                Protected administrative access only.<br />
                Unauthorized access attempts are logged.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <AnimatePresence>
        {errorModal.isOpen && (
          <ErrorModal
            isOpen={errorModal.isOpen}
            onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
            title={errorModal.title}
            message={errorModal.message}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
