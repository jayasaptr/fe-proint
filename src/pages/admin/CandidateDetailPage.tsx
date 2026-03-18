import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { downloadCandidateDocument, getCandidateById } from '@/lib/api/candidates';
import { ArrowLeft, BriefcaseBusiness, CreditCard, Download, FileText, Mail, MapPin, Phone, User } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

const formatGender = (value?: string | null) => {
  if (!value) return '-';
  if (value === 'M') return 'Male';
  if (value === 'F') return 'Female';
  return value;
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const normalized = value.replace('T', ' ');
  const dateOnly = normalized.split(' ')[0];
  return dateOnly || value;
};

const formatCurrency = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  const amount = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(amount)) {
    return String(value);
  }

  return `Rp ${amount.toLocaleString('id-ID')}`;
};

const formatAvailability = (value?: string | null) => {
  if (!value) return '-';
  if (value === 'I') return 'Immediate';
  return value;
};

const decodeHtml = (value?: string | null) => {
  if (!value || typeof document === 'undefined') return value || '-';
  const txt = document.createElement('textarea');
  txt.innerHTML = value;
  return txt.value || '-';
};

const getJobExpectedName = (item: any) => {
  return (
    item?.vacant_position?.VacantPositionName ||
    item?.vacancy_information?.vacant_position?.name ||
    item?.vacancy_information?.vacant_position?.VacantPositionName ||
    item?.position?.PosName ||
    item?.vacancy_information?.position?.name ||
    item?.vacancy_information?.position?.PosName ||
    item?.OtherPosName ||
    item?.job_title?.name ||
    item?.OtherJobTtlName ||
    '-'
  );
};

const getJobExpectedCode = (item: any) => {
  return (
    item?.vacant_position?.VacantPosCode ||
    item?.vacancy_information?.vacant_position?.code ||
    item?.position?.PosCode ||
    item?.vacancy_information?.position?.code ||
    '-'
  );
};

const getJobExpectedSpecification = (item: any) => {
  return (
    item?.vacant_position?.VacantPosSpec ||
    item?.vacancy_information?.vacant_position?.specification ||
    '-'
  );
};

const getJobExpectedNote = (item: any) => {
  return (
    item?.vacant_position?.VacantNote ||
    item?.vacancy_information?.vacant_position?.note ||
    null
  );
};

const getJobExpectedOrganization = (item: any) => {
  return (
    item?.vacant_position?.organization_recruitment?.OrgRecName ||
    item?.vacant_position?.organization_recruitment?.name ||
    item?.vacancy_information?.organization_recruitment?.OrgRecName ||
    item?.vacancy_information?.organization_recruitment?.name ||
    '-'
  );
};

const DetailRow = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="space-y-1">
    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 wrap-break-word">{value || '-'}</p>
  </div>
);

const CandidateDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isPhotoError, setIsPhotoError] = useState(false);
  const [isPhotoPreviewOpen, setIsPhotoPreviewOpen] = useState(false);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<number | null>(null);

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
  const experiences =
    candidate?.experiences && candidate.experiences.length > 0
      ? candidate.experiences
      : candidate?.work_experiences || [];
  const identities =
    candidate?.identities && candidate.identities.length > 0
      ? candidate.identities
      : candidate?.cards || [];
  const documents = candidate?.documents || [];
  const jobExpected = candidate?.job_expected || [];
  const skills = candidate?.skills || [];
  const languages = candidate?.languages || [];

  const photoSource = useMemo(() => {
    if (!candidate?.photos || candidate.photos.length === 0) {
      return null;
    }

    const defaultPhoto =
      candidate.photos.find((photo) => photo.FgDefault?.toUpperCase() === 'Y') ||
      candidate.photos[0];
    const rawPhoto = defaultPhoto?.can_photo_base64?.replace(/\s+/g, '');

    if (!rawPhoto) {
      return null;
    }

    if (rawPhoto.startsWith('data:image')) {
      return rawPhoto;
    }

    return `data:image/jpeg;base64,${rawPhoto}`;
  }, [candidate?.photos]);

  useEffect(() => {
    setIsPhotoError(false);
  }, [photoSource]);

  const handlePhotoClick = () => {
    if (!photoSource || isPhotoError) {
      return;
    }

    setIsPhotoPreviewOpen(true);
  };

  const handleDownloadDocument = async (docId?: number, fileName?: string | null, dataUrl?: string | null) => {
    if (!candidate || !docId) {
      toast.error('Dokumen tidak valid untuk diunduh.');
      return;
    }

    const safeFileName = fileName || `document-${docId}`;

    if (dataUrl) {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = safeFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    try {
      setDownloadingDocumentId(docId);
      const blob = await downloadCandidateDocument(candidate.CanId, docId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = safeFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`Berhasil download ${safeFileName}`);
    } catch (downloadError) {
      console.error('Failed to download candidate document:', downloadError);
      toast.error(`Gagal download ${safeFileName}`);
    } finally {
      setDownloadingDocumentId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-slate-400 dark:border-t-slate-400 animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading candidate detail...</p>
        </div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <p className="text-lg font-medium text-slate-900 dark:text-slate-100">Candidate not found</p>
        <Button variant="outline" onClick={() => navigate('/admin/candidates')}>
          Back to Candidates
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-16 space-y-6 animate-in fade-in duration-500 w-full pt-4 sm:pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/candidates')}
            className="-ml-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{candidate.CanName}</h1>
              <Badge variant="outline" className="font-mono text-xs">{candidate.CanCode || '-'}</Badge>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Candidate ID: {candidate.CanId} {isFetching ? '| Updating...' : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-base">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <DetailRow label="Full Name" value={candidate.CanName} />
            <DetailRow label="Nickname" value={candidate.CanNickName} />
            <DetailRow label="Front Title" value={candidate.CanFrontTitle} />
            <DetailRow label="End Title" value={candidate.CanEndTitle} />
            <DetailRow label="Email" value={candidate.CanEmail} />
            <DetailRow label="Phone" value={candidate.CanHandphone} />
            <DetailRow label="Gender" value={formatGender(candidate.CanSex)} />
            <DetailRow label="Date Birth" value={formatDate(candidate.CanDateBirth)} />
            <DetailRow label="Birth City" value={candidate.CanCityBirthName || candidate.CanCityBirthId?.toString()} />
            <DetailRow label="Blood Type" value={candidate.CanBloodType} />
            <DetailRow label="Height" value={candidate.CanHeight} />
            <DetailRow label="Weight" value={candidate.CanWeight} />
            <DetailRow label="Religion ID" value={candidate.CanReligionId?.toString()} />
            <DetailRow label="Status" value={candidate.CanStatus} />
            <DetailRow label="Apply Date" value={formatDate(candidate.CanApplyDate)} />
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-base">Quick Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center pb-2">
              <button
                type="button"
                onClick={handlePhotoClick}
                className="w-28 h-28 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center cursor-zoom-in disabled:cursor-not-allowed"
                disabled={!photoSource || isPhotoError}
                aria-label="Preview candidate photo"
              >
                {photoSource && !isPhotoError ? (
                  <img
                    src={photoSource}
                    alt={candidate.CanName}
                    className="w-full h-full object-cover"
                    onError={() => setIsPhotoError(true)}
                  />
                ) : (
                  <User className="w-10 h-10 text-slate-400" />
                )}
              </button>
            </div>
            <div className="flex gap-3">
              <Mail className="w-4 h-4 mt-0.5 text-slate-500" />
              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 break-all">{candidate.CanEmail || '-'}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Phone className="w-4 h-4 mt-0.5 text-slate-500" />
              <div>
                <p className="text-xs text-slate-500">Phone</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{candidate.CanHandphone || '-'}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <MapPin className="w-4 h-4 mt-0.5 text-slate-500" />
              <div>
                <p className="text-xs text-slate-500">Address</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{mainAddress?.CanResAddress || '-'}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <User className="w-4 h-4 mt-0.5 text-slate-500" />
              <div>
                <p className="text-xs text-slate-500">City / Province</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {mainAddress?.CanResCityName || mainAddress?.CanResCityId || '-'} / {mainAddress?.CanResStateName || '-'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <DetailRow label="ZIP" value={mainAddress?.CanResZipCode} />
              <DetailRow label="RT/RW" value={`${mainAddress?.CanResRT || '-'} / ${mainAddress?.CanResRW || '-'}`} />
              <DetailRow label="Village" value={mainAddress?.CanResDesa} />
              <DetailRow label="District ID" value={mainAddress?.CanResKecId} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base">Education</CardTitle>
        </CardHeader>
        <CardContent>
          {education.length === 0 ? (
            <p className="text-sm text-slate-500">No education data.</p>
          ) : (
            <div className="space-y-4">
              {education.map((item, index) => {
                const level = item.education_level?.EduLvlName || item.education_level?.EduLvlCode || '-';
                return (
                  <div
                    key={item.CanEduId || `${item.CanId}-${index}`}
                    className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{level}</p>
                      {item.FgLastEdu === 'Y' && (
                        <Badge variant="secondary" className="text-[10px]">Latest</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <DetailRow label="Major" value={item.EduMjrName} />
                      <DetailRow label="Institution" value={item.EduInsName} />
                      <DetailRow label="City" value={item.EduCityName} />
                      <DetailRow label="Grade" value={item.EduGrade} />
                      <DetailRow label="Period" value={`${item.EduPeriodStart || '-'} - ${item.EduPeriodEnd || '-'}`} />
                      <DetailRow label="Certificate" value={item.FgCertificate} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BriefcaseBusiness className="w-4 h-4 text-slate-500" />
            Job Applied
          </CardTitle>
        </CardHeader>
        <CardContent>
          {jobExpected.length === 0 ? (
            <p className="text-sm text-slate-500">No applied job data.</p>
          ) : (
            <div className="space-y-4">
              {jobExpected.map((item, index) => {
                const jobName = getJobExpectedName(item);
                const jobCode = getJobExpectedCode(item);
                const specification = getJobExpectedSpecification(item);
                const note = getJobExpectedNote(item);
                const organizationName = getJobExpectedOrganization(item);
                const vacancySource = item?.vacancy_information?.source || '-';
                const priority = item?.Priority?.toString() || '-';

                return (
                  <div
                    key={item.CanJobExpectedId || `${jobName}-${index}`}
                    className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 space-y-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{jobName}</p>
                      <Badge variant="secondary" className="text-[10px]">Priority {priority}</Badge>
                      <Badge variant="outline" className="text-[10px]">Source: {vacancySource}</Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <DetailRow label="Vacancy Code" value={jobCode} />
                      <DetailRow label="Vacant Position ID" value={item?.VacantPosId?.toString()} />
                      <DetailRow label="Position ID" value={item?.PositionId?.toString()} />
                      <DetailRow label="Organization Recruitment" value={organizationName} />
                      <DetailRow label="Updated Date" value={formatDate(item?.UpdDate)} />
                      <DetailRow label="Updated By" value={item?.UpdUser} />
                      <DetailRow label="Flag" value={item?.UpdFlag} />
                      <DetailRow label="Other Position Name" value={item?.OtherPosName} />
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Specification</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{specification}</p>
                    </div>

                    {note && note !== '-' && (
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Vacancy Note</p>
                        <div
                          className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap prose prose-slate max-w-none prose-p:my-1 prose-ol:my-1 prose-li:my-0 dark:prose-invert"
                          dangerouslySetInnerHTML={{ __html: decodeHtml(note) }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BriefcaseBusiness className="w-4 h-4 text-slate-500" />
            Experience
          </CardTitle>
        </CardHeader>
        <CardContent>
          {experiences.length === 0 ? (
            <p className="text-sm text-slate-500">No experience data.</p>
          ) : (
            <div className="space-y-4">
              {experiences.map((item, index) => {
                const companyName = item.CompName || item.company_name || item.ExpCompanyName || '-';
                const position = item.JobTtlName || item.position || item.ExpPosition || '-';
                const period =
                  item.job_period_year ||
                  item.ExpPeriod ||
                  `${formatDate(item.JobStart || null)} - ${formatDate(item.JobEnd || null)}`;
                const salary = item.SalaryEnd ?? item.salary ?? item.ExpSalary ?? item.SalaryStart;

                return (
                  <div
                    key={item.CanExpId || `${companyName}-${index}`}
                    className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <DetailRow label="Company" value={companyName} />
                      <DetailRow label="Position" value={position} />
                      <DetailRow label="Period" value={period} />
                      <DetailRow label="Salary" value={formatCurrency(salary)} />
                      <DetailRow label="Phone" value={item.CompPhone} />
                      <DetailRow label="Reason" value={item.TermReason} />
                      <DetailRow label="Present Flag" value={item.FgPresent} />
                      <DetailRow label="Duration" value={`${item.JobPrdYear || '0'} year ${item.JobPrdMonth || '0'} month`} />
                    </div>
                    <DetailRow label="Description" value={item.Description} />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base">Skills & Languages</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Skills</p>
            {skills.length === 0 ? (
              <p className="text-sm text-slate-500">No skills data.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, index) => (
                  <Badge key={`skill-${index}`} variant="secondary">
                    {skill.SkillName || JSON.stringify(skill)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Languages</p>
            {languages.length === 0 ? (
              <p className="text-sm text-slate-500">No language data.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {languages.map((language, index) => (
                  <Badge key={`language-${index}`} variant="secondary">
                    {language.LangName || JSON.stringify(language)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-slate-500" />
            Identity Cards
          </CardTitle>
        </CardHeader>
        <CardContent>
          {identities.length === 0 ? (
            <p className="text-sm text-slate-500">No identity data.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {identities.map((item, index) => {
                const cardType = item.CardTypeName || item.card_type_name || item.CardTypeId || '-';
                const cardNumber = item.CardNumber || item.number || '-';

                return (
                  <div
                    key={`${cardType}-${cardNumber}-${index}`}
                    className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <DetailRow label="Card Type" value={String(cardType)} />
                      <DetailRow label="Card Number" value={cardNumber} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-slate-500">No document data.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.map((doc, index) => {
                const docId = doc.CanDocId;
                const fileName = doc.CanDocFile || `document-${docId || index + 1}`;
                const docDesc = doc.CanDocDesc || 'Document';
                const canDownload = Boolean(doc.has_document || doc.can_doc_data_url || docId);

                return (
                  <div
                    key={`${docId || index}-${fileName}`}
                    className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <DetailRow label="Description" value={docDesc} />
                      <DetailRow label="File Name" value={fileName} />
                      <DetailRow label="Has Document" value={doc.has_document ? 'Yes' : 'No'} />
                      <DetailRow label="Updated Date" value={formatDate(doc.UpdDate)} />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => handleDownloadDocument(docId, fileName, doc.can_doc_data_url)}
                      disabled={!canDownload || downloadingDocumentId === docId}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {downloadingDocumentId === docId ? 'Downloading...' : 'Download Document'}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base">Other Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <DetailRow label="Marital Status ID" value={candidate.CanMaritalStId?.toString()} />
          <DetailRow label="Race ID" value={candidate.CanRaceId?.toString()} />
          <DetailRow label="Citizen ID" value={candidate.CanCitizenId?.toString()} />
          <DetailRow label="Is Foreigner" value={candidate.CanIsFore} />
          <DetailRow label="Source" value={candidate.CanSource} />
          <DetailRow label="Source ID" value={candidate.CanSourceId?.toString()} />
          <DetailRow label="Source Note" value={candidate.CanSourceNote} />
          <DetailRow label="Expected Salary" value={formatCurrency(candidate.CanExpSal)} />
          <DetailRow label="Experience Type" value={candidate.CanExpType} />
          <DetailRow label="Availability" value={formatAvailability(candidate.CanAvailability)} />
          <DetailRow label="Currency ID" value={candidate.CanCurrId?.toString()} />
          <DetailRow label="NPWP" value={candidate.CanNPWP} />
          <DetailRow label="Fresh Graduate Flag" value={candidate.FgFreshGrad} />
          <DetailRow label="Married Date" value={formatDate(candidate.CanMarriedDate)} />
          <DetailRow label="Vacancy ID" value={candidate.CanAdvId?.toString()} />
          <DetailRow label="Organization ID" value={candidate.CanOrgId?.toString()} />
          <DetailRow label="Institution ID" value={candidate.CanInstId?.toString()} />
          <DetailRow label="Institution Name" value={candidate.CanInstName} />
          <DetailRow label="BPJS TK" value={candidate.CanBPJSTKNo} />
          <DetailRow label="BPJS Kesehatan" value={candidate.CanBPJSKesNo} />
          <DetailRow label="Faskes ID" value={candidate.CanFaskesId?.toString()} />
          <DetailRow label="Bank ID" value={candidate.CanBankId?.toString()} />
          <DetailRow label="Bank Name" value={candidate.CanBankName} />
          <DetailRow label="Bank Account" value={candidate.CanBankAcc} />
          <DetailRow label="Reference Type" value={candidate.RefTypeName} />
          <DetailRow label="Reference Type ID" value={candidate.RefTypeId?.toString()} />
          <DetailRow label="Change Flag" value={candidate.FgChanges} />
          <DetailRow label="Candidate Category" value={candidate.FgCanCategory} />
          <DetailRow label="Recruitment Location ID" value={candidate.CanLocRecruitId?.toString()} />
          <DetailRow label="Bank Attach" value={candidate.CanBankAttach} />
          <DetailRow label="Bank Attach File" value={candidate.CanBankAttachFile} />
          <DetailRow label="PPh PTKP" value={candidate.PPhPTKP} />
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base">System Metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <DetailRow label="Entry Date" value={formatDate(candidate.CanEntryDate)} />
          <DetailRow label="Updated Date" value={formatDate(candidate.UpdDate)} />
          <DetailRow label="Updated By" value={candidate.UpdUser} />
        </CardContent>
      </Card>

      <Dialog open={isPhotoPreviewOpen} onOpenChange={setIsPhotoPreviewOpen}>
        <DialogContent className="max-w-3xl p-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          {photoSource ? (
            <img
              src={photoSource}
              alt={`${candidate.CanName} preview`}
              className="w-full max-h-[80vh] object-contain rounded-md"
            />
          ) : (
            <div className="h-60 flex items-center justify-center text-slate-500">Foto tidak tersedia.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CandidateDetailPage;
