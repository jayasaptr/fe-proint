import { TablePagination } from '@/components/TablePagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getCandidates, type Candidate } from '@/lib/api/candidates';
import { Eye, Search } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
  const gpa = lastEdu.EduGrade ? ` (GPA ${lastEdu.EduGrade})` : '';

  if (levelName === '-' && major === '-') {
    return '-';
  }

  if (major === '-') {
    return `${levelName}${gpa}`;
  }

  if (levelName === '-') {
    return `${major}${gpa}`;
  }

  return `${levelName} - ${major}${gpa}`;
};

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
    queryFn: () =>
      getCandidates({
        search: debouncedSearch,
        page,
      }),
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Candidate List
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Data kandidat dari endpoint lokal recruitment
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari nama, kode, email, atau telepon kandidat..."
              className="pl-9 h-10 rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-orange-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-medium tracking-wider whitespace-nowrap">Code</th>
                <th className="px-6 py-4 font-medium tracking-wider whitespace-nowrap">Name</th>
                <th className="px-6 py-4 font-medium tracking-wider whitespace-nowrap">Email</th>
                <th className="px-6 py-4 font-medium tracking-wider whitespace-nowrap">Phone</th>
                <th className="px-6 py-4 font-medium tracking-wider whitespace-nowrap">Gender</th>
                <th className="px-6 py-4 font-medium tracking-wider whitespace-nowrap">Date Birth</th>
                <th className="px-6 py-4 font-medium tracking-wider whitespace-nowrap">Last Education</th>
                <th className="px-6 py-4 font-medium tracking-wider whitespace-nowrap text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                    Loading candidates...
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                    Candidate tidak ditemukan.
                  </td>
                </tr>
              ) : (
                candidates.map((candidate) => (
                  <tr key={candidate.CanId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">{candidate.CanCode || '-'}</td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">{candidate.CanName || '-'}</td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{candidate.CanEmail || '-'}</td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">{candidate.CanHandphone || '-'}</td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatGender(candidate.CanSex)}</td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {candidate.CanDateBirth ? candidate.CanDateBirth.split(' ')[0] : '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{getLastEducation(candidate)}</td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => navigate(`/admin/candidates/${candidate.CanId}`)}
                      >
                        <Eye className="w-4 h-4" />
                        Detail
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          Total kandidat: {totalItems} {isFetching ? '| Updating...' : ''}
        </div>

        <TablePagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
};

export default CandidatesPage;
