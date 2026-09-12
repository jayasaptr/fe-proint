import AiScoreChip from "@/components/AiScoreChip";
import InterviewScoreChip from "@/components/InterviewScoreChip";
import { copyToClipboard } from "@/lib/clipboard";
import { TablePagination } from "@/components/TablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  downloadCandidateAttachments,
  exportCandidates,
  getCandidates,
  getFtapOptions,
  postApplyToSqlServer,
  toggleCandidateChecklist,
  toggleCandidatePassed,
  type Candidate,
  type CandidateFilters,
} from "@/lib/api/candidates";
import {
  FTAP_DEPARTMENTS,
  FTAP_INTERVIEW_LOCATIONS,
  FTAP_TOEFL_TYPES,
  formatToeflScore,
  getToeflType,
} from "@/lib/constants/ftap";
import { bulkScreenCandidates, isScreeningPending } from "@/lib/api/screening";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth } from "date-fns";
import {
  Activity,
  Award,
  BriefcaseBusiness,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  GraduationCap,
  IdCard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  Sparkles,
  Trophy,
  User,
  Users,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
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

// Combine residential city + province into a single readable label.
// Falls back to the original/ID address when residential data is missing.
const getAddressCity = (candidate: Candidate) => {
  const addr = candidate.addresses?.[0];
  if (!addr) return "-";
  const city = addr.CanResCityName || addr.CanOriCityName;
  const state = addr.CanResStateName || addr.CanOriStateName;
  if (!city && !state) return "-";
  return [city, state].filter(Boolean).join(", ");
};

const getAddressDetail = (candidate: Candidate) => {
  const addr = candidate.addresses?.[0];
  if (!addr) return "-";
  return addr.CanResAddress || addr.CanOriAddress || "-";
};
// Nomor KTP dari daftar kartu identitas (PMCardType 1 = KTP). Fallback: nomor 16 digit apa pun.
const getKtpNumber = (candidate: Candidate) => {
  const cards: any[] =
    candidate.identities || candidate.id_cards || (candidate as any).idCards || candidate.cards || [];
  const ktp =
    cards.find((c) => Number(c?.CardTypeId ?? c?.card_type_id) === 1) ||
    cards.find((c) => /^\d{16}$/.test(String(c?.CardNumber ?? c?.number ?? "")));
  return (ktp?.CardNumber ?? ktp?.number ?? "") as string;
};

const formatShortDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return format(d, "dd MMM yyyy");
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
interface CandidatesPageProps {
  /**
   * "ftap": daftar kandidat mass hiring FTAP (Future Talent Acceleration Program).
   * Menambah filter & kolom khusus (TOEFL, KTP, tanggal lulus, tempat interview offline),
   * hanya menampilkan kandidat FTAP (backend param ftap=1), dan export mengikuti filter aktif.
   */
  variant?: "general" | "ftap";
}

const CandidatesPage: React.FC<CandidatesPageProps> = ({ variant = "general" }) => {
  const navigate = useNavigate();
  const { currentUser } = useOutletContext<{ currentUser: any }>();
  const isAdmin = currentUser?.is_admin;
  const isFtap = variant === "ftap";
  // Kunci sessionStorage dipisah per varian supaya filter list umum dan list FTAP tidak saling timpa.
  const storagePrefix = isFtap ? "ftap_candidates" : "candidates";
  const sk = React.useCallback(
    (key: string) => `${storagePrefix}_${key}`,
    [storagePrefix],
  );
  const [page, setPage] = useState<number>(() =>
    getSessionState(sk("page"), 1),
  );

  // Filter UI states
  const [showFilters, setShowFilters] = useState<boolean>(() =>
    getSessionState(sk("showFilters"), false),
  );
  const [searchTerm, setSearchTerm] = useState<string>(() =>
    getSessionState(sk("searchTerm"), ""),
  );
  const [vacancyName, setVacancyName] = useState<string>(() =>
    getSessionState(sk("vacancyName"), ""),
  );
  const [statusApply, setStatusApply] = useState<string>(() =>
    getSessionState(sk("statusApply"), ""),
  );
  const [startDate, setStartDate] = useState<string>(() =>
    getSessionState(sk("startDate"), ""),
  );
  const [endDate, setEndDate] = useState<string>(() =>
    getSessionState(sk("endDate"), ""),
  );
  const [province, setProvince] = useState<string[]>(() => {
    const val = getSessionState(sk("province"), []);
    return Array.isArray(val) ? val : [];
  });
  const [city, setCity] = useState<string[]>(() => {
    const val = getSessionState(sk("city"), []);
    return Array.isArray(val) ? val : [];
  });
  const [eduLevel, setEduLevel] = useState<string[]>(() => {
    const val = getSessionState(sk("eduLevel"), []);
    return Array.isArray(val) ? val : [];
  });
  const [eduMajor, setEduMajor] = useState<string[]>(() => {
    const val = getSessionState(sk("eduMajor"), []);
    return Array.isArray(val) ? val : [];
  });
  const [gender, setGender] = useState<string>(() =>
    getSessionState(sk("gender"), ""),
  );
  const [isChecked, setIsChecked] = useState<string>(() =>
    getSessionState(sk("isChecked"), ""),
  );
  const [isPassed, setIsPassed] = useState<string>(() =>
    getSessionState(sk("isPassed"), ""),
  );
  const [passedNote, setPassedNote] = useState<string>(() =>
    getSessionState(sk("passedNote"), ""),
  );
  // AI Screening filters
  const [aiStatus, setAiStatus] = useState<string>(() =>
    getSessionState(sk("aiStatus"), ""),
  );
  const [aiScoreMin, setAiScoreMin] = useState<string>(() =>
    getSessionState(sk("aiScoreMin"), ""),
  );
  const [aiScoreMax, setAiScoreMax] = useState<string>(() =>
    getSessionState(sk("aiScoreMax"), ""),
  );
  const [aiSort, setAiSort] = useState<string>(() =>
    getSessionState(sk("aiSort"), ""),
  );
  // AI Interview filters (terpisah dari AI screening CV)
  const [interviewStatus, setInterviewStatus] = useState<string>(() =>
    getSessionState(sk("interviewStatus"), ""),
  );
  const [interviewScoreMin, setInterviewScoreMin] = useState<string>(() =>
    getSessionState(sk("interviewScoreMin"), ""),
  );
  const [interviewScoreMax, setInterviewScoreMax] = useState<string>(() =>
    getSessionState(sk("interviewScoreMax"), ""),
  );
  // Filter khusus FTAP
  const [ftapDepartment, setFtapDepartment] = useState<string[]>(() => {
    const val = getSessionState(sk("ftapDepartment"), []);
    return Array.isArray(val) ? val : [];
  });
  const [toeflType, setToeflType] = useState<string>(() =>
    getSessionState(sk("toeflType"), ""),
  );
  const [toeflMin, setToeflMin] = useState<string>(() =>
    getSessionState(sk("toeflMin"), ""),
  );
  const [toeflMax, setToeflMax] = useState<string>(() =>
    getSessionState(sk("toeflMax"), ""),
  );
  const [toeflPassed, setToeflPassed] = useState<string>(() =>
    getSessionState(sk("toeflPassed"), ""),
  );
  const [interviewLocation, setInterviewLocation] = useState<string[]>(() => {
    const val = getSessionState(sk("interviewLocation"), []);
    return Array.isArray(val) ? val : [];
  });
  const [ktpNumber, setKtpNumber] = useState<string>(() =>
    getSessionState(sk("ktpNumber"), ""),
  );
  const [graduationFrom, setGraduationFrom] = useState<string>(() =>
    getSessionState(sk("graduationFrom"), ""),
  );
  const [graduationTo, setGraduationTo] = useState<string>(() =>
    getSessionState(sk("graduationTo"), ""),
  );
  // Bulk selection for AI screening
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkScreening, setIsBulkScreening] = useState(false);

  // Applied Filter states (for API)
  const defaultAppliedFilters = {
    name: "",
    vacancyName: "",
    statusApply: "",
    startDate: "",
    endDate: "",
    province: [] as string[],
    city: [] as string[],
    eduLevel: [] as string[],
    eduMajor: [] as string[],
    gender: "",
    isChecked: "",
    isPassed: "",
    passedNote: "",
    aiStatus: "",
    aiScoreMin: "",
    aiScoreMax: "",
    aiSort: "",
    interviewStatus: "",
    interviewScoreMin: "",
    interviewScoreMax: "",
    ftapDepartment: [] as string[],
    toeflType: "",
    toeflMin: "",
    toeflMax: "",
    toeflPassed: "",
    interviewLocation: [] as string[],
    ktpNumber: "",
    graduationFrom: "",
    graduationTo: "",
  };
  const [appliedFilters, setAppliedFilters] = useState(() => {
    const val = getSessionState(
      sk("appliedFilters"),
      defaultAppliedFilters,
    );
    return {
      ...defaultAppliedFilters,
      ...val,
      province: Array.isArray(val?.province) ? val.province : [],
      city: Array.isArray(val?.city) ? val.city : [],
      eduLevel: Array.isArray(val?.eduLevel) ? val.eduLevel : [],
      eduMajor: Array.isArray(val?.eduMajor) ? val.eduMajor : [],
      ftapDepartment: Array.isArray(val?.ftapDepartment) ? val.ftapDepartment : [],
      interviewLocation: Array.isArray(val?.interviewLocation) ? val.interviewLocation : [],
    };
  });

  // Persist states to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(sk("page"), JSON.stringify(page));
    sessionStorage.setItem(
      sk("showFilters"),
      JSON.stringify(showFilters),
    );
    sessionStorage.setItem(sk("searchTerm"), JSON.stringify(searchTerm));
    sessionStorage.setItem(
      sk("vacancyName"),
      JSON.stringify(vacancyName),
    );
    sessionStorage.setItem(
      sk("statusApply"),
      JSON.stringify(statusApply),
    );
    sessionStorage.setItem(sk("startDate"), JSON.stringify(startDate));
    sessionStorage.setItem(sk("endDate"), JSON.stringify(endDate));
    sessionStorage.setItem(sk("province"), JSON.stringify(province));
    sessionStorage.setItem(sk("city"), JSON.stringify(city));
    sessionStorage.setItem(sk("eduLevel"), JSON.stringify(eduLevel));
    sessionStorage.setItem(sk("eduMajor"), JSON.stringify(eduMajor));
    sessionStorage.setItem(sk("gender"), JSON.stringify(gender));
    sessionStorage.setItem(sk("isChecked"), JSON.stringify(isChecked));
    sessionStorage.setItem(sk("isPassed"), JSON.stringify(isPassed));
    sessionStorage.setItem(sk("passedNote"), JSON.stringify(passedNote));
    sessionStorage.setItem(sk("aiStatus"), JSON.stringify(aiStatus));
    sessionStorage.setItem(sk("aiScoreMin"), JSON.stringify(aiScoreMin));
    sessionStorage.setItem(sk("aiScoreMax"), JSON.stringify(aiScoreMax));
    sessionStorage.setItem(sk("aiSort"), JSON.stringify(aiSort));
    sessionStorage.setItem(sk("interviewStatus"), JSON.stringify(interviewStatus));
    sessionStorage.setItem(sk("interviewScoreMin"), JSON.stringify(interviewScoreMin));
    sessionStorage.setItem(sk("interviewScoreMax"), JSON.stringify(interviewScoreMax));
    sessionStorage.setItem(sk("ftapDepartment"), JSON.stringify(ftapDepartment));
    sessionStorage.setItem(sk("toeflType"), JSON.stringify(toeflType));
    sessionStorage.setItem(sk("toeflMin"), JSON.stringify(toeflMin));
    sessionStorage.setItem(sk("toeflMax"), JSON.stringify(toeflMax));
    sessionStorage.setItem(sk("toeflPassed"), JSON.stringify(toeflPassed));
    sessionStorage.setItem(sk("interviewLocation"), JSON.stringify(interviewLocation));
    sessionStorage.setItem(sk("ktpNumber"), JSON.stringify(ktpNumber));
    sessionStorage.setItem(sk("graduationFrom"), JSON.stringify(graduationFrom));
    sessionStorage.setItem(sk("graduationTo"), JSON.stringify(graduationTo));
    sessionStorage.setItem(
      sk("appliedFilters"),
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
    city,
    eduLevel,
    eduMajor,
    gender,
    isChecked,
    isPassed,
    passedNote,
    aiStatus,
    aiScoreMin,
    aiScoreMax,
    aiSort,
    interviewStatus,
    interviewScoreMin,
    interviewScoreMax,
    ftapDepartment,
    toeflType,
    toeflMin,
    toeflMax,
    toeflPassed,
    interviewLocation,
    ktpNumber,
    graduationFrom,
    graduationTo,
    appliedFilters,
    sk,
  ]);

  const handleApplyFilters = () => {
    setAppliedFilters({
      name: searchTerm,
      vacancyName,
      statusApply,
      startDate,
      endDate,
      province,
      city,
      eduLevel,
      eduMajor,
      gender,
      isChecked,
      isPassed,
      passedNote,
      aiStatus,
      aiScoreMin,
      aiScoreMax,
      aiSort,
      interviewStatus,
      interviewScoreMin,
      interviewScoreMax,
      ftapDepartment,
      toeflType,
      toeflMin,
      toeflMax,
      toeflPassed,
      interviewLocation,
      ktpNumber,
      graduationFrom,
      graduationTo,
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
    setCity([]);
    setEduLevel([]);
    setEduMajor([]);
    setGender("");
    setIsChecked("");
    setIsPassed("");
    setPassedNote("");
    setAiStatus("");
    setAiScoreMin("");
    setAiScoreMax("");
    setAiSort("");
    setInterviewStatus("");
    setInterviewScoreMin("");
    setInterviewScoreMax("");
    setFtapDepartment([]);
    setToeflType("");
    setToeflMin("");
    setToeflMax("");
    setToeflPassed("");
    setInterviewLocation([]);
    setKtpNumber("");
    setGraduationFrom("");
    setGraduationTo("");
    setAppliedFilters(defaultAppliedFilters);
    setPage(1);
  };

  // Master filter FTAP dari backend (lowongan "FTAP - <Departemen>" di SQL Server, tempat interview).
  const { data: ftapOptionsResponse } = useQuery({
    queryKey: ["ftap-options"],
    queryFn: getFtapOptions,
    enabled: isFtap,
    staleTime: 5 * 60 * 1000,
  });

  const ftapDepartmentOptions = React.useMemo(() => {
    const fromApi = (ftapOptionsResponse?.data?.vacancies ?? [])
      .map((v) => v.department || v.name)
      .filter((d): d is string => Boolean(d));
    const names = fromApi.length > 0 ? fromApi : [...FTAP_DEPARTMENTS];
    return Array.from(new Set(names)).map((name) => ({ label: name, value: name }));
  }, [ftapOptionsResponse]);

  const ftapLocationOptions = React.useMemo(() => {
    const list = ftapOptionsResponse?.data?.interview_locations?.length
      ? ftapOptionsResponse.data.interview_locations
      : [...FTAP_INTERVIEW_LOCATIONS];
    return list.map((name) => ({
      label: name.replace(/^Recruitment FTAP\s*-\s*/i, ""),
      value: name,
    }));
  }, [ftapOptionsResponse]);

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

  // Map selected province names -> StateId so we can query their cities.
  // Province filter stores StateName, but /cities expects state_id.
  const selectedProvinceIds = React.useMemo(() => {
    const states = statesResponse?.data || [];
    return province
      .map(
        (name) =>
          states.find((s: any) => s.StateName === name)?.StateId as
            | number
            | undefined,
      )
      .filter((id): id is number => id !== undefined && id !== null);
  }, [province, statesResponse]);

  // Kabupaten/Kota options depend on the selected province(s).
  // Fetch cities per selected province and merge them into a single list.
  const { data: citiesResponse } = useQuery({
    queryKey: ["cities", selectedProvinceIds],
    enabled: selectedProvinceIds.length > 0,
    queryFn: async () => {
      const baseUrl = import.meta.env.VITE_API_URL;
      const results = await Promise.all(
        selectedProvinceIds.map((stateId) =>
          api.get(`${baseUrl}/cities`, {
            params: { state_id: stateId, per_page: 500 },
          }),
        ),
      );
      return results.flatMap((res) => res.data?.data || []);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Dedupe cities by name (a name can repeat across provinces) for the dropdown.
  const cityOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const options: { label: string; value: string }[] = [];
    (citiesResponse || []).forEach((c: any) => {
      const name = c?.CityName;
      if (name && !seen.has(name)) {
        seen.add(name);
        options.push({ label: name, value: name });
      }
    });
    return options;
  }, [citiesResponse]);

  // When no province is selected, the city filter must be empty (and locked).
  useEffect(() => {
    if (province.length === 0 && city.length > 0) {
      setCity([]);
    }
  }, [province, city.length]);

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

  // Parameter API dari filter yang sudah di-apply. Dipakai untuk list DAN export Excel,
  // sehingga file yang diunduh selalu berisi persis data yang sedang ditampilkan.
  const apiFilters = React.useMemo<CandidateFilters>(() => {
    const f = appliedFilters;
    const sort: Partial<CandidateFilters> = (() => {
      switch (f.aiSort) {
        case "desc":
        case "asc":
          return { sort_by: "ai_score", sort_direction: f.aiSort };
        case "interview_desc":
          return { sort_by: "interview_score", sort_direction: "desc" };
        case "interview_asc":
          return { sort_by: "interview_score", sort_direction: "asc" };
        case "toefl_desc":
          return { sort_by: "toefl_score", sort_direction: "desc" };
        case "toefl_asc":
          return { sort_by: "toefl_score", sort_direction: "asc" };
        case "graduation_desc":
          return { sort_by: "graduation_date", sort_direction: "desc" };
        case "graduation_asc":
          return { sort_by: "graduation_date", sort_direction: "asc" };
        default:
          return {};
      }
    })();

    return {
      // List FTAP hanya kandidat FTAP (ftap=1); list umum mengecualikan mereka (ftap=0)
      // supaya kedua daftar saling lepas. Export mengikuti nilai yang sama.
      ftap: isFtap ? 1 : 0,
      ...(f.name && { name: f.name }),
      ...(f.vacancyName && { vacancy_name: f.vacancyName }),
      ...(f.statusApply && f.statusApply !== "all" && { status_apply: f.statusApply }),
      ...(f.startDate && { start_date: f.startDate }),
      ...(f.endDate && { end_date: f.endDate }),
      ...(f.province?.length > 0 && { CanOriStateName: f.province }),
      ...(f.city?.length > 0 && { CanOriCityName: f.city }),
      ...(f.eduLevel?.length > 0 && { EduLevel: f.eduLevel }),
      ...(f.eduMajor?.length > 0 && { EduMjrName: f.eduMajor }),
      ...(f.gender && f.gender !== "all" && { CanSex: f.gender }),
      ...(f.isChecked && f.isChecked !== "all" && { is_checked: f.isChecked }),
      ...(f.isPassed && f.isPassed !== "all" && { is_passed: f.isPassed }),
      ...(f.passedNote?.trim() && { passed_note: f.passedNote.trim() }),
      ...(f.aiStatus && f.aiStatus !== "all" && { ai_status: f.aiStatus }),
      ...(f.aiScoreMin !== "" && { ai_score_min: f.aiScoreMin }),
      ...(f.aiScoreMax !== "" && { ai_score_max: f.aiScoreMax }),
      // AI Interview
      ...(f.interviewStatus && f.interviewStatus !== "all" && { interview_status: f.interviewStatus }),
      ...(f.interviewScoreMin !== "" && { interview_score_min: f.interviewScoreMin }),
      ...(f.interviewScoreMax !== "" && { interview_score_max: f.interviewScoreMax }),
      // FTAP
      ...(f.ftapDepartment?.length > 0 && { ftap_department: f.ftapDepartment }),
      ...(f.toeflType && f.toeflType !== "all" && { toefl_type: f.toeflType }),
      ...(f.toeflMin !== "" && { toefl_score_min: f.toeflMin }),
      ...(f.toeflMax !== "" && { toefl_score_max: f.toeflMax }),
      ...(f.toeflPassed && f.toeflPassed !== "all" && { toefl_passed: f.toeflPassed }),
      ...(f.interviewLocation?.length > 0 && { interview_location: f.interviewLocation }),
      ...(f.ktpNumber?.trim() && { ktp_number: f.ktpNumber.trim() }),
      ...(f.graduationFrom && { graduation_from: f.graduationFrom }),
      ...(f.graduationTo && { graduation_to: f.graduationTo }),
      ...sort,
    };
  }, [appliedFilters, isFtap]);

  const {
    data: candidatesResponse,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["candidates", variant, page, apiFilters],
    queryFn: () => getCandidates({ ...apiFilters, page }),
    placeholderData: keepPreviousData,
    refetchOnMount: "always",
    // Selama ada kandidat di halaman ini yang masih dalam antrean/proses AI screening,
    // poll setiap 5 detik agar skor muncul otomatis tanpa reload.
    refetchInterval: (query) => {
      const rows = query.state.data?.data?.data ?? [];
      return rows.some((c) => isScreeningPending(c.latest_ai_screening)) ? 5000 : false;
    },
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

  // Halaman tersimpan di sessionStorage bisa melebihi jumlah halaman hasil filter baru
  // (mis. kembali dari detail setelah data berubah) -> tabel kosong. Kembalikan ke halaman 1.
  useEffect(() => {
    if (!isLoading && !isFetching && candidatesResponse?.success && page > totalPages) {
      setPage(1);
    }
  }, [isLoading, isFetching, candidatesResponse?.success, page, totalPages]);
  const totalItems = candidatesResponse?.data?.total || 0;

  // ---- Bulk AI screening selection ----
  const pageIds = candidates.map((c) => Number(c.CanId));

  // Konteks navigasi untuk halaman detail: asal list, urutan kandidat di halaman ini, dan
  // filter aktif, supaya tombol Prev/Next di detail bisa berjalan mengikuti urutan list
  // (termasuk berpindah halaman) dan tombol Back kembali ke list yang benar.
  const navState = {
    from: variant,
    ids: pageIds,
    page,
    totalPages,
    filters: apiFilters,
    storagePrefix,
  };
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someOnPageSelected = pageIds.some((id) => selectedIds.has(id));

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkScreening = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsBulkScreening(true);
    try {
      const res = await bulkScreenCandidates(ids);
      if (res.success) {
        const skippedCount = res.data.skipped_count ?? 0;
        toast.success(
          `${res.data.queued_count} kandidat masuk antrean AI screening` +
            (skippedCount > 0 ? `, ${skippedCount} dilewati` : ""),
          {
            description:
              skippedCount > 0
                ? Object.entries(res.data.skipped)
                    .slice(0, 3)
                    .map(([id, reason]) => `#${id}: ${reason}`)
                    .join(" · ")
                : "Skor akan muncul otomatis saat worker selesai.",
          },
        );
        setSelectedIds(new Set());
        refetch();
      } else {
        toast.error(res.message || "Gagal mengantrekan AI screening");
      }
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || (err instanceof Error ? err.message : "Gagal mengantrekan AI screening"));
    } finally {
      setIsBulkScreening(false);
    }
  };

  // State loading per kandidat
  const [loadingApply, setLoadingApply] = useState<{
    [canId: number]: boolean;
  }>({});

  const [loadingDownload, setLoadingDownload] = useState<{
    [canId: number]: boolean;
  }>({});

  const [loadingChecklist, setLoadingChecklist] = useState<{
    [canId: number]: boolean;
  }>({});

  const [loadingPassed, setLoadingPassed] = useState<{
    [canId: number]: boolean;
  }>({});

  // Modal state for marking candidate as passed (with optional note)
  const [passedDialogCandidate, setPassedDialogCandidate] =
    useState<Candidate | null>(null);
  const [passedNoteInput, setPassedNoteInput] = useState<string>("");

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modal state for reading the full (long) address of a candidate
  const [addressModalCandidate, setAddressModalCandidate] =
    useState<Candidate | null>(null);

  // Export dialog state. Export is scoped to a single month (max range: 1 month).
  // We keep the selected month as "yyyy-MM" and derive the start/end dates
  // (first & last day of that month) when exporting.
  const currentMonthStr = format(new Date(), "yyyy-MM");
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportMonth, setExportMonth] = useState<string>(currentMonthStr);
  const [loadingExport, setLoadingExport] = useState(false);
  // Whether the month-picker popover is open, and which year its grid shows
  // (navigated independently from the selected month via the arrows).
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(() =>
    new Date().getFullYear(),
  );

  // Jumlah filter aktif (selain paging/sort) — dipakai untuk label tombol "Export hasil filter".
  const activeFilterCount = Object.keys(apiFilters).filter(
    (k) => !["ftap", "sort_by", "sort_direction"].includes(k),
  ).length;

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  // Export persis hasil filter yang sedang tampil (tanpa batasan 1 bulan).
  // Contoh sourcing FTAP: TOEFL ITP >= 500 + jurusan Statistik -> langsung jadi Excel.
  const handleExportFiltered = async () => {
    setLoadingExport(true);
    try {
      const { blob, filename } = await exportCandidates(apiFilters);
      downloadBlob(blob, filename);
      toast.success(
        activeFilterCount > 0
          ? `Export ${totalItems} kandidat sesuai filter aktif berhasil`
          : `Export ${totalItems} kandidat berhasil`,
      );
      setExportDialogOpen(false);
    } catch (err) {
      const e = err as any;
      toast.error(e?.response?.data?.message || "Failed to export candidates");
    } finally {
      setLoadingExport(false);
    }
  };

  const handleExport = async () => {
    if (!exportMonth) {
      toast.error("Please select a month");
      return;
    }

    const baseDate = new Date(exportMonth + "-01T00:00:00");
    const startDate = format(startOfMonth(baseDate), "yyyy-MM-dd");
    // If the selected month is the current (ongoing) month, cap the end date at
    // today instead of the last day of the month — the rest hasn't happened yet.
    const lastDayStr = format(endOfMonth(baseDate), "yyyy-MM-dd");
    const endDate = exportMonth === currentMonthStr ? todayStr : lastDayStr;

    setLoadingExport(true);
    try {
      // Di list FTAP, export per bulan tetap dibatasi ke kandidat FTAP saja.
      const { blob, filename } = await exportCandidates({
        ftap: isFtap ? 1 : 0,
        start_date: startDate,
        end_date: endDate,
      });
      downloadBlob(blob, filename);
      toast.success("Candidates exported successfully");
      setExportDialogOpen(false);
    } catch (err) {
      const e = err as any;
      toast.error(
        e?.response?.data?.message || "Failed to export candidates",
      );
    } finally {
      setLoadingExport(false);
    }
  };

  const handleCopy = async (value: string, key: string, label: string) => {
    if (!value || value === "-") return;
    // copyToClipboard punya fallback untuk halaman non-HTTPS (navigator.clipboard undefined di LAN dev)
    if (await copyToClipboard(value)) {
      setCopiedKey(key);
      toast.success(`${label} copied`);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 1500);
    } else {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  };

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

  const callTogglePassed = async (canId: number, note?: string) => {
    setLoadingPassed((prev) => ({ ...prev, [canId]: true }));
    try {
      const res = await toggleCandidatePassed(canId, note);
      if (res.success) {
        toast.success(res.message);
        refetch();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.errors?.note?.[0] ||
          "Failed to update selection-passed status",
      );
    } finally {
      setLoadingPassed((prev) => ({ ...prev, [canId]: false }));
    }
  };

  const handlePassedClick = (candidate: Candidate) => {
    if (candidate.is_passed) {
      const ok = window.confirm(
        `Cabut tanda lolos untuk "${candidate.CanName}"? Catatan yang tersimpan akan ikut terhapus.`,
      );
      if (!ok) return;
      callTogglePassed(candidate.CanId);
    } else {
      setPassedNoteInput("");
      setPassedDialogCandidate(candidate);
    }
  };

  const handleConfirmMarkPassed = async () => {
    if (!passedDialogCandidate) return;
    const candidate = passedDialogCandidate;
    const note = passedNoteInput;
    setPassedDialogCandidate(null);
    setPassedNoteInput("");
    await callTogglePassed(candidate.CanId, note);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 animate-in fade-in duration-700 p-4 sm:p-6 pb-12 gap-6">
      {/* Compact Full-Width Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 rounded-xl dark:border-slate-800 p-4 sm:p-6 flex flex-col shadow-sm z-30">
        {/* Top Control Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center shrink-0">
              {isFtap ? (
                <GraduationCap className="w-6 h-6 stroke-[2px]" />
              ) : (
                <Users className="w-6 h-6 stroke-[2px]" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                {isFtap ? "FTAP Candidates" : "Candidate"}
              </h1>
              <p className="text-[13px] font-medium text-slate-500 mt-0.5 max-w-sm truncate">
                {isFtap && (
                  <span className="mr-1">Future Talent Acceleration Program ·</span>
                )}
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
                variant="outline"
                onClick={() => {
                  // Reset to the current month each time the dialog opens
                  setExportMonth(currentMonthStr);
                  setPickerYear(new Date().getFullYear());
                  setExportDialogOpen(true);
                }}
                className="h-11 px-4 rounded-xl font-medium shadow-sm sm:flex flex-1 sm:flex-none transition-all border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <FileSpreadsheet className="w-4 h-4 sm:mr-2" />{" "}
                <span className="hidden sm:inline">Export</span>
              </Button>
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
                    placeholder={
                      isFtap
                        ? "Nama, email, no. HP, atau nomor KTP..."
                        : "Search by name, email, phone, KTP..."
                    }
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

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Kabupaten / Kota
                </label>
                <MultiSelect
                  options={cityOptions}
                  selected={city}
                  onChange={setCity}
                  disabled={province.length === 0}
                  placeholder={
                    province.length === 0
                      ? "Pilih provinsi dulu"
                      : "All Kabupaten / Kota"
                  }
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

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Selection Status
                </label>
                <Select value={isPassed} onValueChange={setIsPassed}>
                  <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full transition-all focus:ring-2 focus:ring-orange-500/20">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="true">Lolos Seleksi</SelectItem>
                    <SelectItem value="false">Belum Lolos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ---- AI Screening CV (skor 0-100) ---- */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  AI CV Screening
                </label>
                <Select value={aiStatus} onValueChange={setAiStatus}>
                  <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full transition-all focus:ring-2 focus:ring-orange-500/20">
                    <SelectValue placeholder="Semua" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua</SelectItem>
                    <SelectItem value="screened">Sudah ada skor</SelectItem>
                    <SelectItem value="none">Belum di-screening</SelectItem>
                    <SelectItem value="pending">Dalam antrean / proses</SelectItem>
                    <SelectItem value="failed">Gagal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Skor AI CV (Min - Max)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="0"
                    className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full transition-all focus-visible:ring-2 focus-visible:ring-orange-500/20"
                    value={aiScoreMin}
                    onChange={(e) => setAiScoreMin(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
                  />
                  <span className="text-slate-400 text-sm">-</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="100"
                    className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full transition-all focus-visible:ring-2 focus-visible:ring-orange-500/20"
                    value={aiScoreMax}
                    onChange={(e) => setAiScoreMax(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
                  />
                </div>
              </div>

              {/* ---- AI Interview (skor 1-10) ---- */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  AI Interview
                </label>
                <Select value={interviewStatus} onValueChange={setInterviewStatus}>
                  <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full transition-all focus:ring-2 focus:ring-orange-500/20">
                    <SelectValue placeholder="Semua" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua</SelectItem>
                    <SelectItem value="interviewed">Sudah ada skor</SelectItem>
                    <SelectItem value="none">Belum diundang</SelectItem>
                    <SelectItem value="pending">Diundang / berlangsung</SelectItem>
                    <SelectItem value="failed">Gagal</SelectItem>
                    <SelectItem value="expired">Undangan kedaluwarsa</SelectItem>
                    <SelectItem value="cancelled">Dibatalkan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Skor AI Interview (Min - Max)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    step="0.5"
                    placeholder="1"
                    className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full transition-all focus-visible:ring-2 focus-visible:ring-orange-500/20"
                    value={interviewScoreMin}
                    onChange={(e) => setInterviewScoreMin(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
                  />
                  <span className="text-slate-400 text-sm">-</span>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    step="0.5"
                    placeholder="10"
                    className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full transition-all focus-visible:ring-2 focus-visible:ring-orange-500/20"
                    value={interviewScoreMax}
                    onChange={(e) => setInterviewScoreMax(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
                  />
                </div>
              </div>

              {/* Satu dropdown urutan: hanya satu kunci sort yang bisa aktif sekaligus */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Urutkan
                </label>
                <Select value={aiSort} onValueChange={setAiSort}>
                  <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full transition-all focus:ring-2 focus:ring-orange-500/20">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Default (terbaru)</SelectItem>
                    <SelectItem value="desc">Skor AI CV tertinggi dulu</SelectItem>
                    <SelectItem value="asc">Skor AI CV terendah dulu</SelectItem>
                    <SelectItem value="interview_desc">Skor AI Interview tertinggi dulu</SelectItem>
                    <SelectItem value="interview_asc">Skor AI Interview terendah dulu</SelectItem>
                    {isFtap && (
                      <>
                        <SelectItem value="toefl_desc">TOEFL tertinggi dulu</SelectItem>
                        <SelectItem value="toefl_asc">TOEFL terendah dulu</SelectItem>
                        <SelectItem value="graduation_desc">Lulus terbaru dulu</SelectItem>
                        <SelectItem value="graduation_asc">Lulus terlama dulu</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Catatan Lolos Seleksi
                </label>
                <div className="relative w-full group">
                  <Trophy className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                  <Input
                    placeholder="Cari berdasarkan catatan lolos seleksi..."
                    className="pl-10 h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full transition-all focus-visible:ring-2 focus-visible:ring-orange-500/20"
                    value={passedNote}
                    onChange={(e) => setPassedNote(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
                  />
                </div>
              </div>

              {isFtap && (
                <>
                  <div className="sm:col-span-2 md:col-span-4 flex items-center gap-3 pt-2">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400">
                      Filter FTAP
                    </span>
                    <div className="h-px flex-1 bg-orange-200/70 dark:bg-orange-500/20" />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Departemen FTAP
                    </label>
                    <MultiSelect
                      options={ftapDepartmentOptions}
                      selected={ftapDepartment}
                      onChange={setFtapDepartment}
                      placeholder="Semua departemen"
                      maxCount={2}
                      className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Nomor KTP
                    </label>
                    <div className="relative w-full group">
                      <IdCard className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                      <Input
                        inputMode="numeric"
                        placeholder="16 digit nomor KTP..."
                        className="pl-10 h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full transition-all focus-visible:ring-2 focus-visible:ring-orange-500/20"
                        value={ktpNumber}
                        onChange={(e) => setKtpNumber(e.target.value.replace(/\D+/g, "").slice(0, 16))}
                        onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Jenis Tes Inggris
                    </label>
                    <Select value={toeflType} onValueChange={setToeflType}>
                      <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full transition-all focus:ring-2 focus:ring-orange-500/20">
                        <SelectValue placeholder="Semua jenis" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua jenis</SelectItem>
                        {FTAP_TOEFL_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label} (lolos ≥ {t.minPass})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Skor TOEFL/IELTS (Min - Max)
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.5"
                        min={0}
                        placeholder={getToeflType(toeflType) ? String(getToeflType(toeflType)!.minPass) : "Min"}
                        className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full transition-all focus-visible:ring-2 focus-visible:ring-orange-500/20"
                        value={toeflMin}
                        onChange={(e) => setToeflMin(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
                      />
                      <span className="text-slate-400 text-sm">-</span>
                      <Input
                        type="number"
                        step="0.5"
                        min={0}
                        placeholder={getToeflType(toeflType) ? String(getToeflType(toeflType)!.scaleMax) : "Max"}
                        className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full transition-all focus-visible:ring-2 focus-visible:ring-orange-500/20"
                        value={toeflMax}
                        onChange={(e) => setToeflMax(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Syarat TOEFL
                    </label>
                    <Select value={toeflPassed} onValueChange={setToeflPassed}>
                      <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full transition-all focus:ring-2 focus:ring-orange-500/20">
                        <SelectValue placeholder="Semua" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua</SelectItem>
                        <SelectItem value="1">Memenuhi (ITP 500 / iBT 60 / IELTS 5.5)</SelectItem>
                        <SelectItem value="0">Belum memenuhi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Tempat Interview Offline
                    </label>
                    <MultiSelect
                      options={ftapLocationOptions}
                      selected={interviewLocation}
                      onChange={setInterviewLocation}
                      placeholder="Semua lokasi"
                      maxCount={2}
                      className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 w-full"
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Tanggal Lulus (Dari - Sampai)
                    </label>
                    {/* Popover + Calendar shadcn, pola yang sama dengan filter Start/End Date di atas */}
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full min-w-0 justify-start text-left font-normal h-10 px-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 transition-all focus-visible:ring-2 focus-visible:ring-orange-500/20",
                              !graduationFrom && "text-slate-500 dark:text-slate-400",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                            {graduationFrom ? (
                              <span className="truncate">{format(new Date(graduationFrom + "T00:00:00"), "dd MMM yyyy")}</span>
                            ) : (
                              <span className="truncate">Lulus dari</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            captionLayout="dropdown"
                            startMonth={new Date(new Date().getFullYear() - 15, 0)}
                            endMonth={new Date(new Date().getFullYear() + 2, 11)}
                            selected={
                              graduationFrom
                                ? new Date(graduationFrom + "T00:00:00")
                                : undefined
                            }
                            onSelect={(date) =>
                              setGraduationFrom(date ? format(date, "yyyy-MM-dd") : "")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <span className="text-slate-400 text-sm">-</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full min-w-0 justify-start text-left font-normal h-10 px-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 transition-all focus-visible:ring-2 focus-visible:ring-orange-500/20",
                              !graduationTo && "text-slate-500 dark:text-slate-400",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                            {graduationTo ? (
                              <span className="truncate">{format(new Date(graduationTo + "T00:00:00"), "dd MMM yyyy")}</span>
                            ) : (
                              <span className="truncate">Lulus sampai</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            captionLayout="dropdown"
                            startMonth={new Date(new Date().getFullYear() - 15, 0)}
                            endMonth={new Date(new Date().getFullYear() + 2, 11)}
                            selected={
                              graduationTo
                                ? new Date(graduationTo + "T00:00:00")
                                : undefined
                            }
                            onSelect={(date) =>
                              setGraduationTo(date ? format(date, "yyyy-MM-dd") : "")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </>
              )}
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

      {/* Bulk AI screening action bar */}
      {selectedIds.size > 0 && (
        <div className="w-full mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 dark:border-orange-900/60 bg-orange-50/70 dark:bg-orange-950/20 px-4 py-3">
          <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#FF6905] px-2 text-xs font-bold text-white">
              {selectedIds.size}
            </span>
            <span className="font-medium">kandidat dipilih untuk AI Screening</span>
            <span className="hidden md:inline text-xs text-slate-500">
              Diproses di background (queue); skor muncul otomatis di kolom AI Score.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-slate-600 dark:text-slate-300"
              onClick={() => setSelectedIds(new Set())}
              disabled={isBulkScreening}
            >
              <X className="w-4 h-4 mr-1" /> Batal pilih
            </Button>
            <Button
              size="sm"
              className="h-9 bg-[#FF6905] hover:bg-[#e35e04] text-white font-medium px-4 shadow-sm"
              onClick={handleBulkScreening}
              disabled={isBulkScreening}
            >
              {isBulkScreening ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Screening AI ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      {/* Full-Width Data Table Container */}
      <div className="w-full flex flex-col flex-1 bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap min-w-[1000px]">
            <thead className="bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">
              <tr className="text-[12px] font-semibold tracking-wider text-slate-500 uppercase">
                <th className="pl-5 pr-2 py-4 w-12">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Checkbox
                            aria-label="Pilih semua kandidat di halaman ini"
                            checked={allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false}
                            onCheckedChange={toggleSelectAllOnPage}
                            className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 data-[state=indeterminate]:bg-orange-500 data-[state=indeterminate]:border-orange-500"
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        Pilih semua di halaman ini untuk AI Screening
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </th>
                <th className="px-6 py-4 w-40">ID Code</th>
                <th className="px-6 py-4 md:sticky md:left-0 z-20 bg-slate-50 dark:bg-slate-900  border-slate-200 dark:border-slate-800">
                  Name
                </th>
                <th className="px-6 py-4">Contact Detail</th>
                <th className="px-6 py-4">Demographics</th>
                <th className="px-6 py-4">Address</th>
                <th className="px-6 py-4">Education Background</th>
                {isFtap && (
                  <>
                    <th className="px-6 py-4">TOEFL / IELTS</th>
                    <th className="px-6 py-4">Tanggal Lulus</th>
                    <th className="px-6 py-4">Tempat Interview</th>
                    <th className="px-6 py-4">No. KTP</th>
                  </>
                )}
                <th className="px-6 py-4">Applied Job</th>
                <th className="px-6 py-4">Status Apply</th>
                <th className="px-6 py-4">Tanggal Daftar</th>
                <th className="px-6 py-4">Checked</th>
                <th className="px-6 py-4">Lolos Seleksi</th>
                <th className="px-6 py-4">AI CV Score</th>
                <th className="px-6 py-4">AI Interview Score</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={isFtap ? 19 : 15}>
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
                  <td colSpan={isFtap ? 19 : 15}>
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
                      className={cn(
                        "group hover:bg-orange-50 dark:hover:bg-slate-800/80 transition-colors",
                        selectedIds.has(Number(candidate.CanId)) && "bg-orange-50/60 dark:bg-slate-800/60",
                      )}
                    >
                      <td className="pl-5 pr-2 py-4 w-12">
                        <Checkbox
                          aria-label={`Pilih ${candidate.CanName ?? candidate.CanId} untuk AI Screening`}
                          checked={selectedIds.has(Number(candidate.CanId))}
                          onCheckedChange={() => toggleSelect(Number(candidate.CanId))}
                          className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                        />
                      </td>
                      <td className="px-6 py-4 w-40 text-xs font-mono font-medium text-slate-500">
                        {candidate.CanCode || "-"}
                      </td>
                      <td className="px-6 py-4 md:sticky md:left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-orange-50 dark:group-hover:bg-slate-800  border-slate-100 dark:border-slate-800">
                        <div
                          className="flex items-center gap-3 hover:cursor-pointer"
                          onClick={() =>
                            navigate(`/admin/candidates/${candidate.CanId}`, { state: navState })
                          }
                        >
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
                          <span className="group/copy flex items-center gap-2 text-[13px] font-medium text-slate-600 dark:text-slate-300 max-w-[220px]">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span
                              className="truncate"
                              title={candidate.CanEmail || ""}
                            >
                              {candidate.CanEmail || "-"}
                            </span>
                            {candidate.CanEmail && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(
                                    candidate.CanEmail!,
                                    `email-${candidate.CanId}`,
                                    "Email",
                                  );
                                }}
                                className="ml-auto p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-orange-500 transition-colors shrink-0"
                                title="Copy email"
                              >
                                {copiedKey === `email-${candidate.CanId}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </span>
                          <span className="group/copy flex items-center gap-2 text-xs font-medium text-slate-500 max-w-[220px]">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span
                              className="truncate"
                              title={candidate.CanHandphone || ""}
                            >
                              {candidate.CanHandphone || "-"}
                            </span>
                            {isFtap &&
                              candidate.ftap?.whatsapp_number &&
                              candidate.ftap.whatsapp_number !== candidate.CanHandphone && (
                                <span
                                  className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0"
                                  title={`WhatsApp: ${candidate.ftap.whatsapp_number}`}
                                >
                                  WA {candidate.ftap.whatsapp_number}
                                </span>
                              )}
                            {candidate.CanHandphone && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(
                                    candidate.CanHandphone!,
                                    `phone-${candidate.CanId}`,
                                    "Phone",
                                  );
                                }}
                                className="ml-auto p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-orange-500 transition-colors shrink-0"
                                title="Copy phone"
                              >
                                {copiedKey === `phone-${candidate.CanId}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
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
                        {getAddressCity(candidate) !== "-" ||
                        getAddressDetail(candidate) !== "-" ? (
                          <button
                            type="button"
                            onClick={() => setAddressModalCandidate(candidate)}
                            className="group/addr flex items-start gap-2 max-w-[260px] text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-orange-100/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
                            title="Klik untuk lihat detail alamat"
                          >
                            <MapPin className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-slate-700 dark:text-slate-200 text-[13px] group-hover/addr:text-orange-600 dark:group-hover/addr:text-orange-400 transition-colors">
                                {getAddressCity(candidate)}
                              </span>
                              {getAddressDetail(candidate) !== "-" && (
                                <span className="text-xs font-medium text-slate-500 whitespace-normal line-clamp-2">
                                  {getAddressDetail(candidate)}
                                </span>
                              )}
                            </div>
                          </button>
                        ) : (
                          <span className="text-sm font-medium text-slate-400 italic">
                            No Data
                          </span>
                        )}
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
                      {isFtap && (
                        <>
                          {/* TOEFL / IELTS: jenis + skor + status memenuhi ambang FTAP */}
                          <td className="px-6 py-4">
                            {candidate.ftap?.toefl_score !== null &&
                            candidate.ftap?.toefl_score !== undefined ? (
                              <div className="flex flex-col items-start gap-1">
                                <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                                  {getToeflType(candidate.ftap.toefl_type)?.label ||
                                    candidate.ftap.toefl_type ||
                                    "TOEFL"}{" "}
                                  <span className="text-orange-600 dark:text-orange-400">
                                    {formatToeflScore(candidate.ftap.toefl_score)}
                                  </span>
                                </span>
                                {candidate.ftap.toefl_passed === true ? (
                                  <Badge className="h-5 px-1.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 border-transparent dark:bg-emerald-500/15 dark:text-emerald-300">
                                    Memenuhi syarat
                                  </Badge>
                                ) : candidate.ftap.toefl_passed === false ? (
                                  <Badge className="h-5 px-1.5 text-[10px] font-semibold bg-rose-100 text-rose-700 border-transparent dark:bg-rose-500/15 dark:text-rose-300">
                                    Di bawah ambang
                                  </Badge>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-sm font-medium text-slate-400 italic">No Data</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {(() => {
                              const lastEdu =
                                candidate.education?.find((e) => e.FgLastEdu === "Y") ||
                                candidate.education?.[0];
                              const value =
                                candidate.ftap?.graduation_date ||
                                lastEdu?.EduGraduate ||
                                lastEdu?.EduPeriodEnd ||
                                null;
                              return value ? (
                                <span className="flex items-center gap-2 text-[13px] font-medium text-slate-700 dark:text-slate-200">
                                  <GraduationCap className="w-4 h-4 text-orange-400 shrink-0" />
                                  {/^\d{4}$/.test(String(value)) ? value : formatShortDate(String(value))}
                                </span>
                              ) : (
                                <span className="text-sm font-medium text-slate-400 italic">No Data</span>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4">
                            {candidate.ftap?.interview_location ? (
                              <span
                                className="flex items-center gap-2 text-[13px] font-medium text-slate-700 dark:text-slate-200"
                                title={`${candidate.ftap.interview_location} (tidak dapat diganti)`}
                              >
                                <MapPin className="w-4 h-4 text-orange-400 shrink-0" />
                                {candidate.ftap.interview_location.replace(/^Recruitment FTAP\s*-\s*/i, "")}
                              </span>
                            ) : (
                              <span className="text-sm font-medium text-slate-400 italic">No Data</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {getKtpNumber(candidate) ? (
                              <span className="group/copy flex items-center gap-2 text-[13px] font-mono font-medium text-slate-700 dark:text-slate-200">
                                <IdCard className="w-4 h-4 text-slate-400 shrink-0" />
                                {getKtpNumber(candidate)}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopy(getKtpNumber(candidate), `ktp-${candidate.CanId}`, "No. KTP");
                                  }}
                                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-orange-500 transition-colors shrink-0"
                                  title="Copy no. KTP"
                                >
                                  {copiedKey === `ktp-${candidate.CanId}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </span>
                            ) : (
                              <span className="text-sm font-medium text-slate-400 italic">No Data</span>
                            )}
                          </td>
                        </>
                      )}
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
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                            {candidate.CanEntryDate
                              ? format(
                                  new Date(candidate.CanEntryDate),
                                  "dd MMM yyyy",
                                )
                              : "-"}
                          </span>
                          {candidate.CanEntryDate && (
                            <span className="text-[11px] text-slate-400">
                              {format(
                                new Date(candidate.CanEntryDate),
                                "HH:mm",
                              )}
                            </span>
                          )}
                        </div>
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
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => handlePassedClick(candidate)}
                                  disabled={loadingPassed[candidate.CanId]}
                                  className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all",
                                    candidate.is_passed
                                      ? "border-orange-200 bg-[#FF6905] text-white hover:bg-[#e35e04] dark:border-orange-700"
                                      : "border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
                                    loadingPassed[candidate.CanId] &&
                                      "opacity-50 cursor-not-allowed",
                                  )}
                                >
                                  {loadingPassed[candidate.CanId] ? (
                                    <span className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                                  ) : candidate.is_passed ? (
                                    <Trophy className="w-3.5 h-3.5" />
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  )}
                                  {candidate.is_passed
                                    ? "Lolos Seleksi"
                                    : "Tandai Lolos"}
                                </button>
                              </TooltipTrigger>
                              {candidate.is_passed && (
                                <TooltipContent className="bg-slate-900 text-white border-slate-800 p-2 text-xs max-w-xs">
                                  <div className="flex flex-col gap-1">
                                    <p className="font-semibold text-orange-400">
                                      Ditandai oleh:
                                    </p>
                                    <p className="break-all">
                                      {candidate.passed_by || "-"}
                                    </p>
                                    <p className="font-semibold text-orange-400 mt-1">
                                      Pada:
                                    </p>
                                    <p>
                                      {candidate.passed_at
                                        ? format(
                                            new Date(candidate.passed_at),
                                            "PPP p",
                                          )
                                        : "-"}
                                    </p>
                                    {candidate.passed_note && (
                                      <>
                                        <p className="font-semibold text-orange-400 mt-1">
                                          Catatan:
                                        </p>
                                        <p className="whitespace-pre-wrap">
                                          {candidate.passed_note}
                                        </p>
                                      </>
                                    )}
                                  </div>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                          {candidate.is_passed && candidate.passed_note && (
                            <span
                              className="max-w-[220px] truncate text-[11px] font-medium text-slate-500 dark:text-slate-400"
                              title={candidate.passed_note}
                            >
                              {candidate.passed_note}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <AiScoreChip
                          latest={candidate.latest_ai_screening}
                          latestDone={candidate.latest_done_ai_screening}
                          onClick={() =>
                            navigate(`/admin/candidates/${candidate.CanId}`, { state: navState })
                          }
                        />
                      </td>
                      <td className="px-6 py-4">
                        <InterviewScoreChip
                          latest={candidate.latest_ai_interview}
                          latestCompleted={candidate.latest_completed_ai_interview}
                          onClick={() =>
                            navigate(`/admin/candidates/${candidate.CanId}#ai-interview`, { state: navState })
                          }
                        />
                      </td>
                      <td className="px-6 py-4 text-right flex gap-2 justify-end">
                        <Button
                          size="sm"
                          className="h-9 px-4 rounded-xl font-medium bg-white text-slate-700 border border-slate-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 shadow-sm transition-all"
                          onClick={() =>
                            navigate(`/admin/candidates/${candidate.CanId}`, { state: navState })
                          }
                        >
                          <Eye className="w-4 h-4 mr-2" /> Details
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 px-4 rounded-xl font-medium border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-slate-700 shadow-sm transition-all"
                          disabled={!!loadingDownload[candidate.CanId]}
                          onClick={async () => {
                            setLoadingDownload((prev) => ({
                              ...prev,
                              [candidate.CanId]: true,
                            }));
                            try {
                              const { blob, filename } =
                                await downloadCandidateAttachments(
                                  candidate.CanId,
                                );

                              // Create download link
                              const url = window.URL.createObjectURL(
                                new Blob([blob], { type: "application/zip" }),
                              );
                              const link = document.createElement("a");
                              link.href = url;
                              link.download = filename;
                              document.body.appendChild(link);
                              link.click();
                              link.remove();
                              window.URL.revokeObjectURL(url);

                              toast.success("Attachment berhasil didownload");
                            } catch (err: any) {
                              // Handle JSON error wrapped in Blob
                              const blob = err.response?.data;
                              if (blob instanceof Blob) {
                                try {
                                  const text = await blob.text();
                                  const json = JSON.parse(text);
                                  // If no attachments, show info instead of error
                                  if (
                                    json.message?.includes(
                                      "No attachments found",
                                    ) ||
                                    json.message?.includes(
                                      "No attachment binaries available",
                                    )
                                  ) {
                                    toast.info(
                                      json.message ||
                                        "Kandidat tidak memiliki attachment",
                                    );
                                  } else {
                                    toast.error(
                                      json.message ||
                                        "Gagal download attachment",
                                    );
                                  }
                                } catch {
                                  toast.error("Gagal download attachment");
                                }
                              } else {
                                toast.error("Gagal download attachment");
                              }
                            } finally {
                              setLoadingDownload((prev) => ({
                                ...prev,
                                [candidate.CanId]: false,
                              }));
                            }
                          }}
                        >
                          {loadingDownload[candidate.CanId] ? (
                            <span className="flex items-center">
                              <span className="animate-spin mr-2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></span>
                              Loading...
                            </span>
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" /> Download
                              Attachment
                            </>
                          )}
                        </Button>
                        {isAdmin && (
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
                                    res.message ||
                                      "Berhasil apply ke SQL Server",
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
                                <Download className="w-4 h-4 mr-2" /> Apply ke
                                SQL Server
                              </>
                            )}
                          </Button>
                        )}
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

      {/* Export candidates dialog (date range) */}
      <Dialog
        open={exportDialogOpen}
        onOpenChange={(open) => {
          if (!loadingExport) setExportDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-orange-500" />
              Export Candidates
            </DialogTitle>
            <DialogDescription>
              Export hasil filter yang sedang aktif (tanpa batasan tanggal), atau
              pilih satu bulan penuh berdasarkan tanggal daftar.
            </DialogDescription>
          </DialogHeader>

          {/* Opsi 1: export persis hasil filter/sourcing yang tampil di layar */}
          <div className="rounded-xl border border-orange-200 dark:border-orange-900/60 bg-orange-50/60 dark:bg-orange-950/20 p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Filter className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  Export hasil filter aktif
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeFilterCount > 0
                    ? `${activeFilterCount} filter aktif · ${totalItems} kandidat akan diexport.`
                    : isFtap
                      ? `Tanpa filter · seluruh ${totalItems} kandidat FTAP akan diexport.`
                      : `Belum ada filter aktif · seluruh ${totalItems} kandidat akan diexport.`}
                </p>
              </div>
            </div>
            <Button
              onClick={handleExportFiltered}
              disabled={loadingExport || totalItems === 0}
              className="bg-orange-500 hover:bg-orange-600 text-white w-full"
            >
              {loadingExport ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Export {totalItems} kandidat sesuai filter
            </Button>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            atau per bulan
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          {(() => {
            // exportMonth is "yyyy-MM"; split into year & month index (0-based).
            const [selectedYear, selectedMonthNo] = exportMonth
              .split("-")
              .map((v) => Number(v));
            const selectedMonthIdx = selectedMonthNo - 1;

            const now = new Date();
            const thisYear = now.getFullYear();
            const thisMonthIdx = now.getMonth();

            const monthShort = Array.from({ length: 12 }, (_, i) =>
              format(new Date(2000, i, 1), "MMM"),
            );

            const selectMonth = (monthIdx: number) => {
              setExportMonth(
                `${pickerYear}-${String(monthIdx + 1).padStart(2, "0")}`,
              );
              setMonthPickerOpen(false);
            };

            return (
              <div className="flex flex-col gap-2 py-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Month
                </label>
                <Popover
                  open={monthPickerOpen}
                  onOpenChange={setMonthPickerOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                      {format(
                        new Date(selectedYear, selectedMonthIdx, 1),
                        "MMMM yyyy",
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="start">
                    {/* Year navigation */}
                    <div className="flex items-center justify-between mb-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setPickerYear((y) => y - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-semibold">
                        {pickerYear}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={pickerYear >= thisYear}
                        onClick={() => setPickerYear((y) => y + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Month grid */}
                    <div className="grid grid-cols-3 gap-2">
                      {monthShort.map((name, i) => {
                        const isFuture =
                          pickerYear > thisYear ||
                          (pickerYear === thisYear && i > thisMonthIdx);
                        const isSelected =
                          pickerYear === selectedYear &&
                          i === selectedMonthIdx;
                        return (
                          <Button
                            key={name}
                            type="button"
                            variant={isSelected ? "default" : "ghost"}
                            disabled={isFuture}
                            onClick={() => selectMonth(i)}
                            className={cn(
                              "h-9 text-sm font-normal",
                              isSelected &&
                                "bg-orange-500 hover:bg-orange-600 text-white",
                            )}
                          >
                            {name}
                          </Button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            );
          })()}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExportDialogOpen(false)}
              disabled={loadingExport}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={loadingExport}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {loadingExport ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" /> Export bulan ini
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!passedDialogCandidate}
        onOpenChange={(open) => {
          if (!open) {
            setPassedDialogCandidate(null);
            setPassedNoteInput("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tandai Lolos Seleksi</DialogTitle>
            <DialogDescription>
              {passedDialogCandidate ? (
                <>
                  Tandai{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {passedDialogCandidate.CanName}
                  </span>{" "}
                  sebagai lolos seleksi. Catatan bersifat opsional (maks 1000
                  karakter).
                </>
              ) : (
                "Tandai candidate sebagai lolos seleksi."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Catatan (opsional)
            </label>
            <Textarea
              value={passedNoteInput}
              onChange={(e) => setPassedNoteInput(e.target.value)}
              placeholder="Contoh: Lolos tahap interview HR, jadwalkan psikotes"
              maxLength={1000}
              rows={4}
            />
            <span className="text-[11px] text-slate-400 self-end">
              {passedNoteInput.length} / 1000
            </span>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPassedDialogCandidate(null);
                setPassedNoteInput("");
              }}
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmMarkPassed}
              disabled={
                !!passedDialogCandidate &&
                !!loadingPassed[passedDialogCandidate.CanId]
              }
              className="bg-[#FF6905] hover:bg-[#e35e04] text-white"
            >
              Tandai Lolos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Address Detail Modal */}
      <Dialog
        open={!!addressModalCandidate}
        onOpenChange={(open) => {
          if (!open) setAddressModalCandidate(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-500" />
              Detail Alamat
            </DialogTitle>
            <DialogDescription>
              {addressModalCandidate?.CanName || "Kandidat"}
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const addr = addressModalCandidate?.addresses?.[0];
            if (!addr) {
              return (
                <p className="text-sm text-slate-400 italic">
                  Tidak ada data alamat.
                </p>
              );
            }
            const resCity = [addr.CanResCityName, addr.CanResStateName]
              .filter(Boolean)
              .join(", ");
            const oriCity = [addr.CanOriCityName, addr.CanOriStateName]
              .filter(Boolean)
              .join(", ");
            const hasOri = Boolean(addr.CanOriAddress || addr.CanOriCityName);
            return (
              <div className="flex flex-col gap-6 max-h-[60vh] overflow-y-auto">
                {/* Residential Address */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Residential Address (Current)
                  </h4>
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    {resCity || "Unknown City"}
                  </p>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 whitespace-pre-wrap break-words">
                    {addr.CanResAddress || "-"}
                    {addr.CanResZipCode && (
                      <span className="block mt-1 font-semibold text-slate-600 dark:text-slate-400">
                        Zip Code: {addr.CanResZipCode}
                      </span>
                    )}
                  </p>
                  {addr.CanResPhone && (
                    <p className="text-sm text-slate-500 mt-2 flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5" /> Residential Phone:{" "}
                      <span className="font-semibold">{addr.CanResPhone}</span>
                    </p>
                  )}
                </div>

                {/* Original / ID Address */}
                {hasOri && (
                  <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                      Original / ID Address
                    </h4>
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      {oriCity || "Unknown City"}
                    </p>
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 whitespace-pre-wrap break-words">
                      {addr.CanOriAddress || "-"}
                      {addr.CanOriZipCode && (
                        <span className="block mt-1 font-semibold text-slate-600 dark:text-slate-400">
                          Zip Code: {addr.CanOriZipCode}
                        </span>
                      )}
                    </p>
                    {addr.CanOriPhone && (
                      <p className="text-sm text-slate-500 mt-2 flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5" /> Original Phone:{" "}
                        <span className="font-semibold">{addr.CanOriPhone}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CandidatesPage;
