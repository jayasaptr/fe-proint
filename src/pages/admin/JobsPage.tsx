import { TablePagination } from "@/components/TablePagination";
import { Button } from '@/components/ui/button';
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from "@/components/ui/textarea";
import { useDebounce } from '@/hooks/useDebounce';
import type { User } from '@/lib/api/users';
import { cn } from "@/lib/utils";
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import { format } from 'date-fns';
import { CalendarIcon, Download, Edit, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { exportApplications } from '../../lib/api/applications';
import type { Job } from '../../lib/api/jobs';
import { createJob, deleteJob, getJobs, updateJob } from '../../lib/api/jobs';

const JobsPage: React.FC = () => {
  const { currentUser } = useOutletContext<{ currentUser: User }>();
  const isAdmin = currentUser?.roles?.includes('Admin');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const filters: any = { page, per_page: perPage };
      if (debouncedSearchTerm) filters.title = debouncedSearchTerm;
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (locationFilter && locationFilter !== 'all') filters.location = locationFilter;
      if (siteFilter && siteFilter !== 'all') filters.site = siteFilter;

      const response = await getJobs(filters);
      setJobs(response.data);
      setTotalPages(response.pagination.total_pages);
    } catch (err: any) {
      console.error(err.response?.data?.message || err.message || 'Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [page, perPage, debouncedSearchTerm, statusFilter, locationFilter, siteFilter]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this job?')) {
      try {
        await deleteJob(id);
        fetchJobs(); // Refresh the list
      } catch (err: any) {
         alert(err.response?.data?.message || err.message || 'Failed to delete job');
      }
    }
  };

  const handleExportApplications = async (jobId: string, jobTitle: string) => {
    try {
      const blob = await exportApplications({ job_id: jobId });
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const safeTitle = jobTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.setAttribute('download', `applications_${safeTitle}_${timestamp}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to export applications');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Open':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full dark:bg-green-900/30 dark:text-green-400">Open</span>;
      case 'Closed':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full dark:bg-red-900/30 dark:text-red-400">Closed</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-800 rounded-full dark:bg-slate-800 dark:text-slate-300">Draft</span>;
    }
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentJob, setCurrentJob] = useState<Partial<Job>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenModal = (job?: Job) => {
    if (job) {
      // Convert dates to YYYY-MM-DD for input type="date" handling
      setCurrentJob({
        ...job,
        start_date: job.start_date ? job.start_date.split('T')[0] : '',
        end_date: job.end_date ? job.end_date.split('T')[0] : '',
      });
    } else {
      setCurrentJob({ status: 'Open' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentJob({});
  };

  const handleSaveJob = async () => {
    setIsSubmitting(true);
    try {
      const payload: Partial<Job> = {
        ...currentJob,
        start_date: currentJob.start_date || null,
        end_date: currentJob.end_date || null,
      };

      if (currentJob.id) {
        await updateJob(currentJob.id, payload);
      } else {
        await createJob(payload);
      }
      handleCloseModal();
      fetchJobs();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to save job');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Jobs Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage recruitment job postings</p>
        </div>
        <Button className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl" onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Add New Job
        </Button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search jobs..."
                className="pl-9 h-10 rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-orange-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px] h-10 rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-full sm:w-[150px] h-10 rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
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
              <SelectTrigger className="w-full sm:w-[150px] h-10 rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
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
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-medium tracking-wider">Job Title</th>
                <th className="px-6 py-4 font-medium tracking-wider">Level</th>
                <th className="px-6 py-4 font-medium tracking-wider">Location</th>
                <th className="px-6 py-4 font-medium tracking-wider">Site</th>
                <th className="px-6 py-4 font-medium tracking-wider">Status</th>
                <th className="px-6 py-4 font-medium tracking-wider">Date</th>
                {isAdmin && <th className="px-6 py-4 font-medium tracking-wider">Created By</th>}
                {isAdmin && <th className="px-6 py-4 font-medium tracking-wider">Updated By</th>}
                <th className="px-6 py-4 font-medium tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 7} className="px-6 py-8 text-center text-slate-500">
                    Loading jobs...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 7} className="px-6 py-8 text-center text-slate-500">
                    No jobs found.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className={cn("hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors", job.deleted_at && "opacity-60 bg-slate-50/50 dark:bg-slate-900/50")}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={cn("font-medium", job.deleted_at ? "text-slate-500 line-through dark:text-slate-400" : "text-slate-900 dark:text-white")}>
                          {job.title}
                        </div>
                        {job.deleted_at && (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-200 text-slate-600 rounded dark:bg-slate-700 dark:text-slate-300">
                            Deleted
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{job.level}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{job.location}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{job.site || '-'}</td>
                    <td className="px-6 py-4">{getStatusBadge(job.status)}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      <div className="flex flex-col">
                        {!job.start_date && !job.end_date ? (
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Ongoing</span>
                        ) : (
                          <>
                            <span className="text-xs">Start: {job.start_date ? format(new Date(job.start_date), 'MMM d, yyyy') : '-'}</span>
                            <span className="text-xs text-slate-400">End: {job.end_date ? format(new Date(job.end_date), 'MMM d, yyyy') : '-'}</span>
                          </>
                        )}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4">
                        {job.created_by ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900 dark:text-white">{job.created_by.name}</span>
                            <span className="text-xs text-slate-500">{job.created_by.roles.join(', ')}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                    )}
                    {isAdmin && (
                      <td className="px-6 py-4">
                        {job.deleted_by ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-red-500">Deleted by:</span>
                            <span className="text-sm font-medium text-slate-900 dark:text-white">{job.deleted_by.name}</span>
                            <span className="text-xs text-slate-500">{format(new Date(job.deleted_at!), 'MMM d, yyyy')}</span>
                          </div>
                        ) : job.updated_by ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900 dark:text-white">{job.updated_by.name}</span>
                            <span className="text-xs text-slate-500">{job.updated_by.roles.join(', ')}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenModal(job)} className="cursor-pointer" disabled={!!job.deleted_at}>
                            <Edit className="mr-2 h-4 w-4 text-slate-400" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExportApplications(job.id, job.title)} className="cursor-pointer">
                            <Download className="mr-2 h-4 w-4 text-slate-400" />
                            Export Applications
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(job.id)} className="cursor-pointer text-red-600 focus:text-red-600" disabled={!!job.deleted_at}>
                            <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Placeholder */}
        <TablePagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{currentJob.id ? 'Edit Job' : 'Add New Job'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Job Title</Label>
              <Input
                id="title"
                value={currentJob.title || ''}
                onChange={(e) => setCurrentJob({ ...currentJob, title: e.target.value })}
                placeholder="e.g. Senior Software Engineer"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="level">Level</Label>
                <Select
                  value={currentJob.level || ''}
                  onValueChange={(val) => setCurrentJob({ ...currentJob, level: val })}
                >
                  <SelectTrigger id="level" className="w-full">
                    <SelectValue placeholder="Select Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Level">All Level</SelectItem>
                    <SelectItem value="Operator">Operator</SelectItem>
                    <SelectItem value="Mechanic">Mechanic</SelectItem>
                    <SelectItem value="Non Staff">Non Staff</SelectItem>
                    <SelectItem value="Foreman/Officer">Foreman/Officer</SelectItem>
                    <SelectItem value="Supervisor">Supervisor</SelectItem>
                    <SelectItem value="Superintendent">Superintendent</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="General Manager">General Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Location</Label>
                <Select
                  value={currentJob.location || ''}
                  onValueChange={(val) => setCurrentJob({ ...currentJob, location: val })}
                >
                  <SelectTrigger id="location" className="w-full">
                    <SelectValue placeholder="Select Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Location">All Location</SelectItem>
                    <SelectItem value="Jakarta">Jakarta</SelectItem>
                    <SelectItem value="Kalimantan Selatan">Kalimantan Selatan</SelectItem>
                    <SelectItem value="Kalimantan Timur">Kalimantan Timur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="site">Site</Label>
                <Select
                  value={currentJob.site || ''}
                  onValueChange={(val) => setCurrentJob({ ...currentJob, site: val })}
                >
                  <SelectTrigger id="site" className="w-full">
                    <SelectValue placeholder="Select Site" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACP">ACP</SelectItem>
                    <SelectItem value="BCP">BCP</SelectItem>
                    <SelectItem value="BPN">Balikpapan</SelectItem>
                    <SelectItem value="JKT">JKT</SelectItem>
                    <SelectItem value="KCP">KCP</SelectItem>
                    <SelectItem value="SCP">SCP</SelectItem>
                    <SelectItem value="SSCP">SSCP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={currentJob.description || ''}
                onChange={(e) => setCurrentJob({ ...currentJob, description: e.target.value })}
                placeholder="Job description..."
                className="min-h-[100px]"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="requirements">Requirements</Label>
              <div className="ckeditor-container bg-white text-slate-900 rounded-md overflow-hidden border border-slate-200 dark:border-slate-700">
                <CKEditor
                  editor={ClassicEditor as any}
                  config={{
                    toolbar: [
                      'heading',
                      '|',
                      'bold',
                      'italic',
                      'bulletedList',
                      'numberedList',
                      '|',
                      'outdent',
                      'indent',
                      '|',
                      'insertTable',
                      '|',
                      'undo',
                      'redo'
                    ]
                  }}
                  data={currentJob.requirements || ''}
                  onChange={(_event: any, editor: any) => {
                    const data = editor.getData();
                    setCurrentJob({ ...currentJob, requirements: data });
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="start_date">Start Date</Label>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="start_date"
                        variant={"outline"}
                        className={cn(
                          "flex-1 justify-start text-left font-normal",
                          !currentJob.start_date && "text-slate-500"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {currentJob.start_date ? format(new Date(currentJob.start_date), "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={currentJob.start_date ? new Date(currentJob.start_date) : undefined}
                        onSelect={(date) => setCurrentJob({ ...currentJob, start_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {currentJob.start_date && (
                    <Button variant="ghost" size="icon" onClick={() => setCurrentJob({ ...currentJob, start_date: '' })} title="Clear date">
                      <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end_date">End Date</Label>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="end_date"
                        variant={"outline"}
                        className={cn(
                          "flex-1 justify-start text-left font-normal",
                          !currentJob.end_date && "text-slate-500"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {currentJob.end_date ? format(new Date(currentJob.end_date), "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={currentJob.end_date ? new Date(currentJob.end_date) : undefined}
                        onSelect={(date) => setCurrentJob({ ...currentJob, end_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                        disabled={(date) =>
                          currentJob.start_date
                            ? date < new Date(new Date(currentJob.start_date).setHours(0, 0, 0, 0))
                            : date < new Date(new Date().setHours(0, 0, 0, 0))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {currentJob.end_date && (
                    <Button variant="ghost" size="icon" onClick={() => setCurrentJob({ ...currentJob, end_date: '' })} title="Clear date">
                      <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={currentJob.status}
                onValueChange={(val: any) => setCurrentJob({ ...currentJob, status: val })}
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  {currentJob.status === 'Closed' && (
                    <SelectItem value="Closed" disabled>Closed</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button onClick={handleSaveJob} disabled={isSubmitting} className="bg-orange-500 hover:bg-orange-600 text-white">
              {isSubmitting ? 'Saving...' : 'Save Job'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JobsPage;
