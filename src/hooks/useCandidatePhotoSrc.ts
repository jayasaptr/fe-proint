import { useEffect, useState } from "react";

import {
  previewCandidatePhoto,
  type CandidatePhoto,
} from "@/lib/api/candidates";

/**
 * Memilih foto default kandidat: prioritas FgDefault = "Y", jatuh ke foto
 * pertama kalau tidak ada yang ditandai default.
 */
export const pickDefaultPhoto = (
  photos?: CandidatePhoto[] | null,
): CandidatePhoto | null => {
  if (!Array.isArray(photos) || photos.length === 0) return null;
  return (
    photos.find((photo) => photo?.FgDefault?.toUpperCase() === "Y") ??
    photos[0] ??
    null
  );
};

/**
 * Menghasilkan src siap pakai untuk <img> dari sebuah objek foto kandidat.
 *
 * - Data baru: backend mengirim `photo_url` (asset service) — dipakai langsung.
 * - Data lama: `photo_url` null tapi `has_photo` true karena file masih blob di
 *   DB. <img src> biasa tidak mengirim header Authorization, jadi file ditarik
 *   lewat endpoint preview ber-auth lalu diubah jadi object URL.
 * - Tidak ada foto sama sekali: mengembalikan null supaya caller menampilkan
 *   placeholder.
 */
export const useCandidatePhotoSrc = (
  canId?: string | number | null,
  photo?: CandidatePhoto | null,
): { src: string | null; isLoading: boolean } => {
  // Disimpan bersama key sumbernya supaya hasil fetch foto sebelumnya tidak
  // ikut terpakai saat foto berganti — tanpa perlu reset state di dalam effect.
  const [fetched, setFetched] = useState<{
    key: string;
    url: string | null;
  } | null>(null);

  const photoId = photo?.CanPhotoId;
  const photoUrl = photo?.photo_url ?? null;
  // Data lama sebelum backend menambahkan flag: anggap ada foto kalau row-nya ada.
  const hasPhoto = photo ? (photo.has_photo ?? true) : false;
  const needsBlobFetch = Boolean(
    hasPhoto && !photoUrl && canId != null && photoId != null,
  );
  const fetchKey = needsBlobFetch ? `${canId}/${photoId}` : null;

  useEffect(() => {
    if (!fetchKey) return;

    let objectUrl: string | null = null;
    let cancelled = false;

    previewCandidatePhoto(canId as string | number, photoId as number)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setFetched({ key: fetchKey, url: objectUrl });
      })
      .catch(() => {
        if (!cancelled) setFetched({ key: fetchKey, url: null });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fetchKey, canId, photoId]);

  if (!hasPhoto) return { src: null, isLoading: false };
  if (photoUrl) return { src: photoUrl, isLoading: false };
  // Hasil fetch dari foto lain diabaikan; selama key belum cocok, masih loading.
  if (!fetchKey) return { src: null, isLoading: false };
  if (fetched?.key !== fetchKey) return { src: null, isLoading: true };
  return { src: fetched.url, isLoading: false };
};
