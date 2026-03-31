# API Documentation: Apply Job

> Endpoint utama untuk submit lamaran dari form Apply Job di frontend.

## Ringkasan

- Endpoint: `POST /candidates/apply`
- Content-Type: `multipart/form-data`
- Sumber payload frontend: `src/components/ApplyJobModal.tsx`
- Tujuan: menyimpan data kandidat, identitas, pendidikan, pengalaman, jawaban pertanyaan, foto, dan dokumen lampiran.

Dokumen ini dibuat berdasarkan payload yang benar-benar dibentuk oleh frontend saat submit. Jadi ini bisa langsung dipakai sebagai acuan implementasi backend API `applyJob`.

## Flow Terkait di Frontend

Sebelum submit ke endpoint utama, frontend melakukan 2 flow pendukung:

1. `GET /candidates/captcha-config`
   Untuk mengambil `site_key` Cloudflare Turnstile.
2. `POST /candidates/check-application`
   Untuk mengecek apakah email sudah pernah melamar pada `job_id` yang sama.

Jika endpoint pengecekan duplikasi gagal, frontend tetap melanjutkan submit. Karena itu backend `POST /candidates/apply` tetap harus melakukan validasi duplikasi sendiri.

## Request Body

Request dikirim sebagai `multipart/form-data`.

### Top-Level Fields

| Field | Type | Wajib di UI | Wajib divalidasi backend | Keterangan |
|---|---|---:|---:|---|
| `job_id` | integer | Ya | Ya | Diambil dari `vacancy.VacantPosId`. |
| `full_name` | string | Ya | Ya | Nama lengkap pelamar. |
| `email` | string | Ya | Ya | Email pelamar. |
| `gender` | string | Ya | Ya | Nilai yang dikirim: `M` atau `F`. |
| `birth_city_id` | integer | Ya | Ya | ID kota lahir dari endpoint referensi kota. |
| `date_of_birth` | string | Ya | Ya | Format `YYYY-MM-DD`. |
| `marital_status_id` | integer | Ya | Ya | Ada validasi eksplisit sebelum submit. |
| `blood_type` | string | Tidak | Tidak | Nilai yang tersedia: `A`, `B`, `AB`, `O`, `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`. |
| `race_id` | integer | Tidak | Tidak | ID suku/etnis. |
| `photo` | file | Tidak | Tidak | Frontend hanya membatasi tipe file `jpg/jpeg/png`. Label UI menulis max 2MB, tetapi belum ada validasi ukuran di client. |
| `mobile_phone` | string | Ya | Ya | Nomor HP/WhatsApp. |
| `zip_code` | string | Ya | Ya | Kode pos. |
| `id_card_address` | string | Ya | Ya | Alamat sesuai KTP. |
| `province_id` | integer | Ya | Ya | ID provinsi. |
| `city_id` | integer | Ya | Ya | ID kota/kabupaten domisili. |
| `is_declared_true` | boolean | Ya | Ya | Dikirim sebagai string `true` atau `false` dalam multipart. Frontend memaksa harus `true`. |
| `captcha_token` | string | Ya | Ya | Token Turnstile. Ada validasi eksplisit sebelum submit. |

Catatan:

- Semua field di atas hanya di-append ke `FormData` jika nilainya bukan string kosong, `undefined`, atau `null`.
- Karena memakai `FormData`, semua scalar value akan terbaca sebagai string di backend dan perlu di-cast sesuai kebutuhan.

### JSON String Fields

Field berikut dikirim sebagai string JSON dalam multipart.

#### `identities`

Frontend mengirim hasil filter item yang memiliki `card_type_id` dan `number`.

Contoh:

```json
[
  {
    "card_type_id": "1",
    "number": "3201234567890001"
  },
  {
    "card_type_id": "2",
    "number": "A1234567"
  }
]
```

| Field | Type | Backend rule | Keterangan |
|---|---|---:|---|
| `card_type_id` | string integer | Ya | ID jenis identitas dari endpoint `/cardtypes`. |
| `number` | string | Ya | Nomor identitas. |

Catatan:

- Frontend tidak memaksa minimal 1 identitas valid saat submit.
- Jika semua row kosong, backend akan menerima `[]`.

#### `educations`

Frontend hanya mengirim item yang memiliki `edu_level_id` dan `edu_institution_id`.
Nilai `gpa` diubah ke number, atau `null` jika kosong.

Contoh:

```json
[
  {
    "edu_level_id": "5",
    "major": "Teknik Informatika",
    "edu_institution_id": "12",
    "gpa": 3.5,
    "is_last_education": true
  },
  {
    "edu_level_id": "6",
    "major": "Sistem Informasi",
    "edu_institution_id": "Universitas ABC",
    "gpa": null,
    "is_last_education": false
  }
]
```

| Field | Type | Backend rule | Keterangan |
|---|---|---:|---|
| `edu_level_id` | string integer | Ya | ID level pendidikan dari `/edulevels`. |
| `major` | string | Tidak | Jurusan. |
| `edu_institution_id` | string | Ya | Bisa berupa ID institusi atau teks manual. |
| `gpa` | number or null | Tidak | IPK / nilai rata-rata. |
| `is_last_education` | boolean | Ya | Menandakan pendidikan terakhir. |

Catatan:

- Frontend memungkinkan `edu_institution_id` berisi teks manual jika institusi tidak ada di list.
- Frontend tidak memaksa minimal 1 pendidikan valid saat submit.

#### `experiences`

Frontend hanya mengirim item yang memiliki `company_name` dan `position`.
Nilai `salary` diubah ke number, atau `null` jika kosong.

Contoh:

```json
[
  {
    "company_name": "PT ABC",
    "position": "Frontend Developer",
    "job_period_year": "2022 - 2024",
    "salary": 7500000
  }
]
```

| Field | Type | Backend rule | Keterangan |
|---|---|---:|---|
| `company_name` | string | Tidak | Nama perusahaan. |
| `position` | string | Tidak | Posisi/jabatan. |
| `job_period_year` | string | Tidak | Format bebas, contoh `2022 - 2024`. |
| `salary` | number or null | Tidak | Gaji terakhir. |

Catatan:

- Pengalaman kerja bersifat opsional di payload saat ini.

#### `answers`

Frontend membentuk `answers` dari daftar pertanyaan hasil endpoint `GET /questions/grouped?topic_id=2,3`.
Hanya jawaban yang tidak kosong yang dikirim.

Contoh:

```json
[
  {
    "qtempid": 2,
    "question_id": 15,
    "answer": "Ya"
  },
  {
    "qtempid": 3,
    "question_id": 21,
    "answer": "Bersedia ditempatkan di seluruh Indonesia"
  }
]
```

| Field | Type | Backend rule | Keterangan |
|---|---|---:|---|
| `qtempid` | integer or null | Tidak | ID topic pertanyaan, diambil dari `group.topic.QTopicId`. |
| `question_id` | integer | Ya | ID pertanyaan. |
| `answer` | string | Ya | Isi jawaban sesuai tipe pertanyaan. |

Catatan:

- Jika semua jawaban kosong, field `answers` tidak dikirim sama sekali.

### File Array Fields

#### `documents[]`

Frontend mengharuskan minimal 1 dokumen terunggah sebelum submit.

| Field | Type | Wajib | Keterangan |
|---|---|---:|---|
| `documents[]` | file[] | Ya | Tipe file yang diizinkan di UI: `.pdf`, `.doc`, `.docx`. |
| `document_descriptions[]` | string[] | Ya | Satu deskripsi untuk setiap file pada `documents[]`. |

Catatan:

- Frontend memvalidasi ukuran file dokumen maksimal 10MB per file.
- Jika deskripsi kosong, frontend tetap mengirim default string `Document`.
- Urutan `document_descriptions[]` mengikuti urutan `documents[]`.

## Contoh cURL

```bash
curl -X POST "https://your-api.example.com/candidates/apply" \
  -H "Accept: application/json" \
  -F "job_id=123" \
  -F "full_name=John Doe" \
  -F "email=john.doe@example.com" \
  -F "gender=M" \
  -F "birth_city_id=3171" \
  -F "date_of_birth=1998-03-17" \
  -F "marital_status_id=1" \
  -F "blood_type=O" \
  -F "race_id=4" \
  -F "mobile_phone=081234567890" \
  -F "zip_code=10220" \
  -F "id_card_address=Jl. Sudirman No. 1" \
  -F "province_id=31" \
  -F "city_id=3171" \
  -F "is_declared_true=true" \
  -F "captcha_token=turnstile-token-value" \
  -F 'identities=[{"card_type_id":"1","number":"3201234567890001"}]' \
  -F 'educations=[{"edu_level_id":"5","major":"Teknik Informatika","edu_institution_id":"12","gpa":3.5,"is_last_education":true}]' \
  -F 'experiences=[{"company_name":"PT ABC","position":"Frontend Developer","job_period_year":"2022 - 2024","salary":7500000}]' \
  -F 'answers=[{"qtempid":2,"question_id":15,"answer":"Ya"}]' \
  -F "photo=@./photo.jpg" \
  -F "documents[]=@./cv.pdf" \
  -F "document_descriptions[]=CV Terbaru"
```

## Response yang Diharapkan

### Success Response

Status code yang disarankan: `200` atau `201`

```json
{
  "success": true,
  "message": "Lamaran berhasil dikirim.",
  "data": {
    "candidate_id": 123,
    "candidate_code": "CAN-20260317-0001"
  }
}
```

Field `candidate_code` dipakai frontend untuk ditampilkan di toast sukses.

### Validation Error Response

Status code yang disarankan: `422`

```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": {
    "email": [
      "Email sudah pernah digunakan untuk posisi ini."
    ],
    "documents": [
      "Minimal satu dokumen wajib diunggah."
    ]
  }
}
```

Frontend mendukung dua pola error berikut:

1. `errors` berisi object per field dengan array pesan.
2. `message` tunggal jika tidak ada `errors`.

### Duplicate Application Response

Disarankan tetap gunakan `422` agar konsisten dengan validasi.

```json
{
  "success": false,
  "message": "Anda sudah pernah melamar posisi ini.",
  "errors": {
    "email": [
      "Anda sudah pernah melamar posisi ini."
    ]
  }
}
```

## Kontrak Endpoint Pendukung

### `GET /candidates/captcha-config`

Contoh response:

```json
{
  "success": true,
  "data": {
    "site_key": "your-turnstile-site-key",
    "verify_url": "https://challenges.cloudflare.com/turnstile/v0/siteverify"
  }
}
```

### `POST /candidates/check-application`

Request JSON:

```json
{
  "email": "john.doe@example.com",
  "job_id": 123
}
```

Response JSON:

```json
{
  "success": true,
  "exists": false,
  "message": "Belum ada lamaran untuk kombinasi email dan posisi ini."
}
```

## Validasi Backend yang Disarankan

Karena sebagian field hanya ditandai wajib di UI dan belum semuanya diproteksi oleh validasi client, backend sebaiknya menganggap field berikut wajib:

- `job_id`
- `full_name`
- `email`
- `gender`
- `birth_city_id`
- `date_of_birth`
- `marital_status_id`
- `mobile_phone`
- `zip_code`
- `id_card_address`
- `province_id`
- `city_id`
- `is_declared_true=true`
- `captcha_token`
- minimal 1 `documents[]`

Validasi tambahan yang disarankan:

- Cek duplikasi lamaran berdasarkan kombinasi `email + job_id`.
- Verifikasi `captcha_token` ke Cloudflare Turnstile.
- Batasi ukuran `photo` maksimal 2MB agar sesuai label UI.
- Batasi ukuran tiap `documents[]` maksimal 10MB.
- Validasi mime type dokumen: PDF, DOC, DOCX.
- Validasi mime type foto: JPEG, JPG, PNG.
- Validasi bahwa jumlah `document_descriptions[]` sama dengan jumlah `documents[]`.
- Validasi parse JSON untuk `identities`, `educations`, `experiences`, dan `answers`.
- Validasi referential integrity untuk semua ID seperti `job_id`, `birth_city_id`, `marital_status_id`, `province_id`, `city_id`, `race_id`, `card_type_id`, dan `edu_level_id`.

## Catatan Implementasi

- Frontend mengirim multipart, bukan JSON biasa.
- Scalar value dari multipart akan masuk sebagai string, jadi backend perlu casting ke integer, boolean, date, atau float.
- Field `is_declared_true` akan datang sebagai string `"true"`.
- `edu_institution_id` bisa berupa numeric ID atau string nama institusi manual.
- Jika `answers` kosong, field tersebut tidak ada di request.
- Jika `photo` tidak dipilih, field tersebut tidak ada di request.

## Referensi Frontend

- Pembentukan payload submit: `src/components/ApplyJobModal.tsx`
- Service API frontend: `src/lib/api/applications.ts`