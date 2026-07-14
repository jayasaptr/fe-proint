import { cn } from "@/lib/utils";
import Lottie from "lottie-react";
import { Check, ChevronsUpDown, Loader2, Plus, Trash2, X } from "lucide-react";
import React, { useState } from "react";
import Turnstile from "react-turnstile";
import { toast } from "sonner";
import loadingAnimation from "../assets/loading.json";
import {
  checkApplication,
  getCaptchaConfig,
  submitApplication,
} from "../lib/api/applications";
import { type Vacancy } from "../lib/api/vacancies";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export interface Province {
  code: string;
  name: string;
}

export interface Regency {
  code: string;
  name: string;
}

export interface Question {
  QuestionId: number;
  QTopicId: number;
  QuestCode: string;
  QuestName: string;
  FgAnsMode: string;
  QuestRow: number;
}

export interface QuestionGroup {
  topic: {
    QTopicId: number;
    QTopicCode: string;
    QTopicName: string;
  };
  questions: Question[];
}

export const ApplyJobModal = ({
  vacancy,
  onClose,
}: {
  vacancy: Vacancy;
  onClose: () => void;
}) => {
  const [formData, setFormData] = useState({
    // Personal Information
    full_name: "",
    gender: "",
    birth_city_id: "",
    date_of_birth: "",
    marital_status_id: "",
    blood_type: "",
    email: "",
    race_id: "",

    // Contact Address
    id_card_address: "",
    province_id: "",
    city_id: "",
    zip_code: "",
    mobile_phone: "",

    // Declaration
    is_declared_true: false,
    status_apply: "local",
  });

  const [questionGroups, setQuestionGroups] = useState<QuestionGroup[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<
    Record<number, string>
  >({});
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [turnstileInstance, setTurnstileInstance] = useState<any>(null);

  const [maritalStatuses, setMaritalStatuses] = useState<
    { MaritalStId: number; MaritalSt: string }[]
  >([]);
  const [searchMarital, setSearchMarital] = useState("");
  const [pageMarital, setPageMarital] = useState(1);
  const [hasMoreMarital, setHasMoreMarital] = useState(false);
  const [openMarital, setOpenMarital] = useState(false);
  const [isLoadingMarital, setIsLoadingMarital] = useState(false);

  const [identities, setIdentities] = useState([
    { card_type_id: "", number: "" },
  ]);
  const [cardTypes, setCardTypes] = useState<
    { CardTypeId: number; CardType: string }[]
  >([]);
  const [isLoadingCardTypes, setIsLoadingCardTypes] = useState(false);
  const [educations, setEducations] = useState([
    {
      edu_level_id: "",
      major: "",
      edu_institution_id: "",
      gpa: "",
      is_last_education: true,
    },
  ]);
  const [experiences, setExperiences] = useState([
    { company_name: "", position: "", job_period_year: "", salary: "" },
  ]);
  const [documents, setDocuments] = useState<
    { file: File | null; description: string }[]
  >([{ file: null, description: "" }]);

  const [regencies, setRegencies] = useState<
    { CityId: number; CityCode: string; CityName: string }[]
  >([]);
  const [searchCity, setSearchCity] = useState("");
  const [pageCity, setPageCity] = useState(1);
  const [hasMoreCity, setHasMoreCity] = useState(false);
  const [openCity, setOpenCity] = useState(false);
  const [_selectedProvinceCode, setSelectedProvinceCode] = useState<string>("");
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(
    null,
  );
  const [isLoadingRegencies, setIsLoadingRegencies] = useState(false);

  const [birthCities, setBirthCities] = useState<
    { CityId: number; CityCode: string; CityName: string }[]
  >([]);
  const [searchBirthCity, setSearchBirthCity] = useState("");
  const [pageBirthCity, setPageBirthCity] = useState(1);
  const [hasMoreBirthCity, setHasMoreBirthCity] = useState(false);
  const [openBirthCity, setOpenBirthCity] = useState(false);
  const [isLoadingBirthCities, setIsLoadingBirthCities] = useState(false);

  const [races, setRaces] = useState<{ RaceId: number; Race: string }[]>([]);
  const [searchRace, setSearchRace] = useState("");
  const [pageRace, setPageRace] = useState(1);
  const [hasMoreRace, setHasMoreRace] = useState(false);
  const [openRace, setOpenRace] = useState(false);
  const [isLoadingRaces, setIsLoadingRaces] = useState(false);

  const [captchaSiteKey, setCaptchaSiteKey] = useState<string | null>(null);
  // null = config belum dimuat, true/false = feature flag dari backend
  const [captchaEnabled, setCaptchaEnabled] = useState<boolean | null>(null);

  const [eduLevels, setEduLevels] = useState<
    { EduLvlId: number; EduLvlCode: string; EduLvlName: string }[]
  >([]);
  const [searchEdu, setSearchEdu] = useState("");
  const [pageEdu, setPageEdu] = useState(1);
  const [hasMoreEdu, setHasMoreEdu] = useState(false);
  const [openEduIndex, setOpenEduIndex] = useState<number | null>(null);
  const [isLoadingEduLevels, setIsLoadingEduLevels] = useState(false);

  const [eduInstitutions, setEduInstitutions] = useState<
    { EduInsId: number; EduInsCode: string; EduInsName: string }[]
  >([]);
  const [searchInstitution, setSearchInstitution] = useState("");
  const [pageInstitution, setPageInstitution] = useState(1);
  const [hasMoreInstitution, setHasMoreInstitution] = useState(false);
  const [openInstitutionIndex, setOpenInstitutionIndex] = useState<
    number | null
  >(null);
  const [isLoadingInstitutions, setIsLoadingInstitutions] = useState(false);

  const [provinces, setProvinces] = useState<
    { StateId: number; StateCode: string; StateName: string }[]
  >([]);
  const [searchProvince, setSearchProvince] = useState("");
  const [pageProvince, setPageProvince] = useState(1);
  const [hasMoreProvince, setHasMoreProvince] = useState(false);
  const [openProvince, setOpenProvince] = useState(false);
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const observerMarital = React.useRef<IntersectionObserver | null>(null);
  const lastMaritalElementRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (observerMarital.current) observerMarital.current.disconnect();
      if (isLoadingMarital) return;
      observerMarital.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMoreMarital) {
          setPageMarital((prev) => prev + 1);
        }
      });
      if (node) observerMarital.current.observe(node);
    },
    [isLoadingMarital, hasMoreMarital],
  );

  const observerProvince = React.useRef<IntersectionObserver | null>(null);
  const lastProvinceElementRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (observerProvince.current) observerProvince.current.disconnect();
      if (isLoadingProvinces) return;
      observerProvince.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMoreProvince) {
          setPageProvince((prev) => prev + 1);
        }
      });
      if (node) observerProvince.current.observe(node);
    },
    [isLoadingProvinces, hasMoreProvince],
  );

  const observerCity = React.useRef<IntersectionObserver | null>(null);
  const lastCityElementRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (observerCity.current) observerCity.current.disconnect();
      if (isLoadingRegencies) return;
      observerCity.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMoreCity) {
          setPageCity((prev) => prev + 1);
        }
      });
      if (node) observerCity.current.observe(node);
    },
    [isLoadingRegencies, hasMoreCity],
  );

  const observerEdu = React.useRef<IntersectionObserver | null>(null);
  const lastEduElementRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (observerEdu.current) observerEdu.current.disconnect();
      if (isLoadingEduLevels) return;
      observerEdu.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMoreEdu) {
          setPageEdu((prev) => prev + 1);
        }
      });
      if (node) observerEdu.current.observe(node);
    },
    [isLoadingEduLevels, hasMoreEdu],
  );

  const observerInstitution = React.useRef<IntersectionObserver | null>(null);
  const lastInstitutionElementRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (observerInstitution.current) observerInstitution.current.disconnect();
      if (isLoadingInstitutions) return;
      observerInstitution.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMoreInstitution) {
          setPageInstitution((prev) => prev + 1);
        }
      });
      if (node) observerInstitution.current.observe(node);
    },
    [isLoadingInstitutions, hasMoreInstitution],
  );

  const observerBirthCity = React.useRef<IntersectionObserver | null>(null);
  const lastBirthCityElementRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (observerBirthCity.current) observerBirthCity.current.disconnect();
      if (isLoadingBirthCities) return;
      observerBirthCity.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMoreBirthCity) {
          setPageBirthCity((prev) => prev + 1);
        }
      });
      if (node) observerBirthCity.current.observe(node);
    },
    [isLoadingBirthCities, hasMoreBirthCity],
  );

  const observerRace = React.useRef<IntersectionObserver | null>(null);
  const lastRaceElementRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRace.current) observerRace.current.disconnect();
      if (isLoadingRaces) return;
      observerRace.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMoreRace) {
          setPageRace((prev) => prev + 1);
        }
      });
      if (node) observerRace.current.observe(node);
    },
    [isLoadingRaces, hasMoreRace],
  );

  React.useEffect(() => {
    setPageMarital(1);
    setMaritalStatuses([]);
  }, [searchMarital]);

  React.useEffect(() => {
    const controller = new AbortController();
    setIsLoadingMarital(true);
    const fetchMaritalStatuses = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/maritalstatuses?search=${searchMarital}&page=${pageMarital}`,
          {
            signal: controller.signal,
          },
        );
        if (response.ok) {
          const data = await response.json();
          const newData = data.data || [];
          setMaritalStatuses((prev) => {
            if (pageMarital === 1) return newData;
            const existingIds = new Set(prev.map((i) => i.MaritalStId));
            const uniqueNewData = newData.filter(
              (i: any) => !existingIds.has(i.MaritalStId),
            );
            return [...prev, ...uniqueNewData];
          });
          setHasMoreMarital(data.pagination?.has_next || false);
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Error fetching marital statuses:", error);
        }
      } finally {
        setIsLoadingMarital(false);
      }
    };

    const timer = setTimeout(fetchMaritalStatuses, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchMarital, pageMarital]);

  React.useEffect(() => {
    getCaptchaConfig()
      .then((res) => {
        // Feature flag: ikuti nilai `enabled` dari backend, jangan hardcode.
        const enabled = res.success && res.data.enabled === true;
        setCaptchaEnabled(enabled);
        setCaptchaSiteKey(enabled ? res.data.site_key : null);
      })
      .catch((error) => {
        // Jika config gagal dimuat, jangan blokir pelamar selamanya —
        // anggap captcha off; backend tetap memvalidasi bila memang aktif.
        console.error(error);
        setCaptchaEnabled(false);
        setCaptchaSiteKey(null);
      });
  }, []);

  React.useEffect(() => {
    const fetchCardTypes = async () => {
      setIsLoadingCardTypes(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/cardtypes`,
        );
        if (response.ok) {
          const data = await response.json();
          setCardTypes(data.data || []);
        }
      } catch (error) {
        console.error("Error fetching card types:", error);
      } finally {
        setIsLoadingCardTypes(false);
      }
    };
    fetchCardTypes();
  }, []);

  React.useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoadingQuestions(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/questions/grouped?topic_id=2,3`,
        );
        if (response.ok) {
          const data = await response.json();
          const groups: QuestionGroup[] = data.data || [];
          setQuestionGroups(groups);
          const initialAnswers: Record<number, string> = {};
          groups.forEach((group) => {
            group.questions.forEach((q) => {
              initialAnswers[q.QuestionId] = "";
            });
          });
          setQuestionAnswers(initialAnswers);
        }
      } catch (error) {
        console.error("Error fetching questions:", error);
      } finally {
        setIsLoadingQuestions(false);
      }
    };
    fetchQuestions();
  }, []);

  React.useEffect(() => {
    setPageRace(1);
    setRaces([]);
  }, [searchRace]);

  React.useEffect(() => {
    const controller = new AbortController();
    setIsLoadingRaces(true);
    const fetchRaces = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/races?search=${searchRace}&page=${pageRace}`,
          {
            signal: controller.signal,
          },
        );
        if (response.ok) {
          const data = await response.json();
          const newData = data.data || [];
          setRaces((prev) => {
            if (pageRace === 1) return newData;
            const existingIds = new Set(prev.map((i) => i.RaceId));
            const uniqueNewData = newData.filter(
              (i: any) => !existingIds.has(i.RaceId),
            );
            return [...prev, ...uniqueNewData];
          });
          setHasMoreRace(
            (data.pagination?.has_next || false) && newData.length > 0,
          );
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Error fetching races:", error);
        }
      } finally {
        setIsLoadingRaces(false);
      }
    };

    const timer = setTimeout(fetchRaces, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchRace, pageRace]);

  React.useEffect(() => {
    setPageBirthCity(1);
    setBirthCities([]);
  }, [searchBirthCity]);

  React.useEffect(() => {
    const controller = new AbortController();
    setIsLoadingBirthCities(true);
    const fetchBirthCities = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/cities?search=${searchBirthCity}&page=${pageBirthCity}`,
          {
            signal: controller.signal,
          },
        );
        if (response.ok) {
          const data = await response.json();
          const newData = data.data || [];
          setBirthCities((prev) => {
            if (pageBirthCity === 1) return newData;
            const existingIds = new Set(prev.map((i) => i.CityId));
            const uniqueNewData = newData.filter(
              (i: any) => !existingIds.has(i.CityId),
            );
            return [...prev, ...uniqueNewData];
          });
          setHasMoreBirthCity(
            (data.pagination?.has_next || false) && newData.length > 0,
          );
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Error fetching birth cities:", error);
        }
      } finally {
        setIsLoadingBirthCities(false);
      }
    };

    const timer = setTimeout(fetchBirthCities, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchBirthCity, pageBirthCity]);

  React.useEffect(() => {
    setPageProvince(1);
    setProvinces([]);
  }, [searchProvince]);

  React.useEffect(() => {
    const controller = new AbortController();
    setIsLoadingProvinces(true);
    const fetchProvinces = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/states?search=${searchProvince}&sort_by=StateName&page=${pageProvince}`,
          {
            signal: controller.signal,
          },
        );
        if (response.ok) {
          const data = await response.json();
          const newData = data.data || [];
          setProvinces((prev) => {
            if (pageProvince === 1) return newData;
            const existingIds = new Set(prev.map((i) => i.StateId));
            const uniqueNewData = newData.filter(
              (i: any) => !existingIds.has(i.StateId),
            );
            return [...prev, ...uniqueNewData];
          });
          setHasMoreProvince(data.pagination?.has_next || false);
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Error fetching provinces:", error);
        }
      } finally {
        setIsLoadingProvinces(false);
      }
    };

    const timer = setTimeout(fetchProvinces, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchProvince, pageProvince]);

  React.useEffect(() => {
    setPageCity(1);
    setRegencies([]);
  }, [searchCity, selectedProvinceId]);

  React.useEffect(() => {
    if (!selectedProvinceId) return;
    const controller = new AbortController();
    setIsLoadingRegencies(true);
    const fetchCities = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/cities?search=${searchCity}&state_id=${selectedProvinceId}&page=${pageCity}`,
          {
            signal: controller.signal,
          },
        );
        if (response.ok) {
          const data = await response.json();
          const newData = data.data || [];
          setRegencies((prev) => {
            if (pageCity === 1) return newData;
            const existingIds = new Set(prev.map((i) => i.CityId));
            const uniqueNewData = newData.filter(
              (i: any) => !existingIds.has(i.CityId),
            );
            return [...prev, ...uniqueNewData];
          });
          setHasMoreCity(data.pagination?.has_next || false);
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Error fetching cities:", error);
        }
      } finally {
        setIsLoadingRegencies(false);
      }
    };

    const timer = setTimeout(fetchCities, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchCity, selectedProvinceId, pageCity]);

  React.useEffect(() => {
    setPageEdu(1);
    setEduLevels([]);
  }, [searchEdu]);

  React.useEffect(() => {
    const controller = new AbortController();
    setIsLoadingEduLevels(true);
    const fetchEduLevels = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/edulevels?search=${searchEdu}&page=${pageEdu}`,
          {
            signal: controller.signal,
          },
        );
        if (response.ok) {
          const data = await response.json();
          const newData = data.data || [];
          setEduLevels((prev) => {
            if (pageEdu === 1) return newData;
            const existingIds = new Set(prev.map((i) => i.EduLvlId));
            const uniqueNewData = newData.filter(
              (i: any) => !existingIds.has(i.EduLvlId),
            );
            return [...prev, ...uniqueNewData];
          });
          setHasMoreEdu(data.pagination?.has_next || false);
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Error fetching edu levels:", error);
        }
      } finally {
        setIsLoadingEduLevels(false);
      }
    };

    const timer = setTimeout(fetchEduLevels, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchEdu, pageEdu]);

  React.useEffect(() => {
    setPageInstitution(1);
    setEduInstitutions([]);
  }, [searchInstitution]);

  React.useEffect(() => {
    const controller = new AbortController();
    setIsLoadingInstitutions(true);
    const fetchInstitutions = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/eduinstitutions?search=${searchInstitution}&page=${pageInstitution}`,
          {
            signal: controller.signal,
          },
        );
        if (response.ok) {
          const data = await response.json();
          const newData = data.data || [];
          setEduInstitutions((prev) => {
            if (pageInstitution === 1) return newData;
            const existingIds = new Set(prev.map((i) => i.EduInsId));
            const uniqueNewData = newData.filter(
              (i: any) => !existingIds.has(i.EduInsId),
            );
            return [...prev, ...uniqueNewData];
          });
          setHasMoreInstitution(
            (data.pagination?.has_next || false) && newData.length > 0,
          );
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Error fetching institutions:", error);
        }
      } finally {
        setIsLoadingInstitutions(false);
      }
    };

    const timer = setTimeout(fetchInstitutions, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchInstitution, pageInstitution]);

  const handleProvinceChange = (stateId: number, stateCode: string) => {
    setSelectedProvinceCode(stateCode);
    setSelectedProvinceId(stateId);

    setFormData((prev) => ({
      ...prev,
      province_id: stateId.toString(),
      city_id: "", // Reset regency when province changes
    }));

    setRegencies([]);
    setSearchCity("");
  };

  const handleRegencyChange = (cityId: number) => {
    setFormData((prev) => ({
      ...prev,
      city_id: cityId.toString(),
    }));
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleQuestionAnswerChange = (questionId: number, value: string) => {
    setQuestionAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleNumericQuestionChange = (
    questionId: number,
    rawInput: string,
  ) => {
    const cleaned = rawInput.replace(/\./g, "");
    if (/^\d*$/.test(cleaned)) {
      setQuestionAnswers((prev) => ({ ...prev, [questionId]: cleaned }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPhotoFile(e.target.files[0]);
    }
  };

  // Add/Remove Helpers
  const addIdentity = () =>
    setIdentities([...identities, { card_type_id: "", number: "" }]);
  const removeIdentity = (index: number) =>
    setIdentities(identities.filter((_, i) => i !== index));

  const addEducation = () => {
    const newEducations = educations.map((e) => ({
      ...e,
      is_last_education: false,
    }));
    setEducations([
      ...newEducations,
      {
        edu_level_id: "",
        major: "",
        edu_institution_id: "",
        gpa: "",
        is_last_education: true,
      },
    ]);
  };
  const removeEducation = (index: number) => {
    const newEducations = educations.filter((_, i) => i !== index);
    if (
      newEducations.length > 0 &&
      !newEducations.some((e) => e.is_last_education)
    ) {
      newEducations[newEducations.length - 1].is_last_education = true;
    }
    setEducations(newEducations);
  };

  const addExperience = () =>
    setExperiences([
      ...experiences,
      { company_name: "", position: "", job_period_year: "", salary: "" },
    ]);
  const removeExperience = (index: number) =>
    setExperiences(experiences.filter((_, i) => i !== index));

  const addDocument = () =>
    setDocuments([...documents, { file: null, description: "" }]);
  const removeDocument = (index: number) =>
    setDocuments(documents.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.marital_status_id) {
      toast.error("Status Pernikahan wajib diisi.");
      return;
    }

    if (!formData.is_declared_true) {
      toast.error("Anda harus menyetujui pernyataan kebenaran data.");
      return;
    }

    if (captchaEnabled && !captchaToken) {
      toast.error("Silakan selesaikan verifikasi Captcha.");
      return;
    }

    if (documents.filter((d) => d.file).length === 0) {
      toast.error("Harap unggah setidaknya satu dokumen (CV).");
      return;
    }

    setIsSubmitting(true);
    try {
      // Pre-submit duplicate check
      try {
        const checkResult = await checkApplication(
          formData.email,
          vacancy.VacantPosId,
        );
        if (checkResult.exists) {
          toast.error("Anda sudah pernah melamar posisi ini.");
          setIsSubmitting(false);
          return;
        }
      } catch (checkError: any) {
        // If check endpoint fails, continue with submission (backend will validate again)
        console.warn(
          "Check application failed, proceeding with submit:",
          checkError,
        );
      }

      const data = new FormData();
      data.append("job_id", vacancy.VacantPosId.toString());
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== "" && value !== undefined && value !== null) {
          data.append(key, value.toString());
        }
      });

      // Append question answers
      const answers = Object.entries(questionAnswers)
        .filter(([, answer]) => answer !== "")
        .map(([questionId, answer]) => {
          const qId = Number(questionId);
          const group = questionGroups.find((g) =>
            g.questions.some((q) => q.QuestionId === qId),
          );
          return {
            qtempid: group?.topic.QTopicId || null,
            question_id: qId,
            answer: answer,
            experience_id: 0,
          };
        });
      if (answers.length > 0) {
        data.append("answers", JSON.stringify(answers));
      }

      if (photoFile) {
        data.append("photo", photoFile);
      }

      data.append(
        "identities",
        JSON.stringify(
          identities
            .filter((i) => i.card_type_id && i.number)
            .map((i) => ({
              card_type_id: Number(i.card_type_id),
              number: i.number,
            })),
        ),
      );
      data.append(
        "educations",
        JSON.stringify(
          educations
            .filter((e) => e.edu_level_id && e.edu_institution_id)
            .map((e) => ({
              edu_level_id: Number(e.edu_level_id),
              edu_institution_id: isNaN(Number(e.edu_institution_id))
                ? e.edu_institution_id
                : Number(e.edu_institution_id),
              major: e.major,
              gpa: e.gpa ? parseFloat(e.gpa) : null,
              is_last_education: e.is_last_education,
            })),
        ),
      );
      data.append(
        "experiences",
        JSON.stringify(
          experiences
            .filter((e) => e.company_name && e.position)
            .map((e) => ({
              company_name: e.company_name,
              position: e.position,
              job_period_year: e.job_period_year,
              salary: e.salary ? parseFloat(e.salary.toString()) : null,
            })),
        ),
      );

      documents.forEach((doc) => {
        if (doc.file) {
          data.append("documents[]", doc.file);
          data.append("document_descriptions[]", doc.description || "Document");
        }
      });

      if (captchaToken) {
        data.append("captcha_token", captchaToken);
      }

      const res = await submitApplication(data);
      if (res.success) {
        toast.success(
          `Lamaran berhasil dikirim, terima kasih!`,
        );
        turnstileInstance?.reset();
        setCaptchaToken(null);
        onClose();
      } else {
        // Handle field-level validation errors
        if (res.errors) {
          Object.entries(res.errors).forEach(([_field, messages]) => {
            messages.forEach((msg) => toast.error(`${msg}`));
          });
        } else {
          toast.error(
            res.message || "Gagal mengirim lamaran. Silakan coba lagi.",
          );
        }
        turnstileInstance?.reset();
        setCaptchaToken(null);
      }
    } catch (error: any) {
      const responseData = error.response?.data;
      if (responseData?.errors) {
        // Show individual field errors from 422 response
        Object.entries(responseData.errors).forEach(([, messages]) => {
          (messages as string[]).forEach((msg) => toast.error(msg));
        });
      } else {
        toast.error(
          responseData?.message ||
            "Terjadi kesalahan sistem saat menghubungi server.",
        );
      }
      turnstileInstance?.reset();
      setCaptchaToken(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {isSubmitting && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center animate-in fade-in">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 max-w-[280px] animate-in zoom-in-95">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <Lottie animationData={loadingAnimation} loop={true} />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-800 tracking-wide">
                MENGIRIM LAMARAN
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Mohon tunggu sebentar...
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
        <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
          <div className="bg-primary p-6 relative shrink-0">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-primary-foreground/70 hover:text-primary-foreground"
            >
              <X />
            </button>
            <h2 className="text-xl font-bold text-primary-foreground mt-2">
              Lamar: {vacancy.VacantPositionName}
            </h2>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            <form id="apply-form" onSubmit={handleSubmit} className="space-y-8">
              {/* 1. Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 border-b pb-2">
                  1. Informasi Personal
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nama Lengkap*</Label>
                    <Input
                      id="full_name"
                      name="full_name"
                      required
                      value={formData.full_name}
                      onChange={handleInputChange}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email*</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="place_of_birth">Tempat Lahir*</Label>
                    <Popover
                      open={openBirthCity}
                      onOpenChange={setOpenBirthCity}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openBirthCity}
                          className="w-full justify-between font-normal px-3 bg-transparent"
                          id="place_of_birth"
                        >
                          {formData.birth_city_id ? (
                            birthCities.find(
                              (c) =>
                                c.CityId.toString() === formData.birth_city_id,
                            )?.CityName || formData.birth_city_id
                          ) : (
                            <span className="text-muted-foreground cursor-pointer">
                              Pilih Tempat Lahir
                            </span>
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[--radix-popover-trigger-width] p-0 z-[160]"
                        align="start"
                      >
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Cari kota..."
                            value={searchBirthCity}
                            onValueChange={setSearchBirthCity}
                          />
                          <CommandList>
                            {isLoadingBirthCities &&
                              birthCities.length === 0 && (
                                <CommandEmpty>Memuat...</CommandEmpty>
                              )}
                            {!isLoadingBirthCities &&
                              birthCities.length === 0 && (
                                <CommandEmpty>
                                  Kota tidak ditemukan.
                                </CommandEmpty>
                              )}
                            <CommandGroup>
                              {birthCities.map((city, i) => (
                                <CommandItem
                                  key={city.CityId}
                                  ref={
                                    i === birthCities.length - 1
                                      ? lastBirthCityElementRef
                                      : undefined
                                  }
                                  value={city.CityName}
                                  onSelect={() => {
                                    handleSelectChange(
                                      "birth_city_id",
                                      city.CityId.toString(),
                                    );
                                    setOpenBirthCity(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.birth_city_id ===
                                        city.CityId.toString()
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  {city.CityName}
                                </CommandItem>
                              ))}
                              {isLoadingBirthCities &&
                                birthCities.length > 0 && (
                                  <div className="py-2 flex items-center justify-center text-sm text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Memuat...
                                  </div>
                                )}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Tanggal Lahir*</Label>
                    <Input
                      id="date_of_birth"
                      name="date_of_birth"
                      type="date"
                      required
                      value={formData.date_of_birth}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gender">Jenis Kelamin*</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(v) => handleSelectChange("gender", v)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Jenis Kelamin" />
                      </SelectTrigger>
                      <SelectContent className="z-[150]">
                        <SelectItem value="M">Laki-Laki</SelectItem>
                        <SelectItem value="F">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="marital_status">Status Pernikahan*</Label>
                    <Popover open={openMarital} onOpenChange={setOpenMarital}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openMarital}
                          className="w-full justify-between font-normal px-3 bg-transparent"
                          id="marital_status"
                        >
                          {formData.marital_status_id ? (
                            maritalStatuses.find(
                              (status) =>
                                status.MaritalStId.toString() ===
                                formData.marital_status_id,
                            )?.MaritalSt || formData.marital_status_id
                          ) : (
                            <span className="text-muted-foreground cursor-pointer">
                              Pilih Status
                            </span>
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[--radix-popover-trigger-width] p-0 z-[160]"
                        align="start"
                      >
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Cari status..."
                            value={searchMarital}
                            onValueChange={setSearchMarital}
                          />
                          <CommandList>
                            {isLoadingMarital &&
                              maritalStatuses.length === 0 && (
                                <CommandEmpty>Memuat...</CommandEmpty>
                              )}
                            {!isLoadingMarital &&
                              maritalStatuses.length === 0 && (
                                <CommandEmpty>
                                  Status tidak ditemukan.
                                </CommandEmpty>
                              )}
                            <CommandGroup>
                              {maritalStatuses.map((status, i) => (
                                <CommandItem
                                  key={status.MaritalStId}
                                  ref={
                                    i === maritalStatuses.length - 1
                                      ? lastMaritalElementRef
                                      : undefined
                                  }
                                  value={status.MaritalSt}
                                  onSelect={() => {
                                    handleSelectChange(
                                      "marital_status_id",
                                      status.MaritalStId.toString(),
                                    );
                                    setOpenMarital(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.marital_status_id ===
                                        status.MaritalStId.toString()
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  {status.MaritalSt}
                                </CommandItem>
                              ))}
                              {isLoadingMarital &&
                                maritalStatuses.length > 0 && (
                                  <div className="py-2 flex items-center justify-center text-sm text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Memuat...
                                  </div>
                                )}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="blood_type">Golongan Darah</Label>
                    <Select
                      value={formData.blood_type}
                      onValueChange={(v) => handleSelectChange("blood_type", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent className="z-[150]">
                        <SelectItem value="A">A</SelectItem>
                        <SelectItem value="B">B</SelectItem>
                        <SelectItem value="AB">AB</SelectItem>
                        <SelectItem value="O">O</SelectItem>
                        <SelectItem value="A+">A+</SelectItem>
                        <SelectItem value="A-">A-</SelectItem>
                        <SelectItem value="B+">B+</SelectItem>
                        <SelectItem value="B-">B-</SelectItem>
                        <SelectItem value="AB+">AB+</SelectItem>
                        <SelectItem value="AB-">AB-</SelectItem>
                        <SelectItem value="O+">O+</SelectItem>
                        <SelectItem value="O-">O-</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ethnicity">Suku/Etnis</Label>
                    <Popover open={openRace} onOpenChange={setOpenRace}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openRace}
                          className="w-full justify-between font-normal px-3 bg-transparent"
                          id="ethnicity"
                        >
                          {formData.race_id ? (
                            races.find(
                              (r) => r.RaceId.toString() === formData.race_id,
                            )?.Race || formData.race_id
                          ) : (
                            <span className="text-muted-foreground cursor-pointer">
                              Pilih Suku/Etnis
                            </span>
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[--radix-popover-trigger-width] p-0 z-[160]"
                        align="start"
                      >
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Cari suku/etnis..."
                            value={searchRace}
                            onValueChange={setSearchRace}
                          />
                          <CommandList>
                            {isLoadingRaces && races.length === 0 && (
                              <CommandEmpty>Memuat...</CommandEmpty>
                            )}
                            {!isLoadingRaces && races.length === 0 && (
                              <CommandEmpty>
                                Suku/Etnis tidak ditemukan.
                              </CommandEmpty>
                            )}
                            <CommandGroup>
                              {races.map((race, i) => (
                                <CommandItem
                                  key={race.RaceId}
                                  ref={
                                    i === races.length - 1
                                      ? lastRaceElementRef
                                      : undefined
                                  }
                                  value={race.Race}
                                  onSelect={() => {
                                    handleSelectChange(
                                      "race_id",
                                      race.RaceId.toString(),
                                    );
                                    setOpenRace(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.race_id ===
                                        race.RaceId.toString()
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  {race.Race}
                                </CommandItem>
                              ))}
                              {isLoadingRaces && races.length > 0 && (
                                <div className="py-2 flex items-center justify-center text-sm text-slate-500">
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Memuat...
                                </div>
                              )}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="photo">Pas Foto (Max 2MB)</Label>
                    <Input
                      id="photo"
                      name="photo"
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      onChange={handlePhotoChange}
                    />
                  </div>
                </div>
              </div>

              {/* 2. Contact Address */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 border-b pb-2">
                  2. Alamat & Kontak
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mobile_phone">No. HP/WhatsApp*</Label>
                    <Input
                      id="mobile_phone"
                      name="mobile_phone"
                      required
                      value={formData.mobile_phone}
                      onChange={handleInputChange}
                      placeholder="081234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip_code">Kode Pos*</Label>
                    <Input
                      id="zip_code"
                      name="zip_code"
                      required
                      value={formData.zip_code}
                      onChange={handleInputChange}
                      placeholder="10220"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="id_card_address">Alamat Sesuai KTP*</Label>
                  <Textarea
                    id="id_card_address"
                    name="id_card_address"
                    required
                    value={formData.id_card_address}
                    onChange={handleInputChange}
                    placeholder="Jl. Sudirman No 1..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="province">Provinsi*</Label>
                    <Popover open={openProvince} onOpenChange={setOpenProvince}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openProvince}
                          className="w-full justify-between font-normal px-3 bg-transparent"
                          id="province"
                          disabled={
                            isLoadingProvinces &&
                            provinces.length === 0 &&
                            !searchProvince
                          }
                        >
                          {formData.province_id ? (
                            provinces.find(
                              (p) =>
                                p.StateId.toString() === formData.province_id,
                            )?.StateName || formData.province_id
                          ) : (
                            <span className="text-muted-foreground cursor-pointer">
                              Pilih Provinsi
                            </span>
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[--radix-popover-trigger-width] p-0 z-[160]"
                        align="start"
                      >
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Cari provinsi..."
                            value={searchProvince}
                            onValueChange={setSearchProvince}
                          />
                          <CommandList>
                            {isLoadingProvinces && provinces.length === 0 && (
                              <CommandEmpty>Memuat...</CommandEmpty>
                            )}
                            {!isLoadingProvinces && provinces.length === 0 && (
                              <CommandEmpty>
                                Provinsi tidak ditemukan.
                              </CommandEmpty>
                            )}
                            <CommandGroup>
                              {provinces.map((prov, i) => (
                                <CommandItem
                                  key={prov.StateId}
                                  ref={
                                    i === provinces.length - 1
                                      ? lastProvinceElementRef
                                      : undefined
                                  }
                                  value={prov.StateName}
                                  onSelect={() => {
                                    handleProvinceChange(
                                      prov.StateId,
                                      prov.StateCode,
                                    );
                                    setOpenProvince(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.province_id ===
                                        prov.StateId.toString()
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  {prov.StateName}
                                </CommandItem>
                              ))}
                              {isLoadingProvinces && provinces.length > 0 && (
                                <div className="py-2 flex items-center justify-center text-sm text-slate-500">
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Memuat...
                                </div>
                              )}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Kota/Kabupaten*</Label>
                    <Popover open={openCity} onOpenChange={setOpenCity}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openCity}
                          className="w-full justify-between font-normal px-3 bg-transparent"
                          id="city"
                          disabled={
                            !selectedProvinceId ||
                            (isLoadingRegencies &&
                              regencies.length === 0 &&
                              !searchCity)
                          }
                        >
                          {formData.city_id ? (
                            regencies.find(
                              (c) => c.CityId.toString() === formData.city_id,
                            )?.CityName || formData.city_id
                          ) : (
                            <span className="text-muted-foreground cursor-pointer">
                              Pilih Kota/Kabupaten
                            </span>
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[--radix-popover-trigger-width] p-0 z-[160]"
                        align="start"
                      >
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Cari kota/kabupaten..."
                            value={searchCity}
                            onValueChange={setSearchCity}
                          />
                          <CommandList>
                            {isLoadingRegencies && regencies.length === 0 && (
                              <CommandEmpty>Memuat...</CommandEmpty>
                            )}
                            {!isLoadingRegencies && regencies.length === 0 && (
                              <CommandEmpty>
                                Kota/Kabupaten tidak ditemukan.
                              </CommandEmpty>
                            )}
                            <CommandGroup>
                              {regencies.map((city, i) => (
                                <CommandItem
                                  key={city.CityId}
                                  ref={
                                    i === regencies.length - 1
                                      ? lastCityElementRef
                                      : undefined
                                  }
                                  value={city.CityName}
                                  onSelect={() => {
                                    handleRegencyChange(city.CityId);
                                    setOpenCity(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.city_id ===
                                        city.CityId.toString()
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  {city.CityName}
                                </CommandItem>
                              ))}
                              {isLoadingRegencies && regencies.length > 0 && (
                                <div className="py-2 flex items-center justify-center text-sm text-slate-500">
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Memuat...
                                </div>
                              )}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* 3. Identity Card */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="text-lg font-bold text-slate-800">
                    3. Identitas Lengkap
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addIdentity}
                    className="text-xs"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Tambah Identitas
                  </Button>
                </div>
                {identities.map((identity, index) => (
                  <div
                    key={index}
                    className="flex flex-col md:flex-row gap-4 items-start bg-slate-50 p-4 rounded-xl border border-slate-100 relative pr-12"
                  >
                    <div className="flex-1 space-y-2 w-full">
                      <Label>Jenis Identitas*</Label>
                      <Select
                        value={identity.card_type_id}
                        onValueChange={(v) => {
                          const newArr = [...identities];
                          newArr[index].card_type_id = v;
                          setIdentities(newArr);
                        }}
                        disabled={isLoadingCardTypes}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              isLoadingCardTypes ? "Memuat..." : "Pilih Jenis"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="z-[150]">
                          {cardTypes.map((type) => (
                            <SelectItem
                              key={type.CardTypeId}
                              value={type.CardTypeId.toString()}
                            >
                              {type.CardType}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-[2] space-y-2 w-full">
                      <Label>Nomor Identitas*</Label>
                      <Input
                        value={identity.number}
                        onChange={(e) => {
                          const newArr = [...identities];
                          newArr[index].number = e.target.value;
                          setIdentities(newArr);
                        }}
                        placeholder="Nomor..."
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 absolute top-4 right-2"
                      onClick={() => removeIdentity(index)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* 4. Formal Education */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="text-lg font-bold text-slate-800">
                    4. Riwayat Pendidikan Formal
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addEducation}
                    className="text-xs"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Tambah Pendidikan
                  </Button>
                </div>
                {educations.map((edu, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 relative pr-12"
                  >
                    <div className="space-y-2">
                      <Label>Tingkat*</Label>
                      <Popover
                        open={openEduIndex === index}
                        onOpenChange={(open) =>
                          setOpenEduIndex(open ? index : null)
                        }
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openEduIndex === index}
                            className="w-full justify-between font-normal px-3 bg-transparent"
                          >
                            {edu.edu_level_id ? (
                              eduLevels.find(
                                (level) =>
                                  level.EduLvlId.toString() ===
                                  edu.edu_level_id,
                              )?.EduLvlName || edu.edu_level_id
                            ) : (
                              <span className="text-muted-foreground cursor-pointer">
                                Pilih Tingkat
                              </span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[--radix-popover-trigger-width] p-0 z-[160]"
                          align="start"
                        >
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Cari tingkat..."
                              value={searchEdu}
                              onValueChange={setSearchEdu}
                            />
                            <CommandList>
                              {isLoadingEduLevels && eduLevels.length === 0 && (
                                <CommandEmpty>Memuat...</CommandEmpty>
                              )}
                              {!isLoadingEduLevels &&
                                eduLevels.length === 0 && (
                                  <CommandEmpty>
                                    Tingkat tidak ditemukan.
                                  </CommandEmpty>
                                )}
                              <CommandGroup>
                                {eduLevels.map((lvl, idx) => (
                                  <CommandItem
                                    key={lvl.EduLvlId}
                                    ref={
                                      idx === eduLevels.length - 1
                                        ? lastEduElementRef
                                        : undefined
                                    }
                                    value={lvl.EduLvlName}
                                    onSelect={() => {
                                      const newArr = [...educations];
                                      newArr[index].edu_level_id =
                                        lvl.EduLvlId.toString();
                                      setEducations(newArr);
                                      setOpenEduIndex(null);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        edu.edu_level_id ===
                                          lvl.EduLvlId.toString()
                                          ? "opacity-100"
                                          : "opacity-0",
                                      )}
                                    />
                                    {lvl.EduLvlName}
                                  </CommandItem>
                                ))}
                                {isLoadingEduLevels && eduLevels.length > 0 && (
                                  <div className="py-2 flex items-center justify-center text-sm text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Memuat...
                                  </div>
                                )}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>Institusi*</Label>
                      <Popover
                        open={openInstitutionIndex === index}
                        onOpenChange={(open) => {
                          setOpenInstitutionIndex(open ? index : null);
                          if (
                            !open &&
                            searchInstitution &&
                            !eduInstitutions.some(
                              (i) =>
                                i.EduInsName.toLowerCase() ===
                                searchInstitution.toLowerCase(),
                            )
                          ) {
                            // Allow manual input if closing the popover and there's text typed that isn't exactly in the list
                            const newArr = [...educations];
                            newArr[index].edu_institution_id =
                              searchInstitution;
                            setEducations(newArr);
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openInstitutionIndex === index}
                            className="w-full justify-between font-normal px-3 bg-transparent"
                            onClick={() =>
                              setSearchInstitution(
                                eduInstitutions.find(
                                  (i) =>
                                    i.EduInsId.toString() ===
                                    edu.edu_institution_id,
                                )?.EduInsName || edu.edu_institution_id,
                              )
                            }
                          >
                            {edu.edu_institution_id ? (
                              eduInstitutions.find(
                                (i) =>
                                  i.EduInsId.toString() ===
                                  edu.edu_institution_id,
                              )?.EduInsName || edu.edu_institution_id
                            ) : (
                              <span className="text-muted-foreground cursor-pointer">
                                Cari Institusi
                              </span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[--radix-popover-trigger-width] p-0 z-[160]"
                          align="start"
                        >
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Cari nama institusi..."
                              value={searchInstitution}
                              onValueChange={setSearchInstitution}
                            />
                            <CommandList>
                              {isLoadingInstitutions &&
                                eduInstitutions.length === 0 && (
                                  <CommandEmpty>Memuat...</CommandEmpty>
                                )}
                              {!isLoadingInstitutions &&
                                eduInstitutions.length === 0 && (
                                  <CommandEmpty>
                                    Institusi tidak ditemukan. Ketik untuk
                                    mencari.
                                  </CommandEmpty>
                                )}
                              <CommandGroup>
                                {eduInstitutions.map((inst, idx) => (
                                  <CommandItem
                                    key={inst.EduInsId}
                                    ref={
                                      idx === eduInstitutions.length - 1
                                        ? lastInstitutionElementRef
                                        : undefined
                                    }
                                    value={inst.EduInsName}
                                    onSelect={() => {
                                      const newArr = [...educations];
                                      newArr[index].edu_institution_id =
                                        inst.EduInsId.toString();
                                      setEducations(newArr);
                                      setOpenInstitutionIndex(null);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        edu.edu_institution_id ===
                                          inst.EduInsId.toString()
                                          ? "opacity-100"
                                          : "opacity-0",
                                      )}
                                    />
                                    {inst.EduInsName}
                                  </CommandItem>
                                ))}
                                {isLoadingInstitutions &&
                                  eduInstitutions.length > 0 && (
                                    <div className="py-2 flex items-center justify-center text-sm text-slate-500">
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                      Memuat...
                                    </div>
                                  )}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>Jurusan</Label>
                      <Input
                        value={edu.major}
                        onChange={(e) => {
                          const newArr = [...educations];
                          newArr[index].major = e.target.value;
                          setEducations(newArr);
                        }}
                        placeholder="Jurusan"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>IPK / Nilai Rata-rata</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={edu.gpa}
                        onChange={(e) => {
                          const newArr = [...educations];
                          newArr[index].gpa = e.target.value;
                          setEducations(newArr);
                        }}
                        placeholder="3.50"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2 flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        id={`last_edu_${index}`}
                        checked={edu.is_last_education}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newArr = educations.map((edu, i) => ({
                              ...edu,
                              is_last_education: i === index,
                            }));
                            setEducations(newArr);
                          } else {
                            const newArr = [...educations];
                            newArr[index].is_last_education = false;
                            setEducations(newArr);
                          }
                        }}
                        className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                      />
                      <Label
                        htmlFor={`last_edu_${index}`}
                        className="font-normal cursor-pointer"
                      >
                        Jadikan pendidikan terakhir
                      </Label>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 absolute top-4 right-2"
                      onClick={() => removeEducation(index)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* 5. Working Experience */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="text-lg font-bold text-slate-800">
                    5. Pengalaman Kerja
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addExperience}
                    className="text-xs"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Tambah Pengalaman
                  </Button>
                </div>
                {experiences.map((exp, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 relative pr-12"
                  >
                    <div className="space-y-2">
                      <Label>Nama Perusahaan*</Label>
                      <Input
                        value={exp.company_name}
                        onChange={(e) => {
                          const newArr = [...experiences];
                          newArr[index].company_name = e.target.value;
                          setExperiences(newArr);
                        }}
                        placeholder="PT. ABC"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Posisi/Jabatan*</Label>
                      <Input
                        value={exp.position}
                        onChange={(e) => {
                          const newArr = [...experiences];
                          newArr[index].position = e.target.value;
                          setExperiences(newArr);
                        }}
                        placeholder="Staff"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tahun Periode</Label>
                      <Input
                        value={exp.job_period_year}
                        onChange={(e) => {
                          const newArr = [...experiences];
                          newArr[index].job_period_year = e.target.value;
                          setExperiences(newArr);
                        }}
                        placeholder="2020 - 2022"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Gaji Terakhir</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                          Rp
                        </span>
                        <Input
                          type="text"
                          value={
                            exp.salary
                              ? Number(exp.salary).toLocaleString("id-ID")
                              : ""
                          }
                          onChange={(e) => {
                            const rawValue = e.target.value.replace(/\./g, "");
                            if (/^\d*$/.test(rawValue)) {
                              const newArr = [...experiences];
                              newArr[index].salary = rawValue;
                              setExperiences(newArr);
                            }
                          }}
                          placeholder="5.000.000"
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 absolute top-4 right-2"
                      onClick={() => removeExperience(index)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* 6. Documents Upload */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="text-lg font-bold text-slate-800">
                    6. Dokumen Tambahan
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addDocument}
                    className="text-xs"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Tambah Dokumen
                  </Button>
                </div>
                {documents.map((doc, index) => (
                  <div
                    key={index}
                    className="flex flex-col md:flex-row gap-4 items-start bg-slate-50 p-4 rounded-xl border border-slate-100 relative pr-12"
                  >
                    <div className="flex-1 space-y-2 w-full">
                      <Label>Berkas (PDF/Word)*</Label>
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => {
                          const newArr = [...documents];
                          if (e.target.files && e.target.files.length > 0) {
                            const file = e.target.files[0];
                            if (file.size > 10 * 1024 * 1024) {
                              toast.error("Ukuran file maksimal 10MB.");
                              e.target.value = "";
                              return;
                            }
                            newArr[index].file = file;
                          }
                          setDocuments(newArr);
                        }}
                      />
                    </div>
                    <div className="flex-[2] space-y-2 w-full">
                      <Label>Deskripsi Dokumen*</Label>
                      <Input
                        value={doc.description}
                        onChange={(e) => {
                          const newArr = [...documents];
                          newArr[index].description = e.target.value;
                          setDocuments(newArr);
                        }}
                        placeholder="Contoh: CV Lengkap, Ijazah, Transkrip"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 absolute top-4 right-2"
                      onClick={() => removeDocument(index)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Dynamic Question Sections */}
              {isLoadingQuestions && (
                <div className="flex items-center justify-center py-8 text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Memuat pertanyaan...
                </div>
              )}
              {questionGroups.map((group, groupIndex) => (
                <div key={group.topic.QTopicId} className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-800 border-b pb-2">
                    {7 + groupIndex}. {group.topic.QTopicName}
                  </h3>

                  <div className="space-y-4">
                    {group.questions.map((question) => (
                      <div key={question.QuestionId} className="space-y-2">
                        <Label htmlFor={`q_${question.QuestionId}`}>
                          {question.QuestName}
                        </Label>

                        {/* A = Yes/No (Radio-style Select) */}
                        {question.FgAnsMode === "A" && (
                          <Select
                            value={questionAnswers[question.QuestionId] || ""}
                            onValueChange={(v) =>
                              handleQuestionAnswerChange(question.QuestionId, v)
                            }
                          >
                            <SelectTrigger id={`q_${question.QuestionId}`}>
                              <SelectValue placeholder="Pilih..." />
                            </SelectTrigger>
                            <SelectContent className="z-[150]">
                              <SelectItem value="Ya">Ya</SelectItem>
                              <SelectItem value="Tidak">Tidak</SelectItem>
                            </SelectContent>
                          </Select>
                        )}

                        {/* N = Essay/Text (Textarea) */}
                        {question.FgAnsMode === "N" && (
                          <Textarea
                            id={`q_${question.QuestionId}`}
                            value={questionAnswers[question.QuestionId] || ""}
                            onChange={(e) =>
                              handleQuestionAnswerChange(
                                question.QuestionId,
                                e.target.value,
                              )
                            }
                            placeholder="Tulis jawaban Anda..."
                          />
                        )}

                        {/* O = Numeric (Number input with Rp prefix) */}
                        {question.FgAnsMode === "O" && (
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                              Rp
                            </span>
                            <Input
                              id={`q_${question.QuestionId}`}
                              type="text"
                              value={
                                questionAnswers[question.QuestionId]
                                  ? Number(
                                      questionAnswers[question.QuestionId],
                                    ).toLocaleString("id-ID")
                                  : ""
                              }
                              onChange={(e) =>
                                handleNumericQuestionChange(
                                  question.QuestionId,
                                  e.target.value,
                                )
                              }
                              placeholder="0"
                              className="pl-9"
                            />
                          </div>
                        )}

                        {/* Y = Multiple Choice (Select - options from API if available, placeholder for now) */}
                        {question.FgAnsMode === "Y" && (
                          <Input
                            id={`q_${question.QuestionId}`}
                            value={questionAnswers[question.QuestionId] || ""}
                            onChange={(e) =>
                              handleQuestionAnswerChange(
                                question.QuestionId,
                                e.target.value,
                              )
                            }
                            placeholder="Tulis jawaban Anda..."
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* 9. Declaration */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-start gap-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
                  <div className="flex h-6 items-center">
                    <input
                      id="is_declared_true"
                      name="is_declared_true"
                      type="checkbox"
                      checked={formData.is_declared_true}
                      onChange={handleInputChange}
                      className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary shadow-sm"
                      required
                    />
                  </div>
                  <div className="flex flex-col">
                    <Label
                      htmlFor="is_declared_true"
                      className="font-bold text-slate-800 text-base cursor-pointer"
                    >
                      Pernyataan Kebenaran Data*
                    </Label>
                    <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                      Saya menyatakan bahwa semua informasi, data, dan dokumen
                      yang saya berikan dalam formulir lamaran ini adalah benar,
                      akurat, dan dapat dipertanggungjawabkan. Saya menyadari
                      bahwa setiap pemalsuan, ketidakakuratan, atau
                      penyembunyian fakta dapat mengakibatkan penolakan lamaran
                      saya atau pemutusan hubungan kerja di masa mendatang.
                    </p>
                  </div>
                </div>
              </div>

              {/* Captcha hanya ditampilkan bila diaktifkan backend (feature flag) */}
              {captchaEnabled !== false && (
                <div className="pt-4 flex justify-center">
                  {captchaEnabled && captchaSiteKey ? (
                    <Turnstile
                      sitekey={captchaSiteKey}
                      onLoad={(_, boundTurnstile) =>
                        setTurnstileInstance(boundTurnstile)
                      }
                      onVerify={(token) => setCaptchaToken(token)}
                      onError={() => {
                        toast.error(
                          "Verifikasi Captcha gagal. Silakan coba lagi.",
                        );
                        setCaptchaToken(null);
                      }}
                      theme="light"
                      size="normal"
                    />
                  ) : (
                    <div className="text-sm text-slate-500 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Memuat
                      Captcha...
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>

          <div className="p-6 bg-slate-50 border-t flex gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl font-semibold border-slate-200 hover:bg-slate-100 text-slate-700"
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              form="apply-form"
              disabled={
                isSubmitting ||
                captchaEnabled === null ||
                (captchaEnabled === true && !captchaToken)
              }
              className="flex-[2] h-12 bg-primary text-primary-foreground rounded-xl font-semibold shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Mengirim...
                </>
              ) : (
                "Kirim Lamaran"
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
