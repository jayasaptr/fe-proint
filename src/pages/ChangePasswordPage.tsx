import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/lib/api/users";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import DHImg from "../assets/dh.png";
import HeroImg from "../assets/job.jpg";

const ChangePasswordPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isForced =
    location.state?.forced ||
    new URLSearchParams(location.search).get("forced") === "true";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.oldPassword || !formData.newPassword) {
      setError("All fields are required");
      return;
    }

    if (formData.newPassword.length < 6) {
      setError("New password must be at least 6 characters long");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (formData.oldPassword === formData.newPassword) {
      setError("New password must be different from old password");
      return;
    }

    setLoading(true);
    try {
      const response = await changePassword({
        old_password: formData.oldPassword,
        new_password: formData.newPassword,
      });

      if (response.success) {
        setSuccess(response.message || "Password changed successfully!");
        setFormData({ oldPassword: "", newPassword: "", confirmPassword: "" });

        const userString = localStorage.getItem("user");
        if (userString) {
          const user = JSON.parse(userString);
          user.must_change_password = false;
          localStorage.setItem("user", JSON.stringify(user));
        }

        setTimeout(() => {
          if (isForced) {
            navigate("/admin");
          } else {
            navigate("/admin");
          }
        }, 1500);
      }
    } catch (err: any) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("Network error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2 bg-slate-50">
      {/* Left side - Image/Decoration (Swapped from login page design) */}
      <div className="hidden lg:block relative bg-slate-900 border-r border-slate-200 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/60 to-slate-900/40 z-10" />
        <img
          src={HeroImg}
          alt="Office"
          className="absolute inset-0 h-full w-full object-cover opacity-50"
        />
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-12 text-center text-white">
          <div className="space-y-8 max-w-3xl">
            <div className="inline-block border border-orange-500 rounded-full px-6 py-2 text-orange-500 text-sm font-semibold tracking-widest uppercase bg-transparent">
              Security Update
            </div>
            <p className="text-2xl md:text-[28px] font-medium leading-relaxed font-sans text-slate-100">
              "Keeping your account secure with a strong and unique password."
            </p>
            <div className="space-y-1">
              <h3 className="text-2xl md:text-3xl font-bold text-white">
                Darma Henwa
              </h3>
              <p className="text-orange-500 font-medium text-lg">
                Internal Systems
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex flex-col justify-center items-center p-8 lg:p-24 relative z-10 w-full max-w-[600px] mx-auto">
        <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
          {/* Header */}
          <div className="space-y-2 text-center lg:text-left">
            {!isForced && (
              <Link to="/admin" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-6 group">
                <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Back to Dashboard
              </Link>
            )}
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-6">
              <div className="bg-white rounded-xl shadow-sm p-1 flex items-center justify-center w-12 h-12 overflow-hidden border border-slate-100">
                <img src={DHImg} alt="DH" className="w-full h-full object-contain" />
              </div>
              <span className="font-bold text-2xl tracking-tight text-slate-900">
                Change Password
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {isForced ? "Action Required" : "Update Security"}
            </h1>
            <p className="text-muted-foreground text-slate-500">
              {isForced
                ? "You are using the default password. Please change your password to continue."
                : "Ensure your new password differs from the old one and is highly secure."}
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="p-4 text-sm font-medium text-red-600 bg-red-50 rounded-xl border border-red-100 flex items-start">
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-4 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start">
              <span>{success}</span>
            </div>
          )}

          {/* Form */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="oldPassword" className="text-slate-900">
                  Old Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
                  <Input
                    id="oldPassword"
                    name="oldPassword"
                    type="password"
                    value={formData.oldPassword}
                    onChange={handleChange}
                    placeholder={
                      isForced ? "Default password" : "••••••••"
                    }
                    className="pl-10 h-12 rounded-xl bg-white text-slate-900 border-slate-200 focus-visible:ring-primary focus-visible:ring-opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-slate-900">
                  New Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    value={formData.newPassword}
                    onChange={handleChange}
                    placeholder="Min. 6 characters"
                    className="pl-10 h-12 rounded-xl bg-white text-slate-900 border-slate-200 focus-visible:ring-primary focus-visible:ring-opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-900">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Repeat new password"
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
              {loading ? "Updating..." : "Update Password"}
              {!loading && <ArrowRight className="ml-2 size-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
