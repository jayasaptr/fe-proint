import {
  pickDefaultPhoto,
  useCandidatePhotoSrc,
} from "@/hooks/useCandidatePhotoSrc";
import type { CandidatePhoto } from "@/lib/api/candidates";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";
import { useState } from "react";

interface CandidateAvatarProps {
  canId?: string | number | null;
  photos?: CandidatePhoto[] | null;
  name?: string | null;
  className?: string;
}

/**
 * Avatar kandidat untuk tabel/daftar. Dipisah jadi komponen sendiri karena
 * resolusi foto memakai hook (data lama perlu fetch ber-auth), sedangkan
 * pemakaiannya ada di dalam .map() baris tabel.
 */
const CandidateAvatar = ({
  canId,
  photos,
  name,
  className,
}: CandidateAvatarProps) => {
  const photo = pickDefaultPhoto(photos);
  const { src } = useCandidatePhotoSrc(canId, photo);
  // Disimpan per-src supaya error foto sebelumnya tidak menutupi foto baru.
  const [erroredSrc, setErroredSrc] = useState<string | null>(null);
  const isError = src != null && erroredSrc === src;

  return (
    <div
      className={cn(
        "w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden",
        className,
      )}
    >
      {src && !isError ? (
        <img
          src={src}
          alt={name || "Foto kandidat"}
          className="w-full h-full object-cover"
          onError={() => setErroredSrc(src)}
        />
      ) : (
        <User className="w-5 h-5 text-slate-400" />
      )}
    </div>
  );
};

export default CandidateAvatar;
