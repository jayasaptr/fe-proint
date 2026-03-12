import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  downloadDocument,
  getApplicationById,
  updateApplicationStatus,
  type Application,
} from "@/lib/api/applications";
import {
  ArrowLeft,
  Briefcase,
  Building,
  Calendar,
  CheckCircle,
  ChevronDown,
  Download,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Target,
  User,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [application, setApplication] = useState<Application | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchApplication = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await getApplicationById(id);
      if (res.success) {
        setApplication(res.data);
      } else {
        toast.error("Failed to load application details.");
        navigate("/admin/applications");
      }
    } catch {
      toast.error("Failed to fetch application details.");
      navigate("/admin/applications");
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!application) return;
    setIsUpdatingStatus(true);
    try {
      const res = await updateApplicationStatus(application.id, newStatus);
      if (res.success) {
        toast.success(`Application status updated to ${newStatus}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setApplication((prev) =>
          prev ? { ...prev, status: newStatus as any } : null,
        );
      } else {
        toast.error(res.message || "Failed to update status");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDownloadDocument = async (
    docId: number,
    filename: string,
    filePath?: string,
  ) => {
    if (!application) return;

    if (filePath) {
      window.open(filePath, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      toast.info(`Attempting to download ${filename}...`);
      const blob = await downloadDocument(application.id, docId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`${filename} downloaded successfully`);
    } catch (error) {
      console.error("Download error:", error);
      toast.error(`Failed to download ${filename}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "New":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
      case "Review":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800";
      case "Rejected":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
      case "Hired":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700";
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-slate-400 dark:border-t-slate-400 animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading details...</p>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <XCircle className="w-12 h-12 text-red-400 dark:text-red-500" />
        <p className="text-lg font-medium text-slate-900 dark:text-slate-100">
          Application not found
        </p>
        <Button
          variant="outline"
          onClick={() => navigate("/admin/applications")}
          className="dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-300"
        >
          Back to Applications
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto  pb-16 space-y-8 animate-in fade-in duration-500 w-full pt-4 sm:pt-6">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/applications")}
            className="shrink-0 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft size={20} />
          </Button>

          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {application.full_name}
              </h1>
              <Badge
                variant="outline"
                className={`${getStatusColor(application.status)} font-medium`}
              >
                {application.status}
              </Badge>
            </div>

            <p className="text-slate-500 dark:text-slate-400 flex items-center gap-2 text-sm sm:text-base">
              Applied for{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {application.job?.title || "Unknown Job"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={isUpdatingStatus}
                className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-200"
              >
                Update Status <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 dark:bg-slate-900 dark:border-slate-700">
              <DropdownMenuItem
                onClick={() => handleStatusUpdate("New")}
                disabled={application.status === "New"}
              >
                Mark as New
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleStatusUpdate("Review")}
                disabled={application.status === "Review"}
              >
                Mark as Review
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleStatusUpdate("Hired")}
                disabled={application.status === "Hired"}
                className="text-emerald-600 focus:text-emerald-600 dark:text-emerald-500 dark:focus:text-emerald-400 dark:focus:bg-slate-800"
              >
                <CheckCircle className="mr-2 h-4 w-4" /> Mark as Hired
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleStatusUpdate("Rejected")}
                disabled={application.status === "Rejected"}
                className="text-red-600 focus:text-red-600 dark:text-red-500 dark:focus:text-red-400 dark:focus:bg-slate-800"
              >
                <XCircle className="mr-2 h-4 w-4" /> Mark as Rejected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Profile Overview Card */}
      <Card className="overflow-hidden border-slate-200/60 dark:border-slate-700/60 shadow-sm rounded-xl bg-white dark:bg-slate-900">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row items-center sm:items-stretch">
            {/* Avatar Section */}
            <div className="w-full sm:w-1/3 bg-slate-50/50 dark:bg-slate-800/30 p-6 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-slate-100 dark:border-slate-800">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 mb-4 flex-shrink-0">
                {application.photo_path || application.photo_url ? (
                  <img
                    src={application.photo_path || application.photo_url}
                    alt={application.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
                    <User size={40} />
                  </div>
                )}
              </div>
              <p className="text-xs font-mono text-slate-400 dark:text-slate-500">
                ID: {application.id}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Submitted:{" "}
                {new Date(application.created_at).toLocaleDateString()}
              </p>
            </div>

            {/* Quick Contacts */}
            <div className="w-full sm:w-2/3 p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8 h-full bg-white dark:bg-transparent content-center">
              <ContactItem
                icon={<Mail size={18} />}
                label="Email Address"
                value={application.email}
              />
              <ContactItem
                icon={<Phone size={18} />}
                label="Phone Number"
                value={application.mobile_phone}
              />
              <ContactItem
                icon={<MapPin size={18} />}
                label="Location"
                value={`${application.city}, ${application.province}`}
              />
              <ContactItem
                icon={<Briefcase size={18} />}
                label="Expected Salary"
                value={`Rp ${(application.salary_expectation || 0).toLocaleString()}`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content (Left, 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal details */}
          <SectionLayout
            title="Personal Details"
            icon={<User className="text-slate-400" size={20} />}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              <DetailItem label="Gender" value={application.gender} />
              <DetailItem label="Blood Type" value={application.blood_type} />
              <DetailItem
                label="Marital Status"
                value={application.marital_status}
              />
              <DetailItem
                label="Birth Details"
                value={`${application.place_of_birth}, ${application.date_of_birth}`}
                className="col-span-2 sm:col-span-3"
              />
            </div>
            <hr className="my-6 border-slate-100 dark:border-slate-800" />
            <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4">Address</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <DetailItem
                label="ID Card Address"
                value={application.id_card_address}
                className="col-span-1 sm:col-span-2"
              />
              <DetailItem label="City" value={application.city} />
              <DetailItem label="Province" value={application.province} />
              <DetailItem label="Zip Code" value={application.zip_code} />
            </div>
          </SectionLayout>

          {/* Education */}
          {application.educations && application.educations.length > 0 && (
            <SectionLayout
              title="Education"
              icon={<GraduationCap className="text-slate-400" size={20} />}
            >
              <div className="space-y-6">
                {application.educations.map((edu, idx) => (
                  <div key={edu.id} className="relative">
                    {idx > 0 && <hr className="mb-6 border-slate-100 dark:border-slate-800" />}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                            {edu.institution}
                          </h4>
                          {edu.is_last_education && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 font-medium dark:bg-slate-800 dark:text-slate-300"
                            >
                              Latest
                            </Badge>
                          )}
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
                          {edu.degree} in {edu.major}
                        </p>
                      </div>
                      <div className="sm:text-right mt-1 sm:mt-0">
                        <span className="inline-block px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 text-sm font-medium border border-slate-100 dark:border-slate-800">
                          GPA: {edu.gpa}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionLayout>
          )}

          {/* Experience */}
          {application.experiences && application.experiences.length > 0 && (
            <SectionLayout
              title="Experience"
              icon={<Building className="text-slate-400" size={20} />}
            >
              <div className="space-y-6">
                {application.experiences.map((exp, idx) => (
                  <div key={exp.id}>
                    {idx > 0 && <hr className="mb-6 border-slate-100 dark:border-slate-800" />}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                          {exp.position}
                        </h4>
                        <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
                          {exp.company_name}
                        </p>
                        {exp.salary && (
                          <p className="text-slate-500 dark:text-slate-500 text-sm mt-2">
                            Salary: Rp {exp.salary.toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 sm:justify-end text-slate-500 dark:text-slate-400 text-sm font-medium bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 rounded-md border border-slate-100 dark:border-slate-800 w-fit sm:mt-0 mt-2">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{exp.job_period_year}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionLayout>
          )}

          {/* Documents */}
          {application.documents && application.documents.length > 0 && (
            <SectionLayout
              title="Attachments"
              icon={<FileText className="text-slate-400" size={20} />}
            >
              <div className="grid sm:grid-cols-2 gap-4">
                {application.documents.map((doc) => {
                  const filename =
                    doc.file_path?.split("/").pop() || `Document_${doc.id}.pdf`;
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/30 transition-colors group"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-white dark:bg-slate-800 rounded shadow-sm border border-slate-100 dark:border-slate-700 text-blue-500 dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300 shrink-0">
                          <FileText size={18} />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate">
                            {doc.description || "Document"}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {filename}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700"
                        onClick={() =>
                          handleDownloadDocument(
                            doc.id,
                            filename,
                            doc.file_path,
                          )
                        }
                        title="Download Document"
                      >
                        <Download size={16} />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </SectionLayout>
          )}
        </div>

        {/* Sidebar (Right, 1 col) */}
        <div className="space-y-6">
          <Card className="border-slate-200/60 dark:border-slate-700/60 shadow-sm rounded-xl dark:bg-slate-900">
            <CardHeader className="pb-4 border-b border-transparent dark:border-slate-800">
              <CardTitle className="text-base flex items-center gap-2 dark:text-slate-200">
                <Target className="text-slate-400 w-4 h-4" /> Application Intel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 dark:pt-4">
              <SidebarItem
                label="Current Salary"
                value={`Rp ${(application.current_salary || 0).toLocaleString()}`}
              />
              <SidebarItem
                label="Availability"
                value={application.availability || "-"}
              />

              {application.current_benefit && (
                <div className="pt-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-medium">
                    Current Benefits
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-md border border-slate-100 dark:border-slate-800">
                    {application.current_benefit}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200/60 dark:border-slate-700/60 shadow-sm rounded-xl dark:bg-slate-900">
            <CardHeader className="pb-4 border-b border-transparent dark:border-slate-800">
              <CardTitle className="text-base flex items-center gap-2 dark:text-slate-200">
                <ShieldCheck className="text-slate-400 w-4 h-4" /> Reference
                Check
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-4 dark:pt-4">
              <ReferenceItem
                question="Pernah bekerja di Darma Henwa?"
                isYes={application.has_worked_in_company}
                desc={application.worked_in_company_desc}
              />
              <ReferenceItem
                question="Punya keluarga di Darma Henwa?"
                isYes={application.has_family_in_company}
                desc={application.family_in_company_desc}
              />
              <ReferenceItem
                question="Pernah ikut recruitment sebelumnya?"
                isYes={application.has_followed_recruitment}
                desc={application.followed_recruitment_desc}
              />

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-start gap-2.5">
                <CheckCircle
                  className={`w-4 h-4 mt-0.5 shrink-0 ${application.is_declared_true ? "text-emerald-500" : "text-slate-300 dark:text-slate-600"}`}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Applicant declared that all provided info is accurate.
                </p>
              </div>
            </CardContent>
          </Card>

          {application.identities && application.identities.length > 0 && (
            <Card className="border-slate-200/60 dark:border-slate-700/60 shadow-sm rounded-xl dark:bg-slate-900">
              <CardHeader className="pb-4 border-b border-transparent dark:border-slate-800">
                <CardTitle className="text-base flex items-center gap-2 dark:text-slate-200">
                  <FileText className="text-slate-400 w-4 h-4" /> Identities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 dark:pt-4">
                {application.identities.map((id, index) => (
                  <div key={id.id}>
                    {index > 0 && <hr className="my-3 border-slate-100 dark:border-slate-800" />}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {id.identity_type}
                      </span>
                      <span className="text-sm font-mono text-slate-800 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 block w-fit">
                        {id.number}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// Subcomponents for cleaner layout

function ContactItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-slate-400 dark:text-slate-500">{icon}</div>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{value || "-"}</p>
      </div>
    </div>
  );
}

function SectionLayout({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-slate-200/60 dark:border-slate-700/60 shadow-sm rounded-xl dark:bg-slate-900">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 pb-4">
        <CardTitle className="text-lg flex items-center gap-2 dark:text-slate-200">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">{children}</CardContent>
    </Card>
  );
}

function DetailItem({
  label,
  value,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-slate-200">{value || "-"}</span>
    </div>
  );
}

function SidebarItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-slate-200">{value}</span>
    </div>
  );
}

function ReferenceItem({
  question,
  isYes,
  desc,
}: {
  question: string;
  isYes?: boolean | null;
  desc?: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-start gap-4">
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{question}</p>
        <Badge
          variant={isYes ? "default" : "secondary"}
          className={
            isYes ? "bg-slate-800 text-slate-50 dark:bg-slate-600 dark:text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          }
        >
          {isYes ? "Yes" : "No"}
        </Badge>
      </div>
      {isYes && desc && (
        <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded border border-slate-100 dark:border-slate-800 mt-1">
          {desc}
        </p>
      )}
    </div>
  );
}
