# Requirements

Terakhir diperbarui: 2026-11-09. Pemilik: Imanuel (solo). Bahasa dokumen: Indonesia. Istilah teknis dan nama method tetap bahasa Inggris.

## Problem Statement

Di Indonesia dan banyak negara Asia, amplop di acara pernikahan, khitanan, atau syukuran adalah utang kehormatan. Pemberi berharap dibalas dengan nilai yang sama atau lebih saat ia punya hajat. Catatannya hidup di buku tamu kertas yang bisa hilang, tertukar, atau diperdebatkan keluarga bertahun-tahun kemudian. Aplikasi angpao digital yang ada hanya mengirim uang. Tidak ada yang mencatat siapa berutang amplop kepada siapa.

Promise memindahkan amplop ke NEAR sebagai NFT undangan yang menahan uang sampai hari acara, lalu mencatat kewajiban balasnya di kontrak sehingga catatan itu tidak bisa diubah sepihak.

## Goals dan Non-Goals

### Goals (in scope)

- G1. Satu hajat dapat dibuat, tamu diundang, amplop disegel, dibuka, dan dibatalkan sepenuhnya on-chain di NEAR testnet.
- G2. Catatan utang budi (ledger) per pasangan akun dihitung otomatis, dilunasi dari yang terlama, dan bisa dibaca lewat satu view call.
- G3. Kartu NFT berubah tampilan sesuai status dan dibuat oleh kontrak, bukan server.
- G4. Orang yang belum punya wallet dapat mencoba seluruh alur dalam waktu 5 menit lewat mode demo.
- G5. Siap submit sebelum 2026-11-14T23:59:00Z dengan repo publik, video demo, dan README yang bisa dijalankan juri AI.

### Non-Goals (tidak dibangun)

- NG1. Mainnet, uang sungguhan, dan integrasi on/off-ramp rupiah.
- NG2. AI agent dalam bentuk apa pun.
- NG3. Pemaksaan pembayaran balasan. Ledger adalah catatan sosial, bukan kontrak hukum.
- NG4. Privasi nominal (ZK, enkripsi). Dicatat sebagai roadmap.
- NG5. NFT yang bisa diperjualbelikan. Undangan sengaja soulbound.
- NG6. Sub-account per hajat atau per undangan, dan global contract. Alasan di ARCHITECTURE.md keputusan D1.
- NG7. Database, indexer pihak ketiga, dan akun pengguna di server.
- NG8. Aplikasi mobile native. Web mobile-first sudah cukup.
- NG9. Pembayaran lintas chain lewat NEAR Intents. 1Click tidak dapat diandalkan di testnet.

## Functional Requirements

Prioritas: P0 wajib untuk demo, P1 dikerjakan jika P0 selesai, P2 hanya jika ada sisa waktu.

### FR-01: Buat hajat (P0)
- Deskripsi: pengguna membuat acara dan menjadi host.
- Input: title (1-80 karakter), kind (`wedding|khitan|birth|syukuran|duka|other`), venue (0-80 karakter), event_at_ms (sekarang sampai +365 hari), join_policy (`invite_only|open_link`).
- Output: `hajat_id` baru, event `hajat_created`.
- Kriteria: transaksi sukses dengan deposit storage 0.02 NEAR, kelebihan dikembalikan; input di luar batas ditolak dengan kode `ERR_*`.

### FR-02: Undang tamu langsung (P0)
- Deskripsi: host mengundang akun NEAR tertentu. Kontrak mencetak NFT undangan ke akun itu.
- Input: `hajat_id`, `guest` (account id), `label` (1-40 karakter, nama tampilan).
- Output: `token_id`, event `invited` dan `nft_mint`.
- Kriteria: satu akun hanya boleh punya satu undangan per hajat; maksimum 200 undangan per hajat; `invite_many` menerima sampai 20 tamu per transaksi.

### FR-03: Gabung lewat tautan terbuka (P0)
- Deskripsi: jika hajat berstatus `open_link`, siapa pun yang punya tautan dapat RSVP dan mendapat undangan.
- Input: `hajat_id`, `label`.
- Output: undangan atas nama pemanggil.
- Kriteria: ditolak jika kebijakan `invite_only`, jika sudah punya undangan, atau jika kuota 200 penuh.

### FR-04: Undangan soulbound (P0)
- Deskripsi: NFT mengikuti NEP-171 dan NEP-177 tetapi tidak dapat dipindahkan.
- Kriteria: `nft_transfer` dan `nft_transfer_call` selalu gagal dengan `ERR_SOULBOUND`; `nft_tokens_for_owner` mengembalikan undangan milik akun.

### FR-05: Segel amplop (P0)
- Deskripsi: tamu mengunci tUSDC di dalam undangannya lewat `ft_transfer_call`.
- Input: jumlah (minimum 0.01 tUSDC), `msg` JSON `{"token_id":"..","note":".."}` dengan note maksimum 140 karakter.
- Output: status undangan `Sealed`, event `sealed`.
- Kriteria: hanya pemilik undangan yang boleh menyegel; hajat harus `Open`; penambahan jumlah (top-up) diperbolehkan sebelum dibuka; transfer yang tidak valid mengembalikan seluruh jumlah ke pengirim.

### FR-06: Buka amplop dan check-in (P0)
- Deskripsi: host membuka amplop tamu. Uang pindah ke host.
- Aturan waktu: host boleh sejak `event_at - 24 jam`; siapa pun boleh setelah `event_at + 24 jam` (amplop titipan).
- Output: status `Opened`, saldo tUSDC host naik, event `opened`.
- Kriteria: dua fase (`Opening` lalu `Opened`); jika `ft_transfer` gagal (misalnya host belum terdaftar di tUSDC) status kembali `Sealed` dan tidak ada uang hilang.

### FR-07: Batalkan hajat dan refund (P0)
- Deskripsi: host membatalkan hajat selama belum ada amplop yang dibuka. Setiap tamu atau siapa pun dapat memicu refund amplop yang tersegel kepada pemiliknya.
- Kriteria: pembatalan ditolak jika ada undangan `Opened`; refund selalu menuju pemilik undangan, bukan pemanggil.

### FR-08: Refund darurat (P1)
- Deskripsi: jika amplop tetap `Sealed` lebih dari 30 hari setelah `event_at`, pemilik dapat menariknya.
- Kriteria: tamu tidak pernah terkunci permanen oleh host yang menghilang.

### FR-09: Ledger utang budi dan pelunasan otomatis (P0)
- Deskripsi: setiap amplop yang dibuka menjadi klaim (pemberi menjadi kreditur, host menjadi debitur). Saat amplop baru dibuka, kontrak melunasi klaim lama antara pasangan yang sama arah sebaliknya, dari yang terlama, maksimum 10 klaim per pembukaan. Sisa nilai menjadi klaim baru.
- Output: `get_ledger(account)` dengan baris `owed_to_me` dan `i_owe`; event `repaid`.
- Kriteria: jumlah lunas tidak pernah melebihi nilai klaim; total `settled + credit` token sama dengan jumlah yang dibuka; test T-20 sampai T-27 lulus.

### FR-10: Kartu NFT dinamis (P0)
- Deskripsi: `nft_token` menghitung `metadata` dan `media` (SVG data URI) setiap dipanggil.
- Kriteria: ada tampilan berbeda untuk `Invited`, `Sealed`, `Opened`, `Repaid`, `Reply`, `Refunded`; nominal disembunyikan selama `Sealed`; ukuran SVG di bawah 2 KB.

### FR-11: Halaman Neraca (P0)
- Deskripsi: UI menampilkan siapa berutang kepada saya dan kepada siapa saya berutang, dengan rincian token.
- Kriteria: data muncul maksimum 2 detik setelah transaksi final pada koneksi 4G.

### FR-12: Saran balasan satu ketuk (P1)
- Deskripsi: di halaman undangan, jika tamu berutang kepada host, tombol "Bayar balasan" mengisi jumlah dari `get_pair(host, tamu).remaining`.
- Kriteria: jumlah default sama persis dengan nilai ledger.

### FR-13: Faucet tUSDC dan registrasi storage (P0)
- Deskripsi: `faucet()` pada tUSDC memberi 100 tUSDC per akun per 6 jam dan mendaftarkan akun otomatis.
- Kriteria: akun baru dapat menyegel amplop tanpa langkah `storage_deposit` manual.

### FR-14: Mode demo persona (P0)
- Deskripsi: halaman `/demo` memuat lima persona (Ayu, Budi, Citra, Dewi, Eko) dengan kunci testnet publik dan penukar persona.
- Kriteria: seluruh langkah README bagian "Try it" dapat dijalankan tanpa wallet; pesan jelas bahwa ini akun demo.

### FR-15: Pemindai QR di pintu (P1)
- Deskripsi: host memindai QR undangan (berisi `token_id`) untuk memanggil `check_in`. Fallback: input manual `token_id`.
- Kriteria: dari scan sampai transaksi terkirim kurang dari 5 detik pada mode demo.

### FR-16: Endpoint metadata dan OG image (P1)
- Deskripsi: backend menyajikan JSON NEP-177 dan gambar OG 1200x630 untuk hajat dan undangan.
- Kriteria: URL `reference` pada metadata token dapat dibuka dan valid.

### FR-17: Activity feed (P1)
- Deskripsi: kontrak menyimpan log aktivitas yang dapat dibaca lewat `get_activity(from, limit)`.
- Kriteria: 5000 entri pertama tersimpan; UI menampilkan 20 terbaru.

### FR-18: Skrip demo CLI (P0)
- Deskripsi: `pnpm demo` menjalankan cerita lengkap di testnet dan mencetak tautan NearBlocks per langkah.
- Kriteria: selesai kurang dari 3 menit; keluar dengan kode non-nol jika ada langkah gagal; dapat dijalankan agen AI tanpa input.

### FR-19: Relayer gasless (P2)
- Deskripsi: `/api/relay` meneruskan `SignedDelegate` (NEP-366) dari tamu.
- Kriteria: hanya method allowlist (`ft_transfer_call`, `storage_deposit`, `join`) dan batas 20 request per akun per jam.

### FR-20: Kunci function-call untuk scanner (P2)
- Deskripsi: host menambahkan access key terbatas pada `check_in` dan `open` supaya scanner tidak meminta persetujuan wallet setiap tamu.
- Kriteria: kunci hanya valid untuk kontrak amplop, allowance maksimum 0.25 NEAR, dapat dicabut dari UI.

### FR-21: Balas sekaligus (P2)
- Deskripsi: satu transaksi berisi beberapa `ft_transfer_call` ke beberapa hajat tempat pengguna diundang.

### FR-22: UI dua bahasa (P1)
- Deskripsi: Inggris (default) dan Indonesia, tombol ganti di header.
- Kriteria: tidak ada string UI yang ditulis langsung di komponen.

## Non-Functional Requirements

- Performa: view call lewat route handler dengan cache 10 detik dijawab p95 di bawah 1.5 detik; halaman `/` interaktif di bawah 3 detik pada 4G.
- Gas: `open` dengan 10 pelunasan di bawah 120 Tgas total; `ft_on_transfer` di bawah 30 Tgas; semua view di bawah 50 Tgas.
- Ukuran wasm: `amplop` di bawah 180 KB, `tusdc` di bawah 150 KB, dibangun dengan `opt-level = "z"`, `lto = true`.
- Keamanan: semua method mutasi memeriksa `predecessor_account_id`; callback bertanda `#[private]`; tidak ada loop tanpa batas; tidak ada rahasia di repo selain kunci persona demo.
- Ketersediaan: target testnet dengan RPC `https://test.rpc.fastnear.com` dan cadangan `https://rpc.testnet.near.org`. Tidak ada janji uptime.
- Aksesibilitas: kontras teks minimal 4.5:1, semua tombol dapat dijangkau keyboard, animasi mati jika `prefers-reduced-motion`.
- Kompatibilitas: Chrome, Safari iOS 16+, Firefox terbaru; lebar minimum 360 px.
- Dapat diverifikasi: setiap klaim di README dapat dibuktikan dengan satu view call atau satu tautan NearBlocks.

## Constraints

- Satu pengembang. Waktu efektif sekitar 3.5 hari kerja penuh sampai 2026-11-14T23:59:00Z. Tanggal 10 dan 11 November berkapasitas rendah.
- Testnet saja, tanpa dana sungguhan. Faucet NEAR membatasi saldo, jadi kontrak harus kecil dan penyimpanan harus hemat.
- Aturan hackathon: repo publik sebelum batas akhir, post demo di X oleh pengguna sendiri, satu submission per tim yang tidak bisa diedit.
- Global contract membakar 10 NEAR per 100 KB dan tidak bisa dikembalikan, sehingga tidak dipakai.
- Semua pembaruan kontrak terjadi dengan deploy ulang. Tidak ada migrasi state setelah submission.

## Assumptions

- A1. Juri mengerti konsep angpao atau punya padanannya di budayanya. Demo tetap menjelaskan dalam 15 detik.
- A2. Juri AI dapat menjalankan `pnpm demo` atau membuka `/demo`. README memuat keduanya.
- A3. FastNEAR RPC testnet tetap tersedia selama penjurian. Fallback RPC dikonfigurasi.
- A4. Akun testnet `promisedemo.testnet` dan sub-akun persona masih tersedia. Jika sudah dipakai orang lain, ganti prefiks lewat `.env.deploy`.
- A5. Versi library (near-sdk 5.x, near-api-js v7+, near-connect 0.11.x) dikunci saat instalasi setelah dicek dengan `npm view` dan `cargo search`.

## Kriteria Penerimaan Akhir

1. Cerita 7 langkah di README berjalan dari awal sampai akhir pada deploy testnet tanpa intervensi manual.
2. Semua test T-01 sampai T-40 di CONTRACTS.md hijau.
3. `pnpm demo` selesai dengan kode 0 dan mencetak minimal 12 tautan NearBlocks.
4. Repo publik, README tidak memuat `TODO(deploy)`, video demo di bawah 3 menit, post X sudah terbit.
