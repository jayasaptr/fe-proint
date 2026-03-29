import { TablePagination } from '@/components/TablePagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/useDebounce';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getCandidates, type Candidate, postApplyToSqlServer } from '@/lib/api/candidates';
import { Eye, Search, Users, User, Activity, Filter, Download, Mail, Phone, Award, BriefcaseBusiness } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// --- Formatter Helpers ---
const formatGender = (value?: string | null) => {
  if (!value) return '-';
  if (value === 'M') return 'Male';
  if (value === 'F') return 'Female';
  return value;
};

const getLastEducation = (candidate: Candidate) => {
  if (!candidate.education || candidate.education.length === 0) {
    return '-';
  }

  const lastEdu = candidate.education.find((item) => item.FgLastEdu === 'Y') || candidate.education[0];
  const levelName = lastEdu.education_level?.EduLvlName || lastEdu.education_level?.EduLvlCode || '-';
  const major = lastEdu.EduMjrName || '-';

  if (levelName === '-' && major === '-') return '-';
  if (major === '-') return levelName;
  if (levelName === '-') return major;
  return `${levelName} • ${major}`;
};

const getJobExpectedName = (item: any) => 
  item?.vacant_position?.VacantPositionName || item?.vacancy_information?.vacant_position?.name || item?.vacancy_information?.vacant_position?.VacantPositionName || item?.position?.PosName || item?.vacancy_information?.position?.name || item?.vacancy_information?.position?.PosName || item?.OtherPosName || item?.job_title?.name || item?.OtherJobTtlName || '-';

const getPrimaryExpectedJob = (candidate: Candidate) => {
  if (!candidate.job_expected || candidate.job_expected.length === 0) return null;
  const priorityJob = candidate.job_expected.find((j: any) => String(j.Priority) === '1');
  return priorityJob || candidate.job_expected[0];
};

// --- Main Page Component ---
const CandidatesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const {
    data: candidatesResponse,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ['candidates', debouncedSearch, page],
    queryFn: () => getCandidates({ search: debouncedSearch, page }),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (error) {
      const err = error as any;
      toast.error(err?.response?.data?.message || 'Failed to fetch candidates');
    }
  }, [error]);

  const candidates = candidatesResponse?.success ? candidatesResponse.data?.data || [] : [];
  const totalPages = Math.max(1, candidatesResponse?.data?.last_page || 1);
  const totalItems = candidatesResponse?.data?.total || 0;

  // State loading per kandidat
  const [loadingApply, setLoadingApply] = useState<{ [canId: number]: boolean }>({});

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] min-h-screen bg-slate-50 dark:bg-slate-950 animate-in fade-in duration-700">
      
      {/* Compact Full-Width Header */}
      <div className="bg-white dark:bg-slate-900 border-slate-50 rounded-xl dark:border-slate-800 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm z-30">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 stroke-[2px]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">Candidate</h1>
            <p className="text-[13px] font-medium text-slate-500 mt-0.5 max-w-sm truncate">
              {totalItems} active records synced
              {isFetching && <span className="ml-2 animate-pulse text-orange-500">(Refetching...)</span>}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-[350px] group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
            <Input
              placeholder="Search by name, code, email..."
              className="pl-10 h-11 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus-visible:ring-2 focus-visible:ring-orange-500 transition-all font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" className="h-11 px-4 rounded-xl border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 sm:flex flex-1 sm:flex-none font-medium shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800">
              <Filter className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Filters</span>
            </Button>
            <Button className="h-11 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-orange-500 dark:hover:bg-orange-600 dark:text-white font-medium border-0 shadow-lg shadow-slate-900/10 dark:shadow-orange-500/20 sm:flex flex-1 sm:flex-none">
              <Download className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Full-Width Data Table Container */}
      <div className="flex-1 w-full overflow-hidden flex flex-col items-center">
        {/* We limit the max inner width extremely generously to maintain readability but utilize large monitors */}
        <div className="w-full h-full overflow-auto bg-white dark:bg-slate-900 flex flex-col">
          <table className="w-full text-left whitespace-nowrap min-w-[1000px]">
            <thead className="sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md z-20 border-b border-slate-200 dark:border-slate-800">
              <tr className="text-[12px] font-semibold tracking-wider text-slate-500 uppercase">
                <th className="px-6 py-4">ID Code</th>
                <th className="px-6 py-4">Candidate Profile</th>
                <th className="px-6 py-4">Contact Detail</th>
                <th className="px-6 py-4">Demographics</th>
                <th className="px-6 py-4">Education Background</th>
                <th className="px-6 py-4">Applied Job</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                   <td colSpan={7}>
                      <div className="flex flex-col items-center justify-center gap-4 py-24">
                        <Activity className="w-8 h-8 text-orange-500 animate-pulse" />
                        <p className="text-sm font-semibold text-slate-400 tracking-wider uppercase">Fetching Records...</p>
                      </div>
                   </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                   <td colSpan={7}>
                      <div className="flex flex-col items-center justify-center gap-3 py-24">
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-2">
                           <Search className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="font-semibold text-slate-700 dark:text-slate-200 text-lg">No matches found</p>
                        <p className="text-slate-500 text-sm font-medium">We couldn't find any candidate matching "{searchTerm}".</p>
                      </div>
                   </td>
                </tr>
              ) : (
                candidates.map((candidate) => {
                  const dob = candidate.CanDateBirth ? candidate.CanDateBirth.split(' ')[0] : '-';
                  return (
                    <tr key={candidate.CanId} className="group hover:bg-orange-50/50 dark:hover:bg-slate-800/80 transition-colors">
                      <td className="px-6 py-4 text-xs font-mono font-medium text-slate-500">
                        {candidate.CanCode || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden">
                             {candidate.photos?.[0]?.can_photo_base64 ? (
                               <img src={candidate.photos[0].can_photo_base64.startsWith('data:image') ? candidate.photos[0].can_photo_base64 : `data:image/jpeg;base64,${candidate.photos[0].can_photo_base64}`} alt={candidate.CanName} className="w-full h-full object-cover" />
                             ) : (
                               <User className="w-5 h-5 text-slate-400" />
                             )}
                           </div>
                           <div className="flex flex-col">
                             <span className="font-medium text-slate-900 dark:text-slate-100 text-[14px] group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                               {candidate.CanName || '-'}
                             </span>
                             {candidate.FgFreshGrad === 'Y' && (
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
                             <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {candidate.CanEmail || '-'}
                           </span>
                           <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
                             <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {candidate.CanHandphone || '-'}
                           </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-1.5">
                           <Badge variant="outline" className="border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium px-2 py-0">
                             {formatGender(candidate.CanSex)}
                           </Badge>
                           <span className="text-xs font-medium text-slate-500 ml-1">{dob}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getLastEducation(candidate) !== '-' ? (
                          <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200 text-[13px]">
                             <Award className="w-4 h-4 text-orange-400 shrink-0" />
                             <span className="truncate max-w-[250px]">{getLastEducation(candidate)}</span>
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-slate-400 italic">No Data</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const primaryJob = getPrimaryExpectedJob(candidate);
                          const jobCount = candidate.job_expected?.length || 0;
                          
                          if (!primaryJob) return <span className="text-sm font-medium text-slate-400 italic">-</span>;
                          return (
                            <div className="flex flex-col gap-1.5">
                               <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200 text-[13px] max-w-[200px]">
                                 <BriefcaseBusiness className="w-4 h-4 text-orange-400 shrink-0" />
                                 <span className="truncate" title={getJobExpectedName(primaryJob)}>{getJobExpectedName(primaryJob)}</span>
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
                      <td className="px-6 py-4 text-right flex gap-2 justify-end">
                        <Button
                          size="sm"
                          className="h-9 px-4 rounded-xl font-medium bg-white text-slate-700 border border-slate-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 shadow-sm transition-all"
                          onClick={() => navigate(`/admin/candidates/${candidate.CanId}`)}
                        >
                          <Eye className="w-4 h-4 mr-2" /> Details
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 px-4 rounded-xl font-medium border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-green-50 hover:text-green-600 hover:border-green-200 dark:hover:bg-slate-700 shadow-sm transition-all"
                          disabled={!!loadingApply[candidate.CanId]}
                          onClick={async () => {
                            setLoadingApply((prev) => ({ ...prev, [candidate.CanId]: true }));
                            try {
                              const res = await postApplyToSqlServer(candidate.CanId);
                              if (res.success) {
                                toast.success(res.message || 'Berhasil apply ke SQL Server');
                              } else {
                                toast.error(res.message || 'Gagal apply ke SQL Server');
                              }
                            } catch (err) {
                              toast.error('Gagal apply ke SQL Server');
                            } finally {
                              setLoadingApply((prev) => ({ ...prev, [candidate.CanId]: false }));
                            }
                          }}
                        >
                          {loadingApply[candidate.CanId] ? (
                            <span className="flex items-center"><span className="animate-spin mr-2 w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full"></span>Loading...</span>
                          ) : (
                            <><Download className="w-4 h-4 mr-2" /> Apply ke SQL Server</>
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
      </div>

      {/* Full-Width Footer Pagination */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 flex items-center justify-between shrink-0">
         <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 hidden sm:inline-block">End of Current Results</span>
         <TablePagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

    </div>
  );
};

export default CandidatesPage;
