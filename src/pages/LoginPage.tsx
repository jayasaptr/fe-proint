import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Lock, User } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DHImg from "../assets/dh.png";
import HeroImg from "../assets/job.jpg";
import api from "../lib/axios";

const slides = [
  {
    tag: "TRANSFORMATIONAL EXPERIENCE",
    quote: "Belajar bukan hanya teori, tapi menciptakan solusi. Bergabunglah dalam ekosistem pemimpin masa depan.",
    title: "Learning Management",
    subtitle: "Seamless Experience",
  },
  {
    tag: "CAREER DEVELOPMENT",
    quote: "We are looking for individuals who are not just searching for a job, but a career to build together internally.",
    title: "Human Resources",
    subtitle: "Darma Henwa",
  }
];

const LoginPage: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/admin");
    }

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login", { username, password });

      const { token, user } = response.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      if (user?.must_change_password) {
        navigate("/change-password?forced=true");
      } else {
        navigate("/admin");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2 bg-slate-50">
      {/* Left side - Login Form */}
      <div className="flex flex-col justify-center items-center p-8 lg:p-24 relative z-10 w-full max-w-[600px] mx-auto">

        <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
          {/* Header */}
          <div className="space-y-2 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-6">
              <div className="bg-white rounded-xl shadow-sm p-1 flex items-center justify-center w-12 h-12 overflow-hidden border border-slate-100">
                <img src={DHImg} alt="DH Logo" className="w-full h-full object-contain" />
              </div>
              <span className="font-bold text-2xl tracking-tight text-slate-900">Darma Henwa</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Welcome back
            </h1>
            <p className="text-muted-foreground text-slate-500">
              Enter your credentials to access the admin dashboard.
            </p>
          </div>

          {/* Form */}
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 rounded-xl border border-red-100">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-900">NIK</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="NIK"
                    type="text"
                    autoCapitalize="none"
                    autoComplete="username"
                    autoCorrect="off"
                    className="pl-10 h-12 rounded-xl bg-white text-slate-900 border-slate-200 focus-visible:ring-primary focus-visible:ring-opacity-50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-900">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-sm font-medium text-primary hover:underline hover:text-primary/90"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
                  <Input
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="••••••••"
                    className="pl-10 h-12 rounded-xl bg-white text-slate-900 border-slate-200 focus-visible:ring-primary focus-visible:ring-opacity-50"
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-md mt-4"
            >
              {loading ? "Signing in..." : "Sign In"}
              {!loading && <ArrowRight className="ml-2 size-4" />}
            </Button>
          </form>

        </div>
      </div>

      {/* Right side - Image/Decoration */}
      <div className="hidden lg:block relative bg-slate-900 border-l border-slate-200 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/60 to-slate-900/40 z-10" />
        <img
          src={HeroImg}
          alt="Office"
          className="absolute inset-0 h-full w-full object-cover opacity-50"
        />
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-12 text-center text-white">
          <div
            key={currentSlide}
            className="space-y-8 max-w-3xl animate-in fade-in zoom-in-95 duration-700 fill-mode-both"
          >
            <div className="inline-block border border-orange-500 rounded-full px-6 py-2 text-orange-500 text-sm font-semibold tracking-widest uppercase bg-transparent">
              {slides[currentSlide].tag}
            </div>

            <p className="text-2xl md:text-[28px] font-medium leading-relaxed font-sans text-slate-100">
              "{slides[currentSlide].quote}"
            </p>

            <div className="space-y-1">
              <h3 className="text-2xl md:text-3xl font-bold text-white">
                {slides[currentSlide].title}
              </h3>
              <p className="text-orange-500 font-medium text-lg">
                {slides[currentSlide].subtitle}
              </p>
            </div>
          </div>

          {/* Slider Indicators */}
          <div className="absolute bottom-12 flex gap-3">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all duration-500 ${
                  index === currentSlide ? "bg-orange-500 w-8" : "bg-white/40 hover:bg-white/60 w-2"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
