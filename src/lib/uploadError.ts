/**
 * Upload kandidat (foto/dokumen) sekarang bergantung pada Asset Service di luar
 * aplikasi, jadi kegagalan bisa datang dari sana.
 *
 * - 502 pada POST /candidates/apply-job: message dari backend sudah ramah user,
 *   tampilkan apa adanya.
 * - 500 pada POST /candidates/{id}/photo dan /documents: message memuat detail
 *   teknis (host, stack, dsb). Jangan tampilkan mentah ke user — cukup log,
 *   lalu tampilkan pesan generik.
 */
const readError = (error: unknown) => {
  const err = error as {
    response?: { status?: number; data?: { message?: string } };
  };
  return {
    status: err?.response?.status,
    message: err?.response?.data?.message,
  };
};

/**
 * Untuk endpoint upload admin (photo/documents): pesan 5xx disembunyikan dari
 * user karena memuat detail teknis, tapi tetap di-log.
 */
export const resolveUploadErrorMessage = (
  error: unknown,
  fallbackMessage: string,
): string => {
  const { status, message } = readError(error);

  if (status && status >= 500) {
    // Detail teknis hanya untuk konsol/error reporting, bukan untuk user.
    console.error("[upload] server error", { status, message });
    return fallbackMessage;
  }

  return message || fallbackMessage;
};

/**
 * Untuk POST /candidates/apply-job: backend mengembalikan 502 dengan message
 * yang sudah ramah user saat Asset Service tidak tersedia — tampilkan apa adanya.
 */
export const resolveApplyErrorMessage = (
  error: unknown,
  fallbackMessage: string,
): string => {
  const { status, message } = readError(error);

  if (status && status >= 500) {
    console.error("[apply-job] server error", { status, message });
  }

  return message || fallbackMessage;
};
