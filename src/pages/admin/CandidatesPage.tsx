import { TablePagination } from "@/components/TablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getCandidates,
  postApplyToSqlServer,
  toggleCandidateChecklist,
  type Candidate,
} from "@/lib/api/candidates";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Activity,
  Award,
  BriefcaseBusiness,
  Calendar as CalendarIcon,
  Download,
  Eye,
  Filter,
  Mail,
  Phone,
  Search,
  User,
  Users,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// --- Formatter Helpers ---
const formatGender = (value?: string | null) => {
  if (!value) return "-";
  if (value === "M") return "Male";
  if (value === "F") return "Female";
  return value;
};

const getLastEducation = (candidate: Candidate) => {
  if (!candidate.education || candidate.education.length === 0) {
    return "-";
  }

  const lastEdu =
    candidate.education.find((item) => item.FgLastEdu === "Y") ||
    candidate.education[0];
  const levelName =
    lastEdu.education_level?.EduLvlName ||
    lastEdu.education_level?.EduLvlCode ||
    "-";
  const major = lastEdu.EduMjrName || "-";

  if (levelName === "-" && major === "-") return "-";
  if (major === "-") return levelName;
  if (levelName === "-") return major;
  return `${levelName} • ${major}`;
};

const getJobExpectedName = (item: any) =>
  item?.vacant_position?.VacantPositionName ||
  item?.vacancy_information?.vacant_position?.name ||
  item?.vacancy_information?.vacant_position?.VacantPositionName ||
  item?.position?.PosName ||
  item?.vacancy_information?.position?.name ||
  item?.vacancy_information?.position?.PosName ||
  item?.OtherPosName ||
  item?.job_title?.name ||
  item?.OtherJobTtlName ||
  "-";

const getPrimaryExpectedJob = (candidate: Candidate) => {
  if (!candidate.job_expected || candidate.job_expected.length === 0)
    return null;
  const priorityJob = candidate.job_expected.find(
    (j: any) => String(j.Priority) === "1",
  );
  return priorityJob || candidate.job_expected[0];
};
// --- Session Storage Helper ---
const getSessionState = (key: string, defaultValue: any) => {
  try {
    const saved = sessionStorage.getItem(key);
    if (saved !== null) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Error reading sessionStorage", e);
  }
  return defaultValue;
};

// --- Main Page Component ---
const CandidatesPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState<number>(() =>
    getSessionState("candidates_page", 1),
  );

  // Filter UI states
  const [showFilters, setShowFilters] = useState<boolean>(() =>
    getSessionState("candidates_showFilters", false),
  );
  const [searchTerm, setSearchTerm] = useState<string>(() =>
    getSessionState("candidates_searchTerm", ""),
  );
  const [vacancyName, setVacancyName] = useState<string>(() =>
    getSessionState("candidates_vacancyName", ""),
  );
  const [statusApply, setStatusApply] = useState<string>(() =>
    getSessionState("candidates_statusApply", ""),
  );
  const [startDate, setStartDate] = useState<string>(() =>
    getSessionState("candidates_startDate", ""),
  );
  const [endDate, setEndDate] = useState<string>(() =>
    getSessionState("candidates_endDate", ""),
  );
  const [province, setProvince] = useState<string[]>(() => {
    const val = getSessionState("candidates_province", []);
    return Array.isArray(val) ? val : [];
  });
  const [eduLevel, setEduLevel] = useState<string[]>(() => {
    const val = getSessionState("candidates_eduLevel", []);
    return Array.isArray(val) ? val : [];
  });
  const [eduMajor, setEduMajor] = useState<string[]>(() => {
    const val = getSessionState("candidates_eduMajor", []);
    return Array.isArray(val) ? val : [];
  });
  const [gender, setGender] = useState<string>(() =>
    getSessionState("candidates_gender", ""),
  );
  const [isChecked, setIsChecked] = useState<string>(() =>
    getSessionState("candidates_isChecked", ""),
  );

  // Applied Filter states (for API)
  const defaultAppliedFilters = {
    name: "",
    vacancyName: "",
    statusApply: "",
    startDate: "",
    endDate: "",
    province: [] as string[],
    eduLevel: [] as string[],
    eduMajor: [] as string[],
    gender: "",
    isChecked: "",
  };
  const [appliedFilters, setAppliedFilters] = useState(() => {
    const val = getSessionState("candidates_appliedFilters", defaultAppliedFilters);
    return {
      ...defaultAppliedFilters,
      ...val,
      province: Array.isArray(val?.province) ? val.province : [],
      eduLevel: Array.isArray(val?.eduLevel) ? val.eduLevel : [],
      eduMajor: Array.isArray(val?.eduMajor) ? val.eduMajor : [],
    };
  });

  // Persist states to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("candidates_page", JSON.stringify(page));
    sessionStorage.setItem(
      "candidates_showFilters",
      JSON.stringify(showFilters),
    );
    sessionStorage.setItem("candidates_searchTerm", JSON.stringify(searchTerm));
    sessionStorage.setItem(
      "candidates_vacancyName",
      JSON.stringify(vacancyName),
    );
    sessionStorage.setItem(
      "candidates_statusApply",
      JSON.stringify(statusApply),
    );
    sessionStorage.setItem("candidates_startDate", JSON.stringify(startDate));
    sessionStorage.setItem("candidates_endDate", JSON.stringify(endDate));
    sessionStorage.setItem("candidates_province", JSON.stringify(province));
    sessionStorage.setItem("candidates_eduLevel", JSON.stringify(eduLevel));
    sessionStorage.setItem("candidates_eduMajor", JSON.stringify(eduMajor));
    sessionStorage.setItem("candidates_gender", JSON.stringify(gender));
    sessionStorage.setItem("candidates_isChecked", JSON.stringify(isChecked));
    sessionStorage.setItem(
      "candidates_appliedFilters",
      JSON.stringify(appliedFilters),
    );
  }, [
    page,
    showFilters,
    searchTerm,
    vacancyName,
    statusApply,
    startDate,
    endDate,
    province,
    eduLevel,
    eduMajor,
    gender,
    isChecked,
    appliedFilters,
  ]);

  const handleApplyFilters = () => {
    setAppliedFilters({
      name: searchTerm,
      vacancyName,
      statusApply,
      startDate,
      endDate,
      province,
      eduLevel,
      eduMajor,
      gender,
      isChecked,
    });
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setVacancyName("");
    setStatusApply("");
    setStartDate("");
    setEndDate("");
    setProvince([]);
    setEduLevel([]);
    setEduMajor([]);
    setGender("");
    setIsChecked("");
    setAppliedFilters(defaultAppliedFilters);
    setPage(1);
  };

  const { data: statesResponse } = useQuery({
    queryKey: ["states"],
    queryFn: async () => {
      const baseUrl = import.meta.env.VITE_API_URL;
      const res = await api.get(`${baseUrl}/states`, {
        params: { per_page: 200 },
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: eduLevelsResponse } = useQuery({
    queryKey: ["edulevels"],
    queryFn: async () => {
      const baseUrl = import.meta.env.VITE_API_URL;
      const res = await api.get(`${baseUrl}/edulevels`, {
        params: { per_page: 200 },
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: eduMajorsResponse } = useQuery({
    queryKey: ["edumajors"],
    queryFn: async () => {
      const baseUrl = import.meta.env.VITE_API_URL;
      const res = await api.get(`${baseUrl}/edumajors`, {
        params: { per_page: 200 },
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: candidatesResponse,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "candidates",
      appliedFilters.name,
      appliedFilters.vacancyName,
      page,
      appliedFilters.statusApply,
      appliedFilters.startDate,
      appliedFilters.endDate,
      appliedFilters.province,
      appliedFilters.eduLevel,
      appliedFilters.eduMajor,
      appliedFilters.gender,
      appliedFilters.isChecked,
    ],
    queryFn: () =>
      getCandidates({
        name: appliedFilters.name,
        ...(appliedFilters.vacancyName && {
          vacancy_name: appliedFilters.vacancyName,
        }),
        page,
        ...(appliedFilters.statusApply &&
          appliedFilters.statusApply !== "all" && {
            status_apply: appliedFilters.statusApply,
          }),
        ...(appliedFilters.startDate && {
          start_date: appliedFilters.startDate,
        }),
        ...(appliedFilters.endDate && { end_date: appliedFilters.endDate }),
        ...(appliedFilters.province &&
          appliedFilters.province.length > 0 && {
            CanOriStateName: appliedFilters.province,
          }),
        ...(appliedFilters.eduLevel &&
          appliedFilters.eduLevel.length > 0 && {
            EduLevel: appliedFilters.eduLevel,
          }),
        ...(appliedFilters.eduMajor &&
          appliedFilters.eduMajor.length > 0 && {
            EduMjrName: appliedFilters.eduMajor,
          }),
        ...(appliedFilters.gender &&
          appliedFilters.gender !== "all" && {
            CanSex: appliedFilters.gender,
          }),
        ...(appliedFilters.isChecked &&
          appliedFilters.isChecked !== "all" && {
            is_checked: appliedFilters.isChecked,
          }),
      }),
    placeholderData: keepPreviousData,
    refetchOnMount: "always",
  });

  // Always fetch latest data when opening the page
  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (error) {
      const err = error as any;
      toast.error(err?.response?.data?.message || "Failed to fetch candidates");
    }
  }, [error]);

  const candidates = candidatesResponse?.success
    ? candidatesResponse.data?.data || []
    : [];
  const totalPages = Math.max(1, candidatesResponse?.data?.last_page || 1);
  const totalItems = candidatesResponse?.data?.total || 0;

  // State loading per kandidat
  const [loadingApply, setLoadingApply] = useState<{
    [canId: number]: boolean;
  }>({});

  const [loadingChecklist, setLoadingChecklist] = useState<{
    [canId: number]: boolean;
  }>({});

  const handleToggleChecklist = async (canId: number) => {
    setLoadingChecklist((prev) => ({ ...prev, [canId]: true }));
    try {
      const res = await toggleCandidateChecklist(canId);
      if (res.success) {
        toast.success(res.message);
        refetch();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update checklist");
    } finally {
      setLoadingChecklist((prev) => ({ ...prev, [canId]: false }));
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 animate-in fade-in duration-700 p-4 sm:p-6 pb-12 gap-6">
      {/* Compact Full-Width Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 rounded-xl dark:border-slate-800 p-4 sm:p-6 flex flex-col shadow-sm z-30">
        {/* Top Control Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 stroke-[2px]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                Candidate
              </h1>
              <p className="text-[13px] font-medium text-slate-500 mt-0.5 max-w-sm truncate">
                {totalItems} active records synced
                {isFetching && (
                  <span className="ml-2 animate-pulse text-orange-500">
                    (Refetching...)
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant={showFilters ? "default" : "outline"}
                onClick={() => setShowFilters(!showFilters)}
                className={`h-11 px-4 rounded-xl font-medium shadow-sm sm:flex flex-1 sm:flex-none transition-all ${
                  showFilters
                    ? "bg-orange-500 hover:bg-orange-600 text-white border-transparent"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Filter className="w-4 h-4 sm:mr-2" />{" "}
                <span className="hidden sm:inline">Filters</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="w-full mt-5 pt-5 border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
              {/* Row 1 */}
              <div className="flex flex-col gap-2 md:col-span-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Search
                </label>
                <div className="relative w-full group">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                  <Input
                    placeholder="Search by name, code..."
                    className="pl-10 h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full transition-all focus-visible:ring-2 focus-visible:ring-orange-500/20"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status Apply
                </label>
                <Select value={statusApply} onValueChange={setStatusApply}>
                  <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full transition-all focus:ring-2 focus:ring-orange-500/20">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="local">Local</SelectItem>
                    <SelectItem value="applied">Applied</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2 md:col-span-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Job Name
                </label>
                <div className="relative w-full group">
                  <BriefcaseBusiness className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                  <Input
                    placeholder="Search by job name..."
                    className="pl-10 h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full transition-all focus-visible:ring-2 focus-visible:ring-orange-500/20"
                    value={vacancyName}
                    onChange={(e) => setVacancyName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Province
                </label>
                <MultiSelect
                  options={
                    statesResponse?.data?.map((state: any) => ({
                      label: state.StateName,
                      value: state.StateName,
                    })) || []
                  }
                  selected={province}
                  onChange={setProvince}
                  placeholder="All Province"
                  className="w-full transition-all"
                  maxCount={1}
                />
              </div>

              {/* Row 2 */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Education Level
                </label>
                <MultiSelect
                  options={
                    eduLevelsResponse?.data?.map((edu: any) => ({
                      label: edu.EduLvlName,
                      value: String(edu.EduLvlId),
                    })) || []
                  }
                  selected={eduLevel}
                  onChange={setEduLevel}
                  placeholder="All Education"
                  className="w-full transition-all"
                  maxCount={1}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Jurusan
                </label>
                <MultiSelect
                  options={
                    eduMajorsResponse?.data?.map((mjr: any) => ({
                      label: mjr.EduMjrName,
                      value: mjr.EduMjrName,
                    })) || []
                  }
                  selected={eduMajor}
                  onChange={setEduMajor}
                  placeholder="All Jurusan"
                  className="w-full transition-all"
                  maxCount={1}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Gender
                </label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full transition-all focus:ring-2 focus:ring-orange-500/20">
                    <SelectValue placeholder="All Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Gender</SelectItem>
                    <SelectItem value="M">Laki - laki (M)</SelectItem>
                    <SelectItem value="F">Perempuan (F)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Start Date
                </label>
                <div className="relative w-full">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 transition-all focus-visible:ring-2 focus-visible:ring-orange-500/20",
                          !startDate && "text-slate-500 dark:text-slate-400",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? (
                          format(new Date(startDate + "T00:00:00"), "PPP")
                        ) : (
                          <span>Pick Start Date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={
                          startDate
                            ? new Date(startDate + "T00:00:00")
                            : undefined
                        }
                        onSelect={(date) =>
                          setStartDate(date ? format(date, "yyyy-MM-dd") : "")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  End Date
                </label>
                <div className="relative w-full">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 transition-all focus-visible:ring-2 focus-visible:ring-orange-500/20",
                          !endDate && "text-slate-500 dark:text-slate-400",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? (
                          format(new Date(endDate + "T00:00:00"), "PPP")
                        ) : (
                          <span>Pick End Date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={
                          endDate ? new Date(endDate + "T00:00:00") : undefined
                        }
                        onSelect={(date) =>
                          setEndDate(date ? format(date, "yyyy-MM-dd") : "")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Row 3 or Extension */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Check Status
                </label>
                <Select value={isChecked} onValueChange={setIsChecked}>
                  <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full transition-all focus:ring-2 focus:ring-orange-500/20">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="true">Checked (Done)</SelectItem>
                    <SelectItem value="false">Unchecked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 mt-4">
              <Button
                variant="outline"
                onClick={handleResetFilters}
                className="h-10 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium px-6"
              >
                Reset
              </Button>
              <Button
                onClick={handleApplyFilters}
                className="h-10 bg-orange-500 hover:bg-orange-600 text-white font-medium px-6 shadow-sm"
              >
                Apply Filter
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Full-Width Data Table Container */}
      <div className="w-full flex flex-col flex-1 bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap min-w-[1000px]">
            <thead className="bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">
              <tr className="text-[12px] font-semibold tracking-wider text-slate-500 uppercase">
                <th className="px-6 py-4">ID Code</th>
                <th className="px-6 py-4">Candidate Profile</th>
                <th className="px-6 py-4">Contact Detail</th>
                <th className="px-6 py-4">Demographics</th>
                <th className="px-6 py-4">Education Background</th>
                <th className="px-6 py-4">Applied Job</th>
                <th className="px-6 py-4">Status Apply</th>
                <th className="px-6 py-4">Checked</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={8}>
                    <div className="flex flex-col items-center justify-center gap-4 py-24">
                      <Activity className="w-8 h-8 text-orange-500 animate-pulse" />
                      <p className="text-sm font-semibold text-slate-400 tracking-wider uppercase">
                        Fetching Records...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="flex flex-col items-center justify-center gap-3 py-24">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-2">
                        <Search className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="font-semibold text-slate-700 dark:text-slate-200 text-lg">
                        No matches found
                      </p>
                      <p className="text-slate-500 text-sm font-medium">
                        We couldn't find any candidate matching "
                        {appliedFilters.name}".
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                candidates.map((candidate) => {
                  const dob = candidate.CanDateBirth
                    ? candidate.CanDateBirth.split(" ")[0]
                    : "-";
                  return (
                    <tr
                      key={candidate.CanId}
                      className="group hover:bg-orange-50/50 dark:hover:bg-slate-800/80 transition-colors"
                    >
                      <td className="px-6 py-4 text-xs font-mono font-medium text-slate-500">
                        {candidate.CanCode || "-"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden">
                            {candidate.photos?.[0]?.can_photo_base64 ? (
                              <img
                                src={
                                  candidate.photos[0].can_photo_base64.startsWith(
                                    "data:image",
                                  )
                                    ? candidate.photos[0].can_photo_base64
                                    : `data:image/jpeg;base64,${candidate.photos[0].can_photo_base64}`
                                }
                                alt={candidate.CanName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900 dark:text-slate-100 text-[14px] group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                              {candidate.CanName || "-"}
                            </span>
                            {candidate.FgFreshGrad === "Y" && (
                              <span className="text-[10px] font-semibold text-orange-500 tracking-wider mt-0.5 px-1.5 bg-orange-100 dark:bg-orange-500/10 rounded w-fit">
                                Fresh Grad
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="flex items-center gap-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />{" "}
                            {candidate.CanEmail || "-"}
                          </span>
                          <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />{" "}
                            {candidate.CanHandphone || "-"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-1.5">
                          <Badge
                            variant="outline"
                            className="border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium px-2 py-0"
                          >
                            {formatGender(candidate.CanSex)}
                          </Badge>
                          <span className="text-xs font-medium text-slate-500 ml-1">
                            {dob}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getLastEducation(candidate) !== "-" ? (
                          <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200 text-[13px]">
                            <Award className="w-4 h-4 text-orange-400 shrink-0" />
                            <span className="truncate max-w-[250px]">
                              {getLastEducation(candidate)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-slate-400 italic">
                            No Data
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const primaryJob = getPrimaryExpectedJob(candidate);
                          const jobCount = candidate.job_expected?.length || 0;

                          if (!primaryJob)
                            return (
                              <span className="text-sm font-medium text-slate-400 italic">
                                -
                              </span>
                            );
                          return (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200 text-[13px] max-w-[200px]">
                                <BriefcaseBusiness className="w-4 h-4 text-orange-400 shrink-0" />
                                <span
                                  className="truncate"
                                  title={getJobExpectedName(primaryJob)}
                                >
                                  {getJobExpectedName(primaryJob)}
                                </span>
                              </div>
                              {jobCount > 1 && (
                                <span className="text-[10px] font-semibold text-orange-500 bg-orange-100 dark:bg-orange-500/10 dark:text-orange-400 rounded-md px-1.5 py-0.5 w-fit">
                                  + {jobCount - 1} more jobs
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant="secondary"
                          className={`font-medium capitalize border ${
                            candidate.status_apply?.toLowerCase() === "applied"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-transparent"
                          }`}
                        >
                          {candidate.status_apply || "local"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={candidate.is_checked}
                                  onCheckedChange={() =>
                                    handleToggleChecklist(candidate.CanId)
                                  }
                                  disabled={loadingChecklist[candidate.CanId]}
                                  className={cn(
                                    "h-5 w-5 rounded-md border-slate-300 dark:border-slate-600 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500",
                                    loadingChecklist[candidate.CanId] &&
                                      "opacity-50 cursor-not-allowed",
                                  )}
                                />
                                {candidate.is_checked && (
                                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                    Done
                                  </span>
                                )}
                              </div>
                            </TooltipTrigger>
                            {candidate.is_checked && (
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 p-2 text-xs">
                                <div className="flex flex-col gap-1">
                                  <p className="font-semibold text-orange-400">
                                    Checked by:
                                  </p>
                                  <p>{candidate.checked_by || "-"}</p>
                                  <p className="font-semibold text-orange-400 mt-1">
                                    At:
                                  </p>
                                  <p>
                                    {candidate.checked_at
                                      ? format(
                                          new Date(candidate.checked_at),
                                          "PPP p",
                                        )
                                      : "-"}
                                  </p>
                                </div>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="px-6 py-4 text-right flex gap-2 justify-end">
                        <Button
                          size="sm"
                          className="h-9 px-4 rounded-xl font-medium bg-white text-slate-700 border border-slate-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 shadow-sm transition-all"
                          onClick={() =>
                            navigate(`/admin/candidates/${candidate.CanId}`)
                          }
                        >
                          <Eye className="w-4 h-4 mr-2" /> Details
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 px-4 rounded-xl font-medium border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-green-50 hover:text-green-600 hover:border-green-200 dark:hover:bg-slate-700 shadow-sm transition-all"
                          disabled={!!loadingApply[candidate.CanId]}
                          onClick={async () => {
                            setLoadingApply((prev) => ({
                              ...prev,
                              [candidate.CanId]: true,
                            }));
                            try {
                              const res = await postApplyToSqlServer(
                                candidate.CanId,
                              );
                              if (res.success) {
                                toast.success(
                                  res.message || "Berhasil apply ke SQL Server",
                                );
                                refetch();
                              } else {
                                toast.error(
                                  res.message || "Gagal apply ke SQL Server",
                                );
                              }
                            } catch (err) {
                              toast.error("Gagal apply ke SQL Server");
                            } finally {
                              setLoadingApply((prev) => ({
                                ...prev,
                                [candidate.CanId]: false,
                              }));
                            }
                          }}
                        >
                          {loadingApply[candidate.CanId] ? (
                            <span className="flex items-center">
                              <span className="animate-spin mr-2 w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full"></span>
                              Loading...
                            </span>
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" /> Apply ke SQL
                              Server
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination inside the rounded block */}
        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 px-6 py-4 flex items-center justify-between flex-wrap gap-4 shrink-0">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 hidden sm:inline-block">
            End of Current Results
          </span>
          <TablePagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
};

export default CandidatesPage;
