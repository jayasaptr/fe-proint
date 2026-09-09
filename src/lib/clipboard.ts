/**
 * Salin teks ke clipboard dengan fallback untuk halaman non-HTTPS.
 *
 * `navigator.clipboard` hanya ada pada secure context (HTTPS/localhost). Di dev server LAN
 * (http://10.24.240.120:5174) API itu undefined, sehingga dipakai fallback textarea +
 * `document.execCommand("copy")` yang masih didukung browser.
 */
export const copyToClipboard = async (value: string): Promise<boolean> => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // jatuh ke fallback di bawah
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
};
