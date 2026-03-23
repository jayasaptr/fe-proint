import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { downloadCandidateDocument, getCandidateById } from '@/lib/api/candidates';
import { 
  ArrowLeft, BriefcaseBusiness, CreditCard, Download, FileText, 
  MapPin, Phone, User, GraduationCap, Building2, Languages, 
  Fingerprint, Activity, Award, FileCheck, Building, Calendar, 
  Stethoscope, Printer, Mail, Share2, MoreHorizontal, CheckCircle2, ChevronRight
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

// --- Formatter Helpers ---
const formatGender = (value?: string | null) => {
  if (!value) return '-';
  if (value === 'M') return 'Male';
  if (value === 'F') return 'Female';
  return value;
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const normalized = value.replace('T', ' ');
  return normalized.split(' ')[0] || value;
};

const formatCurrency = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return '-';
  const amount = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(amount)) return String(value);
  return `Rp ${amount.toLocaleString('id-ID')}`;
};

const formatAvailability = (value?: string | null) => {
  if (!value) return '-';
  if (value === 'I') return 'Immediate';
  return value;
};

// --- Extractors & Helpers ---
const decodeHtml = (html: string) => {
  if (!html) return '';
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
};

const getJobExpectedName = (item: any) => 
  item?.vacant_position?.VacantPositionName || item?.vacancy_information?.vacant_position?.name || item?.vacancy_information?.vacant_position?.VacantPositionName || item?.position?.PosName || item?.vacancy_information?.position?.name || item?.vacancy_information?.position?.PosName || item?.OtherPosName || item?.job_title?.name || item?.OtherJobTtlName || '-';

const getJobExpectedCode = (item: any) => 
  item?.vacant_position?.VacantPosCode || item?.vacancy_information?.vacant_position?.code || item?.position?.PosCode || item?.vacancy_information?.position?.code || '-';

const getJobExpectedOrganization = (item: any) => 
  item?.vacant_position?.organization_recruitment?.OrgRecName || item?.vacant_position?.organization_recruitment?.name || item?.vacancy_information?.organization_recruitment?.OrgRecName || item?.vacancy_information?.organization_recruitment?.name || '-';

// --- Reusable Components (SaaS Style) ---
const InfoRow = ({ label, value, highlight = false }: { label: string, value: any, highlight?: boolean }) => (
  <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
    <span className="text-sm text-slate-500 font-medium">{label}</span>
    <span className={`text-sm font-semibold text-right max-w-[60%] truncate ${highlight ? 'text-orange-600 dark:text-orange-400 font-bold' : 'text-slate-800 dark:text-slate-200'}`}>
      {value || '-'}
    </span>
  </div>
);

const SectionBlock = ({ icon: Icon, title, children, action }: { icon: any, title: string, children: React.ReactNode, action?: React.ReactNode }) => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-6">
    <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg">
          <Icon className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
      </div>
      {action && <div>{action}</div>}
    </div>
    <div className="p-6">
      {children}
    </div>
  </div>
);

// --- Main Component ---
const CandidateDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isPhotoError, setIsPhotoError] = useState(false);
  const [isPhotoPreviewOpen, setIsPhotoPreviewOpen] = useState(false);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<number | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['candidate-detail', id],
    queryFn: () => getCandidateById(id as string),
    enabled: Boolean(id),
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (error) {
      const err = error as any;
      toast.error(err?.response?.data?.message || 'Failed to fetch candidate detail');
    }
  }, [error]);

  const candidate = data?.success ? data.data : null;
  const mainAddress = candidate?.addresses?.[0];
  const education = candidate?.education || [];
  const experiences = candidate?.experiences?.length > 0 ? candidate.experiences : candidate?.work_experiences || [];
  const identities = candidate?.identities?.length > 0 ? candidate.identities : candidate?.cards || [];
  const documents = candidate?.documents || [];
  const jobExpected = candidate?.job_expected || [];
  const skills = candidate?.skills || [];
  const languages = candidate?.languages || [];

  const photoSource = useMemo(() => {
    if (!candidate?.photos || candidate.photos.length === 0) return null;
    const defaultPhoto = candidate.photos.find((photo: any) => photo.FgDefault?.toUpperCase() === 'Y') || candidate.photos[0];
    const rawPhoto = defaultPhoto?.can_photo_base64?.replace(/\s+/g, '');
    if (!rawPhoto) return null;
    return rawPhoto.startsWith('data:image') ? rawPhoto : `data:image/jpeg;base64,${rawPhoto}`;
  }, [candidate?.photos]);

  useEffect(() => setIsPhotoError(false), [photoSource]);

  const handleDownloadDocument = async (docId?: number, fileName?: string | null, dataUrl?: string | null) => {
    if (!candidate || !docId) return toast.error('Dokumen tidak valid untuk diunduh.');
    const safeFileName = fileName || `document-${docId}`;

    if (dataUrl) {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = safeFileName;
      link.click();
      return;
    }

    try {
      setDownloadingDocumentId(docId);
      const blob = await downloadCandidateDocument(candidate.CanId, docId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = safeFileName;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success(`Berhasil download ${safeFileName}`);
    } catch (downloadError) {
      toast.error(`Gagal download ${safeFileName}`);
    } finally {
      setDownloadingDocumentId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[80vh] flex-col gap-4">
        <div className="w-12 h-12 border-4 border-slate-200 dark:border-slate-800 border-t-orange-600 rounded-full animate-spin" />
        <p className="text-slate-500 font-medium">Gathering candidate intel...</p>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center">
        <div className="p-6 bg-slate-100 dark:bg-slate-900 rounded-full mb-2">
          <User className="w-12 h-12 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Candidate Not Found</h2>
        <p className="text-slate-500 max-w-sm">The candidate data may have been removed or the ID is invalid.</p>
        <Button className="mt-4" onClick={() => navigate('/admin/candidates')}>Return to List</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 font-sans animate-in fade-in duration-700">
      
      {/* Enterprise Sweeping Hero Header */}
      <div className="relative bg-slate-900 dark:bg-black pt-8 pb-32 sm:pb-40 border-b border-orange-500/20">
        {/* Subtle glowing mesh backgrond */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-orange-600/20 rounded-full blur-[80px]" />
          <div className="absolute top-1/2 left-0 w-72 h-72 bg-amber-600/10 rounded-full blur-[60px]" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Top Navbar items */}
          <div className="flex justify-between items-center mb-10">
            <Button 
              variant="outline" 
              onClick={() => navigate('/admin/candidates')} 
              className="bg-white/10 hover:bg-white/20 text-white border-0 shadow-none backdrop-blur-md rounded-xl font-bold"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-md rounded-xl hidden sm:flex font-bold">
                <Share2 className="w-4 h-4 mr-2" /> Share
              </Button>
              <Button className="bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 border-0">
                <Printer className="w-4 h-4 mr-2" /> Print PDF
              </Button>
            </div>
          </div>

          {/* Header Info Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4">
            <div className="flex-1 md:ml-48 lg:ml-56">
               <div className="flex flex-wrap items-center gap-3 mb-2">
                 <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight tracking-tight">
                   {candidate.CanName}
                 </h1>
                 <Badge className="bg-orange-500/20 text-orange-300 border border-orange-400/30 px-3 py-1 uppercase tracking-widest text-[10px] rounded-full">
                   {candidate.CanStatus || 'New Applicant'}
                 </Badge>
                 {candidate.FgFreshGrad === 'Y' && (
                   <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-3 py-1 uppercase tracking-widest text-[10px] rounded-full">
                     Fresh Graduate
                   </Badge>
                 )}
               </div>
               <p className="text-slate-400 font-medium text-lg mb-4 flex items-center gap-2">
                 <CreditCard className="w-4 h-4" /> ID: {candidate.CanCode || 'Unassigned'}
               </p>
               
               <div className="flex flex-wrap gap-4 sm:gap-6 text-sm">
                 <div className="flex items-center gap-2 text-slate-300">
                   <Mail className="w-4 h-4 text-orange-400" /> {candidate.CanEmail || 'No Email'}
                 </div>
                 <div className="flex items-center gap-2 text-slate-300">
                   <Phone className="w-4 h-4 text-orange-400" /> {candidate.CanHandphone || 'No Phone'}
                 </div>
                 <div className="flex items-center gap-2 text-slate-300">
                   <MapPin className="w-4 h-4 text-orange-400" /> {mainAddress?.CanResCityName || 'No Location'}{mainAddress?.CanResStateName ? `, ${mainAddress.CanResStateName}` : ''}
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area overlapping the header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 sm:-mt-28 relative z-20">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          
          {/* Left Column (3 Col Span) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Avatar block */}
            <div className="flex flex-col items-center sm:items-start md:ml-4 lg:ml-6 mb-6">
              <div 
                className="w-40 h-40 sm:w-44 sm:h-44 rounded-3xl bg-white dark:bg-slate-800 shadow-xl shadow-slate-900/10 p-2 border border-slate-200 dark:border-slate-700 cursor-pointer overflow-hidden relative group"
                onClick={() => (!!photoSource && !isPhotoError) && setIsPhotoPreviewOpen(true)}
              >
                <div className="absolute inset-0 bg-orange-500 opacity-0 group-hover:opacity-10 transition-opacity z-10" />
                {photoSource && !isPhotoError ? (
                  <img src={photoSource} alt={candidate.CanName} className="w-full h-full object-cover rounded-[1.25rem]" onError={() => setIsPhotoError(true)} />
                ) : (
                  <div className="w-full h-full bg-slate-100 dark:bg-slate-900 rounded-[1.25rem] flex items-center justify-center">
                    <User className="w-16 h-16 text-slate-300" />
                  </div>
                )}
              </div>
            </div>

            {/* Demographics Card */}
            <SectionBlock icon={User} title="Demographics">
              <div className="flex flex-col text-slate-600 dark:text-slate-300">
                <InfoRow label="Date of Birth" value={formatDate(candidate.CanDateBirth)} />
                <InfoRow label="Birth Place" value={candidate.CanCityBirthName || candidate.CanCityBirthId?.toString()} />
                <InfoRow label="Gender" value={formatGender(candidate.CanSex)} />
                <InfoRow label="Religion" value={candidate.CanReligionId?.toString()} />
                <InfoRow label="Marital Status" value={candidate.CanMaritalStId?.toString()} />
                <InfoRow label="Blood Type" value={candidate.CanBloodType} />
                <InfoRow label="Availability" value={formatAvailability(candidate.CanAvailability)} />
                <InfoRow label="Expected Salary" value={formatCurrency(candidate.CanExpSal)} highlight />
              </div>
            </SectionBlock>

            {/* Address */}
            <SectionBlock icon={MapPin} title="Address Information">
              {mainAddress ? (
                <div className="flex flex-col gap-6">
                  {/* Residential Address */}
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Residential Address (Current)</h4>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{mainAddress.CanResCityName || 'Unknown City'}{mainAddress.CanResStateName ? `, ${mainAddress.CanResStateName}` : ''}</p>
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                      {mainAddress.CanResAddress || '-'}
                      {mainAddress.CanResZipCode && <span className="block mt-1 font-semibold text-slate-600 dark:text-slate-400">Zip Code: {mainAddress.CanResZipCode}</span>}
                    </p>
                    {mainAddress.CanResPhone && (
                      <p className="text-sm text-slate-500 mt-2 flex items-center gap-2">
                         <Phone className="w-3.5 h-3.5" /> Residential Phone: <span className="font-semibold">{mainAddress.CanResPhone}</span>
                      </p>
                    )}
                  </div>
                  
                  {/* Original / Identity Address */}
                  {(mainAddress.CanOriAddress || mainAddress.CanOriCityName) && (
                    <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Original / ID Address</h4>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{mainAddress.CanOriCityName || 'Unknown City'}{mainAddress.CanOriStateName ? `, ${mainAddress.CanOriStateName}` : ''}</p>
                      <p className="text-sm text-slate-500 mt-2 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                        {mainAddress.CanOriAddress || '-'}
                        {mainAddress.CanOriZipCode && <span className="block mt-1 font-semibold text-slate-600 dark:text-slate-400">Zip Code: {mainAddress.CanOriZipCode}</span>}
                      </p>
                      {mainAddress.CanOriPhone && (
                        <p className="text-sm text-slate-500 mt-2 flex items-center gap-2">
                           <Phone className="w-3.5 h-3.5" /> Original Phone: <span className="font-semibold">{mainAddress.CanOriPhone}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">No detailed address provided.</p>
              )}
            </SectionBlock>

            {/* Identifications */}
            <SectionBlock icon={Fingerprint} title="Identifications">
              {identities.length === 0 ? <p className="text-sm text-slate-400 italic">No identity data.</p> : (
                <div className="flex flex-col gap-3">
                  {identities.map((item: any, i: number) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="overflow-hidden pr-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.CardTypeName || item.card_type_name}</p>
                        <p className="font-mono font-bold text-slate-700 dark:text-slate-300 mt-0.5 truncate">{item.CardNumber || item.number || '-'}</p>
                      </div>
                      <CreditCard className="w-5 h-5 text-slate-300 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </SectionBlock>
            
            {/* Skills & Languages */}
            <SectionBlock icon={Languages} title="Competencies">
              <div className="mb-5">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Professional Skills</h4>
                {skills.length === 0 ? <p className="text-sm text-slate-400 italic">No skills listed</p> : (
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill: any, i: number) => (
                       <Badge key={i} className="bg-orange-50 text-orange-700 hover:bg-orange-100 border-0 dark:bg-orange-500/10 dark:text-orange-400 dark:hover:bg-orange-500/20 font-semibold">{skill.SkillName}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Languages</h4>
                {languages.length === 0 ? <p className="text-sm text-slate-400 italic">No languages listed</p> : (
                  <div className="flex flex-wrap gap-2">
                    {languages.map((lang: any, i: number) => (
                       <Badge key={i} variant="outline" className="border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">{lang.LangName}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </SectionBlock>

          </div>

          {/* Main Column (8 Col Span) */}
          <div className="lg:col-span-8 space-y-6 pt-0 sm:pt-32 lg:pt-32">
            
            {/* Applications */}
            {jobExpected.length > 0 && (
              <SectionBlock icon={BriefcaseBusiness} title="Job Applications">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {jobExpected.map((item: any, idx: number) => (
                     <div 
                       key={idx} 
                       onClick={() => setSelectedJob(item)}
                       className="p-4 rounded-xl border-l-[4px] border-l-orange-500 bg-slate-50 dark:bg-slate-800/30 border-y border-r border-slate-100 dark:border-slate-800 hover:shadow-md transition-all group flex flex-col justify-between cursor-pointer hover:bg-orange-50/50 dark:hover:bg-slate-800/80"
                     >
                       <div>
                         <div className="flex justify-between items-start mb-2">
                           <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                             {getJobExpectedName(item)}
                           </h3>
                           <Badge variant="secondary" className="bg-white dark:bg-slate-700 text-[10px] font-bold py-0 h-5">Pri {item?.Priority || '-'}</Badge>
                         </div>
                         <p className="text-sm font-medium text-slate-500 flex items-center gap-1.5 mb-4">
                           <Building2 className="w-3.5 h-3.5" /> {getJobExpectedOrganization(item)}
                         </p>
                       </div>
                       <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 tracking-wider uppercase pt-3 border-t border-slate-200/50 dark:border-slate-700">
                         <span>{getJobExpectedCode(item)}</span>
                         <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity"><span className="hidden sm:inline">Lihat</span> Detail <ChevronRight className="w-3 h-3"/></span>
                       </div>
                     </div>
                  ))}
                </div>
              </SectionBlock>
            )}

            {/* Work Experience */}
            <SectionBlock icon={Activity} title="Work Experience">
               {experiences.length === 0 ? (
                 <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                   <p className="text-slate-500 font-medium">No professional experience recorded.</p>
                 </div>
               ) : (
                 <div className="space-y-6 border-l-2 border-slate-100 dark:border-slate-800 ml-3 pl-6 pb-2 relative">
                    {experiences.map((item: any, idx: number) => {
                      const period = item.job_period_year || item.ExpPeriod || `${formatDate(item.JobStart)} - ${formatDate(item.JobEnd)}`;
                      const salary = item.SalaryEnd ?? item.salary ?? item.ExpSalary ?? item.SalaryStart;
                      return (
                        <div key={idx} className="relative">
                           <span className="absolute -left-[31.5px] top-1.5 w-4 h-4 bg-white dark:bg-slate-900 border-4 border-orange-400 rounded-full" />
                           <div className="flex flex-col md:flex-row md:items-start justify-between gap-2 mb-3">
                             <div>
                               <h3 className="text-xl font-bold text-slate-900 dark:text-white">{item.JobTtlName || item.position || item.ExpPosition || '-'}</h3>
                               <p className="text-base font-medium text-slate-600 dark:text-slate-400">{item.CompName || item.company_name || item.ExpCompanyName || '-'}</p>
                             </div>
                             <span className="inline-flex py-1 px-3 rounded-md bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 text-xs font-bold self-start mt-1 shrink-0">
                               {period}
                             </span>
                           </div>
                           
                           <div className="flex flex-wrap gap-4 mt-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                             <div className="flex-1 min-w-[120px]">
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Duration</p>
                               <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item.JobPrdYear || '0'}y {item.JobPrdMonth || '0'}m</p>
                             </div>
                             <div className="flex-1 min-w-[120px]">
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Final Salary</p>
                               <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(salary)}</p>
                             </div>
                             <div className="w-full">
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Reason for Leaving</p>
                               <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item.TermReason || '-'}</p>
                             </div>
                           </div>

                           {item.Description && (
                             <p className="text-sm text-slate-600 dark:text-slate-400 mt-4 leading-relaxed font-medium">
                               {item.Description}
                             </p>
                           )}
                        </div>
                      );
                    })}
                 </div>
               )}
            </SectionBlock>

            {/* Education History */}
            <SectionBlock icon={GraduationCap} title="Education History">
               {education.length === 0 ? (
                 <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                   <p className="text-slate-500 font-medium">No education data recorded.</p>
                 </div>
               ) : (
                 <div className="space-y-8 border-l-2 border-slate-100 dark:border-slate-800 ml-3 pl-6 pb-2 relative">
                   {education.map((item: any, idx: number) => (
                      <div key={idx} className="relative">
                         <span className="absolute -left-[31.5px] top-1.5 w-4 h-4 bg-white dark:bg-slate-900 border-4 border-emerald-400 rounded-full" />
                         <div className="flex flex-col md:flex-row md:items-start justify-between gap-2 mb-2">
                            <div>
                               <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                 {item.EduInsName || '-'}
                                 {item.FgLastEdu === 'Y' && <Badge className="bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 hover:bg-slate-700 border-0 h-5 px-2 py-0 text-[10px]">Latest</Badge>}
                               </h3>
                               <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                 {item.education_level?.EduLvlName || item.education_level?.EduLvlCode} in {item.EduMjrName || '-'}
                               </p>
                            </div>
                            <span className="inline-flex py-1 px-3 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-xs font-bold self-start mt-1 shrink-0">
                               {item.EduPeriodStart || '-'} — {item.EduPeriodEnd || '-'}
                            </span>
                         </div>
                         <div className="flex items-center gap-4 mt-4 opacity-80">
                           <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
                             <Award className="w-4 h-4 text-slate-400" /> GPA/Grade: {item.EduGrade || '-'}
                           </span>
                           <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
                             <MapPin className="w-4 h-4 text-slate-400" /> {item.EduCityName || '-'}
                           </span>
                         </div>
                      </div>
                   ))}
                 </div>
               )}
            </SectionBlock>

            {/* Attachments */}
            <SectionBlock icon={FileCheck} title="Documents & Attachments">
              {documents.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  <p className="text-slate-500 font-medium">No attached documents.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                   {documents.map((doc: any, i: number) => {
                      const fileName = doc.CanDocFile || `Document ${i + 1}`;
                      const canDownload = Boolean(doc.has_document || doc.can_doc_data_url || doc.CanDocId);
                      const isDownloading = downloadingDocumentId === doc.CanDocId;
                      return (
                        <div key={i} className="flex flex-col p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-orange-400 hover:shadow-md transition-all group">
                           <div className="flex items-center gap-3 mb-4">
                             <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors shrink-0">
                               <FileText className="w-5 h-5"/>
                             </div>
                             <div className="overflow-hidden">
                               <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate" title={doc.CanDocDesc}>{doc.CanDocDesc || 'Document'}</p>
                               <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">{fileName}</p>
                             </div>
                           </div>
                           <Button
                             variant="secondary"
                             size="sm"
                             className="w-full mt-auto font-bold bg-slate-50 hover:bg-orange-50 text-slate-600 hover:text-orange-600 dark:bg-slate-800 dark:hover:bg-orange-900/30 dark:text-slate-300 dark:hover:text-orange-400"
                             onClick={() => handleDownloadDocument(doc.CanDocId, fileName, doc.can_doc_data_url)}
                             disabled={!canDownload || isDownloading}
                           >
                             {isDownloading ? <MoreHorizontal className="w-4 h-4 animate-pulse" /> : <Download className="w-4 h-4" />}
                           </Button>
                        </div>
                      )
                   })}
                 </div>
               )}
            </SectionBlock>

          </div>
        </div>
      </div>

      {/* Photo Preview Modal */}
      <Dialog open={isPhotoPreviewOpen} onOpenChange={setIsPhotoPreviewOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden bg-transparent border-none shadow-none">
          {photoSource && (
            <img src={photoSource} alt="Preview" className="w-full h-auto max-h-[85vh] object-contain rounded-xl shadow-2xl" />
          )}
        </DialogContent>
      </Dialog>

      {/* Job Detail Modal */}
      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0 overflow-hidden flex flex-col max-h-[85vh]">
          {selectedJob && (
             <>
               <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start justify-between gap-4 shrink-0">
                 <div className="flex gap-4">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center shrink-0">
                      <BriefcaseBusiness className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight mb-1">{getJobExpectedName(selectedJob)}</h2>
                      <p className="text-sm font-medium text-slate-500 flex items-center gap-1.5"><Building2 className="w-4 h-4"/> {getJobExpectedOrganization(selectedJob)}</p>
                    </div>
                 </div>
                 <Badge variant="outline" className="text-[10px] font-bold border-slate-200 dark:border-slate-700 text-slate-500 uppercase bg-white dark:bg-slate-800/50">
                   {getJobExpectedCode(selectedJob)}
                 </Badge>
               </div>
               
               <div className="p-6 overflow-y-auto w-full flex-1">
                 <div className="space-y-6">
                    <div>
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Job Specification</h3>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                        {selectedJob.vacant_position?.VacantPosSpec || selectedJob.vacancy_information?.vacant_position?.specification || 'No specification provided.'}
                      </p>
                    </div>
                    {(selectedJob.vacant_position?.VacantNote || selectedJob.vacancy_information?.vacant_position?.note) && (
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 max-w-none">
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Requirements & Description</h3>
                        <div 
                          className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-2 [&>ol]:list-decimal [&>ol]:ml-5 [&>ul]:list-disc [&>ul]:ml-5 [&>div>ol]:list-decimal [&>div>ol]:ml-5 [&>div>ul]:list-disc [&>div>ul]:ml-5"
                          dangerouslySetInnerHTML={{ __html: decodeHtml(String(selectedJob.vacant_position?.VacantNote || selectedJob.vacancy_information?.vacant_position?.note)) }}
                        />
                      </div>
                    )}
                 </div>
               </div>
             </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CandidateDetailPage;
