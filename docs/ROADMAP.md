# MVP Roadmap

Terakhir diperbarui: 2026-11-09 (Senin). Bahasa dokumen: Indonesia.

## Definisi MVP

MVP selesai jika cerita 7 langkah di README berjalan di testnet: host membuat hajat, tamu menyegel amplop, host membukanya, ledger mencatat utang, dan balasan di hajat lain melunasi klaim lama sehingga kartu lama berubah menjadi "Repaid". Semua itu dapat dijalankan lewat `/demo` tanpa wallet dan lewat `pnpm demo` tanpa UI.

## Batas waktu

| Peristiwa | UTC | WIB |
| --- | --- | --- |
| Hackathon mulai | Sab 2026-11-01 00:00 | Sab 1 Nov 07:00 |
| Contract freeze (target sendiri) | Jum 2026-11-13 14:00 | Jum 13 Nov 21:00 |
| Repo publik, video, post X | Sab 2026-11-14 09:00 | Sab 14 Nov 16:00 |
| Submit (target sendiri) | Sab 2026-11-14 12:00 | Sab 14 Nov 19:00 |
| Batas akhir development dan submission | Sab 2026-11-14 23:59 | Min 15 Nov 06:59 |
| Penjurian mulai | Senin 2026-11-16 00:00 | Sen 16 Nov 07:00 |
| Hasil diumumkan paling lambat | Rab 2026-11-18 23:59 | Kam 19 Nov 06:59 |

Catatan: batas akhir jatuh pada Minggu pagi WIB, bukan Sabtu. Jangan menunggu sampai jam terakhir. Submission tidak bisa diedit.

## Prioritas

| Level | Isi |
| --- | --- |
| P0 | `tusdc`, `amplop` (hajat, undang, join, segel, buka, batal, refund), ledger dan pelunasan, kartu SVG dinamis, soulbound, mode demo, halaman hajat, undangan, Neraca, `pnpm seed`, `pnpm demo`, README |
| P1 | Pemindai QR, OG image dan endpoint metadata, activity feed, refund darurat 30 hari, UI dua bahasa, saran balasan satu ketuk, tes Playwright |
| P2 | Relayer gasless, kunci function-call untuk scanner, balas sekaligus, claim link, Intents |

## Rencana per hari

Hari 10 dan 11 November berkapasitas rendah karena ada komitmen lain. Rencana di bawah menganggap masing-masing hanya 2 sampai 3 jam efektif.

### Fase 1: Fondasi (Sen 9 Nov)
**Tujuan**: toolchain jalan, repo berdiri, dua kontrak berkompilasi.

- [ ] Buat repo `promise`, commit pertama, `.gitignore`, MIT license
- [ ] Workspace pnpm dan cargo (`contract/`, `frontend/`, `scripts/`)
- [ ] Pasang toolchain (Rust target wasm, cargo-near, near-cli-rs), kunci versi
- [ ] Buat akun root dari faucet, cek saldo, putuskan nama root final
- [ ] `tusdc`: NEP-141, `faucet`, `faucet_next_at`, `mint`, tes T-37 dan T-38
- [ ] `amplop`: struct, `new`, `create_hajat`, `invite`, `invite_many`, `join`, helper deposit storage
- [ ] Tes unit untuk validasi input dan penghitungan storage (T-01 sampai T-10 versi unit)

### Fase 2: Escrow inti (Sel 10 Nov, kapasitas rendah)
**Tujuan**: uang bisa masuk dan keluar dengan aman.

- [ ] `ft_on_transfer` dengan semua penolakan lunak
- [ ] `check_in`, `open`, `start_open`, `on_open_resolved` (dua fase, rollback)
- [ ] Tes sandbox T-11 sampai T-19

### Fase 3: Batal dan refund (Rab 11 Nov, kapasitas rendah)
**Tujuan**: tamu tidak pernah terkunci.

- [ ] `cancel_hajat`, `refund`, `on_refund_resolved`
- [ ] `nft_transfer` selalu `ERR_SOULBOUND`, view dasar NEP-171
- [ ] Tes T-28, T-32 sampai T-36
- [ ] Deploy ke testnet pertama kali, `get_config` benar

### Fase 4: Diferensiator (Kam 12 Nov, hari penuh)
**Tujuan**: ledger dan kartu dinamis, bagian yang membuat Promise berbeda dari app angpao lain.

- [ ] `settle`, `pairs`, `owed_to`, `owes`, `get_ledger`, `get_pair`, `suggest_reply`
- [ ] Tes T-20 sampai T-27 termasuk tes properti invarian
- [ ] `render_svg`, `nft_token` dinamis, escape, ukuran di bawah 3 KB, T-29 sampai T-31
- [ ] Skrip `deploy.ts` dan `seed.ts`
- [ ] Scaffold frontend: tema, `AppSigner`, `DemoSigner`, `/demo`, `/app/hajat/new`

### Fase 5: Aplikasi dan demo (Jum 13 Nov, hari penuh)
**Tujuan**: seluruh cerita bisa diklik.

- [ ] Halaman host, undangan, Neraca, profil
- [ ] `pnpm demo` dengan minimal 12 tautan explorer
- [ ] Route handler `/api/nft`, `/api/og`, `/api/health`
- [ ] README final tanpa `TODO(deploy)`
- [ ] **Contract freeze 14:00 UTC**. Setelah ini tidak ada deploy kontrak. Seed ulang terakhir, catat token id di DEMO.md

### Fase 6: Rilis (Sab 14 Nov)
**Tujuan**: submit dengan jeda aman.

- [ ] 00:00 sampai 06:00 UTC: perbaikan bug UI saja, tes manual di HP dengan wallet asli sekali
- [ ] Rekam video 2.5 menit, unggah ke X
- [ ] 09:00 UTC: repo dibuat publik (oleh kamu), post X terbit (oleh kamu)
- [ ] 12:00 UTC: agen mencetak payload, kamu setujui, satu kali POST
- [ ] Simpan respons 201 dan tangkapan layar

## Garis potong

Aturan keputusan supaya tidak berdebat dengan diri sendiri saat waktu sempit.

| Jika pada waktu ini belum selesai | Maka |
| --- | --- |
| Rab 11 Nov malam: `open` dan rollback belum lulus tes | Buang `Opening`/callback rumit, lihat apakah `ft_transfer` tanpa fase kedua cukup untuk demo, tulis batasan di README. Jangan lanjut ke ledger sebelum uang aman |
| Kam 12 Nov malam: ledger belum lulus T-20 sampai T-24 | Kurangi `MAX_SETTLE` menjadi 1 dan hanya dukung pelunasan penuh atau parsial satu klaim. Ledger tetap ada, lebih sederhana |
| Jum 13 Nov siang: UI belum selesai | `pnpm demo` jadi demo utama, UI hanya `/demo`, host page, invitation page. Neraca boleh tabel polos |
| Jum 13 Nov 14:00 UTC: apa pun | Freeze kontrak. Perbaikan setelah ini hanya di web |
| Sab 14 Nov 06:00 UTC: video belum direkam | Rekam dari `pnpm demo` di terminal ditambah satu layar kartu. Cukup |

## Parking lot (setelah MVP)

- Vault per hajat sebagai sub-account memakai global contract (biaya bakar 10 NEAR per 100 KB, hanya masuk akal di mainnet)
- Privasi nominal: nominal terenkripsi, hanya pemberi dan penerima yang melihat
- Claim link untuk tamu yang belum punya akun NEAR
- Panitia keluarga sebagai Sputnik DAO atau Trezu untuk mengelola dana hajat
- Hak balas yang dapat diwariskan ke anggota keluarga
- Pembayaran lintas chain lewat NEAR Intents saat 1Click tersedia di testnet
- Indexer dan cache Postgres, dasbor analitik hajat
- Aplikasi PWA dengan notifikasi "saatnya membalas"
- Mainnet setelah audit dan kajian regulasi

## Definition of Done

Sebuah task dianggap selesai jika:

- Kode dikompilasi tanpa peringatan baru, `pnpm typecheck` dan `pnpm lint` lulus
- Tes yang sesuai di CONTRACTS.md bagian 12 ada dan lulus, atau halaman berjalan di mode demo
- Dokumen yang terdampak diperbarui pada commit yang sama
- Tidak ada rahasia baru di repo
- Commit memakai pesan conventional commits
