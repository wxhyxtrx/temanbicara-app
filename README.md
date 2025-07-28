# TemanBicara

TemanBicara adalah platform ramah dan aman di mana siapa pun dapat berbicara dengan pendengar yang suportif — secara anonim, aman, dan tanpa penilaian. Baik Anda merasa stres, cemas, atau hanya membutuhkan seseorang untuk diajak bicara, kami siap mendengarkan.

## ✨ Fitur

- 👂 Berbicara dengan Pendengar Terlatih : Terhubung dengan pendengar yang terverifikasi atau sesama pengguna yang ingin ada untuk Anda  
- 🔐 Anonim dan Aman : Komunikasi sepenuhnya anonim dan aman, identitas Anda adalah milik Anda untuk dibagikan atau tidak  
- 🎧 Antarmuka Chat Real-time : Dapatkan dukungan emosional melalui antarmuka chat yang intuitif  
- 🧡 Gratis dan Mudah Digunakan : Akses kapan saja, di mana saja, tanpa biaya  
- 👥 Komunitas yang Peduli : Kami membangun tidak hanya fitur, tetapi komunitas. Di TemanBicara, Anda tidak pernah sendirian

## 🛠️ Tech Stack

- Frontend : Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Shadcn UI, Zustand  
- Autentikasi : NextAuth.js  
- Design System : Tailwind + Shadcn  
- Deployment : Vercel

/src
  /app          # App routes
  /components   # Komponen UI yang dapat digunakan kembali (shadcn)
    /shared     # Komponen bersama (layouts, organisms, molecules)
    /ui         # Komponen UI dasar (shadcn ui components)
    /views      # Komponen khusus untuk tampilan per fitur (page)
  /constant     # Konstanta dan data statis
  /lib          # Utilitas dan helper
    /fonts      # Konfigurasi font
    utils.ts    # Fungsi utilitas
