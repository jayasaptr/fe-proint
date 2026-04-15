import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Search,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import DHImg from "../assets/dh.png";
import HeroImg from "../assets/job.jpg";
import {
  positionAuditService,
  vacancyService,
  type PosAdtGrpDt,
  type PosAdtGrpHd,
  type Vacancy,
} from "../lib/api/vacancies";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { Skeleton } from "@/components/ui/skeleton";

const decodeHTML = (html: string) => {
  if (!html) return "";
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
};

interface PaginationState {
  page: number;
  pages: number;
  total: number;
}

const CareerPage: React.FC = () => {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [pagination, setPagination] = useState<PaginationState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null);
  const [applyingVacancy, setApplyingVacancy] = useState<Vacancy | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);

  // Dynamic Filters Mapping
  const [categories, setCategories] = useState<PosAdtGrpHd[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<PosAdtGrpDt[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [draftCategoryIds, setDraftCategoryIds] = useState<number[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [draftOptionIds, setDraftOptionIds] = useState<number[]>([]);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([]);
  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const res = await positionAuditService.getCategories();
        if (res.success) {
          setCategories(res.data);
        }
      } catch (err) {
        toast.error("Gagal memuat filter kategori");
      } finally {
        setIsLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (draftCategoryIds.length === 0) {
      setCategoryOptions([]);
      setDraftOptionIds([]);
      return;
    }
    const fetchOptions = async () => {
      setIsLoadingOptions(true);
      try {
        const res =
          await positionAuditService.getOptionsByCategory(draftCategoryIds);
        if (res.success) {
          setCategoryOptions(res.data);
        }
      } catch (err) {
        toast.error("Gagal memuat opsi kategori");
      } finally {
        setIsLoadingOptions(false);
      }
    };
    fetchOptions();
  }, [draftCategoryIds]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setItemsPerPage(9);
      } else {
        setItemsPerPage(10);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  const fetchVacancies = useCallback(async () => {
    setIsLoading(true);
    try {
      const apiFilters: any = {
        page: currentPage,
        per_page: itemsPerPage,
        include_relations: true,
      };

      if (searchTerm) apiFilters.search = searchTerm;
      if (selectedOptionIds.length > 0) {
        apiFilters.posadt_grp_id = selectedOptionIds;
      }
      if (selectedCategoryIds.length > 0) {
        apiFilters.posadt_type_id = selectedCategoryIds;
      }

      const response = await vacancyService.getVacancies(apiFilters);
      if (response.success) {
        setVacancies(response.data);
        if (response.pagination) {
          setPagination({
            page: response.pagination.page,
            pages: response.pagination.pages,
            total: response.pagination.total,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch vacancies:", error);
      setVacancies([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    currentPage,
    itemsPerPage,
    searchTerm,
    selectedCategoryIds,
    selectedOptionIds,
  ]);

  const handleSearchSubmit = useCallback(() => {
    const normalizedSearch = searchInput.trim();
    const isSameSearch =
      normalizedSearch === searchTerm &&
      JSON.stringify(draftCategoryIds) ===
        JSON.stringify(selectedCategoryIds) &&
      JSON.stringify(draftOptionIds) === JSON.stringify(selectedOptionIds);

    setCurrentPage(1);
    setSearchTerm(normalizedSearch);
    setSelectedCategoryIds(draftCategoryIds);
    setSelectedOptionIds(draftOptionIds);

    if (currentPage === 1 && isSameSearch) {
      fetchVacancies();
    }
  }, [
    currentPage,
    fetchVacancies,
    searchInput,
    searchTerm,
    draftCategoryIds,
    selectedCategoryIds,
    draftOptionIds,
    selectedOptionIds,
  ]);

  useEffect(() => {
    fetchVacancies();
  }, [fetchVacancies]);

  useEffect(() => {
    window.scrollTo({ top: 300, behavior: "smooth" });
  }, [currentPage]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <HeroBanner />

      <div className="max-w-6xl mx-auto px-4 -mt-8 relative z-10">
        <FilterBar
          searchTerm={searchInput}
          onSearchChange={(v: string) => setSearchInput(v)}
          onSearchSubmit={handleSearchSubmit}
          categories={categories}
          categoryOptions={categoryOptions}
          selectedCategoryIds={draftCategoryIds}
          selectedOptionIds={draftOptionIds}
          onCategoryChange={(vals: string[]) => {
            setDraftCategoryIds(vals.map(Number));
            setDraftOptionIds([]);
          }}
          onOptionChange={(vals: string[]) => {
            setDraftOptionIds(vals.map(Number));
          }}
          isLoadingCategories={isLoadingCategories}
          isLoadingOptions={isLoadingOptions}
        />

        {isLoading ? (
          <SkeletonLoader />
        ) : vacancies.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vacancies.map((vacancy) => (
                <VacancyCard
                  key={vacancy.VacantPosId}
                  vacancy={vacancy}
                  onDetailClick={setSelectedVacancy}
                />
              ))}
            </div>

            {pagination && pagination.pages > 1 && (
              <PaginationNav
                pagination={pagination}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        ) : (
          <EmptyState />
        )}
      </div>

      {selectedVacancy && (
        <JobModal
          vacancy={selectedVacancy}
          onClose={() => setSelectedVacancy(null)}
          onApply={(v) => {
            setSelectedVacancy(null);
            setApplyingVacancy(v);
          }}
        />
      )}

      {applyingVacancy && (
        <DevelopmentNoticeModal
          vacancy={applyingVacancy}
          onClose={() => setApplyingVacancy(null)}
        />
      )}
    </div>
  );
};

// --- Sub-Components ---

const HeroBanner = () => (
  <div className="relative h-87.5 w-full overflow-hidden">
    <img
      src={HeroImg}
      alt="Office"
      className="w-full h-full object-cover"
      width={1200}
      height={350}
      fetchPriority="high"
      decoding="async"
    />
    <div className="absolute inset-0 bg-linear-to-t from-slate-900/90 via-slate-900/40 to-slate-900/40 flex items-end">
      <div className="max-w-6xl mx-auto px-6 pb-16 w-full text-white text-center md:text-left relative z-10">
        <h1 className="text-4xl md:text-5xl font-bold mb-2">
          Build Your Future
        </h1>
        <p className="text-lg text-slate-200 max-w-xl">
          Bergabunglah dengan tim inovatif kami.
        </p>
      </div>
    </div>
  </div>
);

const FilterBar = ({
  searchTerm,
  onSearchChange,
  onSearchSubmit,
  categories,
  categoryOptions,
  selectedCategoryIds,
  selectedOptionIds,
  onCategoryChange,
  onOptionChange,
  isLoadingCategories,
  isLoadingOptions,
}: any) => (
  <Card className="p-2 md:p-1.5 mb-10 shadow-lg border-slate-100 rounded-2xl md:rounded-full bg-white w-full">
    <div className="flex flex-col md:flex-row items-stretch md:items-center divide-y md:divide-y-0 md:divide-x divide-slate-100 md:divide-slate-200">
      <div className="flex-[1.5] flex items-center px-4 py-1 md:py-0">
        <Search className="text-slate-400 size-5 shrink-0" />
        <Input
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSearchSubmit();
            }
          }}
          placeholder="Search for Job Posting"
          className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-slate-700 bg-transparent h-12 px-3 w-full placeholder:text-slate-400 placeholder:font-normal text-sm md:text-base"
        />
      </div>
      <div className="flex-1 flex items-center px-4 py-1 md:py-0 min-w-0">
        <MultiSelect
          options={categories.map((c: any) => ({
            label: c.PosAdtName,
            value: c.PosAdtTypeId.toString(),
          }))}
          selected={(selectedCategoryIds || []).map(String)}
          onChange={onCategoryChange}
          placeholder={isLoadingCategories ? "Memuat..." : "Semua Kategori"}
          disabled={isLoadingCategories}
          maxSelection={2}
        />
      </div>
      <div className="flex-1 flex items-center px-4 py-1 md:py-0 min-w-0">
        <MultiSelect
          options={categoryOptions.map((o: any) => ({
            label: o.PosAdtGrpName,
            value: o.PosAdtGrpId.toString(),
          }))}
          selected={(selectedOptionIds || []).map(String)}
          onChange={onOptionChange}
          placeholder={isLoadingOptions ? "Memuat..." : "Semua Opsi"}
          disabled={!selectedCategoryIds || selectedCategoryIds.length === 0}
          maxSelection={2}
        />
      </div>
      <div className="px-3 md:px-0 md:pl-2 shrink-0 pt-3 md:pt-0 pb-1 md:pb-0">
        <Button
          type="button"
          onClick={onSearchSubmit}
          className="w-full md:w-32 h-12 rounded-xl md:rounded-full font-bold bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white shadow-md hover:shadow-lg transition-all text-sm md:text-base"
        >
          Search
        </Button>
      </div>
    </div>
  </Card>
);

const VacancyCard = ({
  vacancy,
  onDetailClick,
}: {
  vacancy: Vacancy;
  onDetailClick: (v: Vacancy) => void;
}) => {
  return (
    <Card className="rounded-2xl shadow-sm hover:shadow-xl transition-all flex flex-col justify-between overflow-hidden">
      <CardHeader className="pb-0">
        <div className="flex justify-between items-start mb-2">
          <div className="bg-white border border-slate-100 rounded-xl shadow-sm flex items-center justify-center w-12 h-12 overflow-hidden shrink-0">
            <img
              src={DHImg}
              alt="DH Logo"
              className="w-full h-full object-contain p-1.5"
            />
          </div>
          <Badge
            variant="secondary"
            className={`bg-green-100 text-green-700 hover:bg-green-100 uppercase text-xs font-bold mt-1 shrink-0`}
          >
            {vacancy.FgActive === "Y" && vacancy.FgShowVacant === "Y"
              ? "Open"
              : vacancy.FgActive === "N"
                ? "Closed"
                : "Draft"}
          </Badge>
        </div>
        <CardTitle className="text-xl text-slate-800">
          {vacancy.VacantPositionName}
        </CardTitle>
        <p className="text-xs text-slate-400 font-mono">
          {vacancy.VacantPosCode}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-500 flex-1 flex flex-col">
        <div className="flex-1 mt-2">
          {vacancy.PosAdtGroups && vacancy.PosAdtGroups.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {vacancy.PosAdtGroups.map((group, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="bg-slate-50 text-slate-600 font-normal"
                >
                  {group.PosAdtGrpName}
                </Badge>
              ))}
            </div>
          )}
          <p
            className="line-clamp-3 text-slate-600 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: decodeHTML(vacancy.VacantPosSpec),
            }}
          />
        </div>
        <div className="space-y-1.5 border-t border-slate-100 pt-3 mt-auto">
          {vacancy.PosAdtGroups?.find(
            (g) => g.PosAdtName.toLowerCase() === "location",
          ) && (
            <p className="flex items-center gap-2 text-slate-500">
              <MapPin size={16} className="text-slate-400" />{" "}
              {
                vacancy.PosAdtGroups?.find(
                  (g) => g.PosAdtName.toLowerCase() === "location",
                )?.PosAdtGrpName
              }
            </p>
          )}
          {vacancy.VacantExpDate && (
            <p className="flex items-center gap-2 text-slate-500">
              <Calendar size={16} className="text-slate-400" /> Batas:{" "}
              {new Date(vacancy.VacantExpDate).toLocaleDateString("id-ID")}
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={() => onDetailClick(vacancy)}
          className="w-full h-12 rounded-xl font-semibold bg-slate-900 hover:bg-primary text-white transition-all text-sm"
        >
          Detail Lowongan
        </Button>
      </CardFooter>
    </Card>
  );
};

const useWindowWidth = () => {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return width;
};

const PaginationNav = ({
  pagination,
  onPageChange,
}: {
  pagination: PaginationState;
  onPageChange: (p: number) => void;
}) => {
  const width = useWindowWidth();
  const isMobile = width < 640; // sm breakpoint
  const isTablet = width < 1024; // lg breakpoint

  const getPageNumbers = (): (number | string)[] => {
    const totalPages = pagination.pages;
    const currentPage = pagination.page;

    // Mobile: show 2 page numbers only
    if (isMobile) {
      if (totalPages <= 2) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }
      if (currentPage >= totalPages) {
        return [totalPages - 1, totalPages];
      }
      return [currentPage, currentPage + 1];
    }

    // Tablet: show fewer pages (max 5 items)
    if (isTablet) {
      if (totalPages <= 3) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }
      if (currentPage <= 2) {
        return [1, 2, 3, "...", totalPages];
      }
      if (currentPage >= totalPages - 1) {
        return [1, "...", totalPages - 2, totalPages - 1, totalPages];
      }
      return [1, "...", currentPage, "...", totalPages];
    }

    // Desktop: full pagination
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 3) {
      return [1, 2, 3, 4, "...", totalPages];
    }

    if (currentPage >= totalPages - 2) {
      return [
        1,
        "...",
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [
      1,
      "...",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "...",
      totalPages,
    ];
  };

  const pages = getPageNumbers();

  return (
    <div className="mt-12 flex justify-center items-center gap-1.5 sm:gap-2 pb-4 px-2">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(pagination.page - 1)}
        disabled={pagination.page <= 1}
        className="rounded-xl border-slate-200 shrink-0 h-9 w-9 sm:h-10 sm:w-10"
      >
        <ChevronLeft size={18} />
      </Button>

      {pages.map((p, i) =>
        typeof p === "number" ? (
          <Button
            key={i}
            variant={pagination.page === p ? "default" : "outline"}
            size="icon"
            onClick={() => onPageChange(p)}
            className={`rounded-xl font-bold shrink-0 h-9 w-9 sm:h-10 sm:w-10 text-sm ${pagination.page === p ? "bg-primary text-primary-foreground shadow-lg hover:bg-primary/90" : "text-slate-600 border-slate-200"}`}
          >
            {p}
          </Button>
        ) : (
          <span
            key={i}
            className="text-slate-400 font-bold shrink-0 px-1 sm:px-2 min-w-4 text-center text-sm"
          >
            ...
          </span>
        ),
      )}

      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(pagination.page + 1)}
        disabled={pagination.page >= pagination.pages}
        className="rounded-xl border-slate-200 shrink-0 h-9 w-9 sm:h-10 sm:w-10"
      >
        <ChevronRight size={18} />
      </Button>
    </div>
  );
};

const EmptyState = () => (
  <Card className="text-center py-20 rounded-3xl border-2 border-dashed border-slate-200 shadow-none bg-white">
    <CardContent className="pt-6">
      <Search size={48} className="mx-auto text-slate-300 mb-4" />
      <h3 className="text-xl font-bold text-slate-800">Tidak ada lowongan</h3>
      <p className="text-slate-500 mt-2">
        Coba ubah filter atau kata kunci pencarian Anda.
      </p>
    </CardContent>
  </Card>
);

const SkeletonLoader = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {[1, 2, 3].map((n) => (
      <Skeleton key={n} className="h-72 rounded-2xl bg-slate-200" />
    ))}
  </div>
);

const DevelopmentNoticeModal = ({
  vacancy,
  onClose,
}: {
  vacancy: Vacancy;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
      <div className="bg-amber-50 border-b border-amber-100 px-6 py-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
          Pemberitahuan
        </p>
        <h3 className="mt-2 text-2xl font-bold text-slate-900">
          Fitur Apply Job Masih Development
        </h3>
      </div>

      <div className="px-6 py-5 space-y-3">
        <p className="text-sm leading-relaxed text-slate-600">
          Fitur apply job untuk lowongan{" "}
          <span className="font-semibold text-slate-900">
            {vacancy.VacantPositionName}
          </span>{" "}
          saat ini masih dalam proses development.
        </p>
        <p className="text-sm leading-relaxed text-slate-600">
          Silakan coba kembali nanti. Untuk sementara, informasi lowongan masih
          dapat dilihat seperti biasa.
        </p>
      </div>

      <div className="px-6 pb-6 flex justify-end">
        <Button
          onClick={onClose}
          className="h-11 rounded-xl bg-slate-900 text-white hover:bg-slate-800 px-6"
        >
          Mengerti
        </Button>
      </div>
    </div>
  </div>
);

const JobModal = ({
  vacancy,
  onClose,
  onApply,
}: {
  vacancy: Vacancy;
  onClose: () => void;
  onApply: (v: Vacancy) => void;
}) => (
  <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
      <div className="bg-primary p-8 relative shrink-0">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-primary-foreground/70 hover:text-primary-foreground"
        >
          <X />
        </button>
        <h2 className="text-2xl font-bold text-primary-foreground mt-4">
          {vacancy.VacantPositionName}
        </h2>
        <p className="text-primary-foreground/80 text-sm mt-2 flex gap-2 flex-wrap">
          {vacancy.PosAdtGroups?.map((group, index) => (
            <span
              key={index}
              className="bg-primary-foreground/20 px-2 py-0.5 rounded text-xs"
            >
              {group.PosAdtName}: {group.PosAdtGrpName}
            </span>
          ))}
        </p>
      </div>
      <div className="p-8 overflow-y-auto flex-1">
        {vacancy.VacantPosSpec && (
          <>
            <h4 className="font-bold mb-2 flex items-center gap-2 text-slate-800">
              Deskripsi
            </h4>
            <div
              className="text-slate-600 leading-relaxed prose prose-sm max-w-none mb-4"
              dangerouslySetInnerHTML={{
                __html: decodeHTML(vacancy.VacantPosSpec),
              }}
            />
          </>
        )}
        {vacancy.VacantNote && (
          <div
            className="text-slate-600 mb-6 leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: decodeHTML(vacancy.VacantNote) }}
          />
        )}
      </div>
      <div className="p-6 bg-slate-50 border-t flex gap-3 shrink-0">
        <Button
          variant="outline"
          onClick={onClose}
          className="flex-1 h-12 rounded-xl font-semibold border-slate-200 hover:bg-slate-100 text-slate-700"
        >
          Tutup
        </Button>
        <Button
          onClick={() => onApply(vacancy)}
          className="flex-2 h-12 bg-primary text-primary-foreground rounded-xl font-semibold shadow-lg hover:bg-primary/90 transition-all"
        >
          Lamar Sekarang
        </Button>
      </div>
    </div>
  </div>
);

export default CareerPage;
