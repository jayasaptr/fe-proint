import { TablePagination } from "@/components/TablePagination";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteApplication,
  exportApplications,
  exportAttachments,
  getApplications,
  type Application,
} from "@/lib/api/applications";
import { format } from "date-fns";
import {
  Download,
  Eye,
  Loader2,
  Mail,
  Phone,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { useNavigate, useOutletContext } from "react-router-dom";
import { toast } from "sonner";
export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingAttachments, setIsExportingAttachments] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const navigate = useNavigate();
  const { currentUser } = useOutletContext<{ currentUser: any }>();
  const isHr = currentUser?.roles?.some((r: string) => r.toLowerCase() === 'hr');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (debouncedSearchTerm) {
        params.search = debouncedSearchTerm;
      }
      if (statusFilter && statusFilter !== "all") {
        params.status = statusFilter;
      }
      if (locationFilter && locationFilter !== "all") {
        params.location = locationFilter;
      }
      if (siteFilter && siteFilter !== "all") {
        params.site = siteFilter;
      }
      if (dateRange?.from) {
        params.start_date = format(dateRange.from, "yyyy-MM-dd");
      }
      if (dateRange?.to) {
        params.end_date = format(dateRange.to, "yyyy-MM-dd");
      }
      const res = await getApplications(params);
      if (res.success) {
        setApplications(res.data);
      }
    } catch (error) {
      toast.error("Failed to fetch applications.");
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearchTerm, statusFilter, locationFilter, siteFilter, dateRange]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, statusFilter, locationFilter, siteFilter, dateRange]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params: any = {};
      if (debouncedSearchTerm) {
        params.search = debouncedSearchTerm;
      }
      if (statusFilter && statusFilter !== "all") {
        params.status = statusFilter;
      }
      if (locationFilter && locationFilter !== "all") {
        params.location = locationFilter;
      }
      if (siteFilter && siteFilter !== "all") {
        params.site = siteFilter;
      }
      if (dateRange?.from) {
        params.start_date = format(dateRange.from, "yyyy-MM-dd");
      }
      if (dateRange?.to) {
        params.end_date = format(dateRange.to, "yyyy-MM-dd");
      }

      const blob = await exportApplications(params);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;

      link.setAttribute("download", `Data_Lamaran_${timestamp}.xlsx`);
      document.body.appendChild(link);
      link.click();

      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Applications exported successfully");
    } catch (error) {
      toast.error("Failed to export applications.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAttachments = async () => {
    setIsExportingAttachments(true);
    try {
      const params: any = {};
      if (debouncedSearchTerm) {
        params.search = debouncedSearchTerm;
      }
      if (statusFilter && statusFilter !== "all") {
        params.status = statusFilter;
      }
      if (locationFilter && locationFilter !== "all") {
        params.location = locationFilter;
      }
      if (siteFilter && siteFilter !== "all") {
        params.site = siteFilter;
      }
      if (dateRange?.from) {
        params.start_date = format(dateRange.from, "yyyy-MM-dd");
      }
      if (dateRange?.to) {
        params.end_date = format(dateRange.to, "yyyy-MM-dd");
      }

      const blob = await exportAttachments(params);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;

      link.setAttribute("download", `Attachments_Lamaran_${timestamp}.zip`);
      document.body.appendChild(link);
      link.click();

      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Attachments exported successfully");
    } catch (error) {
      toast.error("Failed to export attachments.");
    } finally {
      setIsExportingAttachments(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "New":
        return (
          <span className="px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full dark:bg-blue-900/30 dark:text-blue-400">
            New
          </span>
        );
      case "Review":
        return (
          <span className="px-2.5 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full dark:bg-yellow-900/30 dark:text-yellow-400">
            Review
          </span>
        );
      case "Rejected":
        return (
          <span className="px-2.5 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full dark:bg-red-900/30 dark:text-red-400">
            Rejected
          </span>
        );
      case "Hired":
        return (
          <span className="px-2.5 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full dark:bg-green-900/30 dark:text-green-400">
            Hired
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-800 rounded-full dark:bg-slate-800 dark:text-slate-300">
            {status}
          </span>
        );
    }
  };

  const totalPages = Math.max(
    1,
    Math.ceil(applications.length / itemsPerPage),
  );
  const currentApplications = applications.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage,
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Applications
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage incoming job applications
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          {/* Row 1: Search & Date Range */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name or email..."
                className="pl-9 h-10 w-full text-sm rounded-md bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-orange-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-[280px] xl:w-[320px]">
              <DatePickerWithRange
                date={dateRange}
                setDate={setDateRange}
                className="w-full"
              />
            </div>
          </div>

          {/* Row 2: Select Filters & Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full h-10 rounded-md bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="Review">Review</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
                <SelectItem value="Hired">Hired</SelectItem>
              </SelectContent>
            </Select>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-full h-10 rounded-md bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="All Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Location</SelectItem>
                <SelectItem value="Jakarta">Jakarta</SelectItem>
                <SelectItem value="Kalimantan Selatan">Kalimantan Selatan</SelectItem>
                <SelectItem value="Kalimantan Timur">Kalimantan Timur</SelectItem>
              </SelectContent>
            </Select>

            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger className="w-full h-10 rounded-md bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="All Sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                <SelectItem value="ACP">ACP</SelectItem>
                <SelectItem value="BCP">BCP</SelectItem>
                <SelectItem value="BPN">Balikpapan</SelectItem>
                <SelectItem value="JKT">JKT</SelectItem>
                <SelectItem value="KCP">KCP</SelectItem>
                <SelectItem value="SCP">SCP</SelectItem>
                <SelectItem value="SSCP">SSCP</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isExporting || isExportingAttachments}
              className="w-full h-10 rounded-md bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {isExporting ? "Exporting..." : "Export Excel"}
            </Button>

            <Button
              variant="outline"
              onClick={handleExportAttachments}
              disabled={isExportingAttachments || isExporting}
              className="w-full h-10 rounded-md bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
            >
              {isExportingAttachments ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {isExportingAttachments ? "Exporting..." : "Export Attachments"}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-medium tracking-wider whitespace-nowrap">
                  Applicant Name
                </th>
                <th className="px-6 py-4 font-medium tracking-wider whitespace-nowrap">
                  Job Title
                </th>
                <th className="px-6 py-4 font-medium tracking-wider whitespace-nowrap">
                  Location
                </th>
                <th className="px-6 py-4 font-medium tracking-wider whitespace-nowrap">Site</th>
                <th className="px-6 py-4 font-medium tracking-wider whitespace-nowrap">
                  Contact
                </th>
                <th className="px-6 py-4 font-medium tracking-wider whitespace-nowrap">Status</th>
                <th className="px-6 py-4 font-medium tracking-wider whitespace-nowrap">Source</th>
                <th className="px-6 py-4 font-medium tracking-wider whitespace-nowrap">
                  Applied Date
                </th>
                <th className="px-6 py-4 font-medium tracking-wider text-right whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Loading applications...
                  </td>
                </tr>
              ) : currentApplications.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    No applications found.
                  </td>
                </tr>
              ) : (
                currentApplications.map((app) => (
                  <tr
                    key={app.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {app.full_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {app?.job ? `${app.job.level} - ${app.job.title}` : "Unknown Job"}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {app.job?.location || "-"}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {app.job?.site || "-"}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm whitespace-nowrap">
                      <div className="flex flex-col gap-1.5 min-w-[150px]">
                        <span className="flex items-center gap-1.5 truncate">
                          <Mail size={14} className="text-slate-400 shrink-0" />{" "}
                          <span className="truncate">{app.email}</span>
                        </span>
                        <span className="flex items-center gap-1.5 truncate">
                          <Phone size={14} className="text-slate-400 shrink-0" />{" "}
                          <span className="truncate">{app.mobile_phone || "-"}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(app.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-800 rounded-full dark:bg-slate-800 dark:text-slate-300 capitalize">
                         {app.status_apply || "local"}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-sm whitespace-nowrap">
                      {new Date(app.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            navigate(`/admin/applications/${app.id}`)
                          }
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                        >
                          <Eye size={18} />
                        </Button>
                        {!isHr && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              if (
                                window.confirm(
                                  "Are you sure you want to delete this application?",
                                )
                              ) {
                                try {
                                  const res = await deleteApplication(app.id);
                                  if (res.success) {
                                    toast.success(
                                      "Application deleted successfully",
                                    );
                                    fetchApplications();
                                  } else {
                                    toast.error(
                                      res.message ||
                                        "Failed to delete application",
                                    );
                                  }
                                } catch (e: any) {
                                  toast.error(
                                    e.response?.data?.message ||
                                      "Failed to delete application",
                                  );
                                }
                              }
                            }}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                          >
                            <Trash2 size={18} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Control */}
        <TablePagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
