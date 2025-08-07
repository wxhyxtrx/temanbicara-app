"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search, HelpCircle, MessageCircle, FileText, Settings, Shield } from "lucide-react";
import { useState } from 'react';

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState("");

  // Data FAQ
  const faqCategories = [
    {
      id: "account",
      title: "Akun & Profil",
      icon: <Settings size={18} />,
      faqs: [
        {
          question: "Bagaimana cara mengubah foto profil saya?",
          answer: "Anda dapat mengubah foto profil dengan mengakses halaman Pengaturan > Profil, lalu klik pada foto profil Anda dan pilih 'Unggah Foto'."
        },
        {
          question: "Bagaimana cara mengubah password akun saya?",
          answer: "Untuk mengubah password, kunjungi halaman Pengaturan > Keamanan, lalu masukkan password lama dan password baru Anda pada form yang tersedia."
        },
        {
          question: "Apakah saya bisa menghapus akun saya?",
          answer: "Ya, Anda dapat menghapus akun dengan mengakses Pengaturan > Keamanan > Hapus Akun. Perlu diingat bahwa tindakan ini tidak dapat dibatalkan dan semua data Anda akan dihapus secara permanen."
        }
      ]
    },
    {
      id: "payment",
      title: "Pembayaran & Koin",
      icon: <FileText size={18} />,
      faqs: [
        {
          question: "Bagaimana cara melakukan top-up koin?",
          answer: "Anda dapat melakukan top-up koin dengan mengakses halaman Top-up, pilih jumlah koin yang diinginkan, lalu ikuti petunjuk pembayaran yang tersedia."
        },
        {
          question: "Metode pembayaran apa saja yang tersedia?",
          answer: "Kami menerima pembayaran melalui transfer bank, e-wallet (OVO, GoPay, DANA), dan kartu kredit/debit."
        },
        {
          question: "Berapa lama proses verifikasi pembayaran?",
          answer: "Proses verifikasi pembayaran biasanya membutuhkan waktu 5-15 menit setelah pembayaran berhasil dilakukan. Jika dalam 1 jam belum terverifikasi, silakan hubungi tim dukungan kami."
        }
      ]
    },
    {
      id: "consultation",
      title: "Konsultasi & Chat",
      icon: <MessageCircle size={18} />,
      faqs: [
        {
          question: "Bagaimana cara memulai chat dengan konsultan?",
          answer: "Untuk memulai chat dengan konsultan, pilih konsultan yang tersedia di halaman Beranda atau halaman Konsultan, lalu klik tombol 'Mulai Chat' atau 'Jadwalkan Sesi'."
        },
        {
          question: "Berapa lama durasi satu sesi konsultasi?",
          answer: "Durasi standar untuk satu sesi konsultasi adalah 60 menit. Namun, Anda dapat memperpanjang sesi jika konsultan tersedia dan Anda memiliki koin yang cukup."
        },
        {
          question: "Apakah percakapan saya bersifat rahasia?",
          answer: "Ya, semua percakapan Anda dengan konsultan bersifat rahasia dan dilindungi oleh kebijakan privasi kami. Kami tidak akan membagikan informasi pribadi atau isi percakapan Anda kepada pihak ketiga tanpa persetujuan Anda."
        }
      ]
    },
    {
      id: "security",
      title: "Keamanan & Privasi",
      icon: <Shield size={18} />,
      faqs: [
        {
          question: "Bagaimana TemanBicara melindungi data pribadi saya?",
          answer: "TemanBicara menggunakan enkripsi end-to-end untuk melindungi semua percakapan dan data pribadi Anda. Kami juga menerapkan protokol keamanan yang ketat dan secara berkala melakukan audit keamanan."
        },
        {
          question: "Apakah saya bisa menggunakan TemanBicara secara anonim?",
          answer: "Ya, Anda dapat menggunakan nama samaran dan tidak perlu menampilkan foto asli Anda. Namun, untuk verifikasi akun, kami tetap memerlukan email yang valid."
        },
        {
          question: "Bagaimana cara mengaktifkan verifikasi dua faktor?",
          answer: "Untuk mengaktifkan verifikasi dua faktor, kunjungi Pengaturan > Keamanan > Verifikasi Dua Faktor, lalu ikuti petunjuk yang diberikan untuk mengaktifkan fitur tersebut."
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen font-nunito pb-5">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold font-poppins">Pusat Bantuan</h1>
          <p className="text-muted-foreground">Temukan jawaban untuk pertanyaan umum dan panduan penggunaan</p>
        </div>

        {/* Search Bar */}
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                <Input 
                  placeholder="Cari pertanyaan atau topik bantuan..." 
                  className="pl-10 h-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button className="bg-primary hover:bg-primary/90 w-full md:w-auto">
                Cari
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Tabs defaultValue="faq" className="w-full">
          <TabsList className="bg-secondary-background/50 p-1 mb-4 flex w-full sm:w-auto overflow-x-auto">
            <TabsTrigger value="faq" className="data-[state=active]:bg-white data-[state=active]:text-primary">
              <HelpCircle size={16} className="sm:mr-2" />
              <span className="hidden sm:inline">FAQ</span>
            </TabsTrigger>
            <TabsTrigger value="guides" className="data-[state=active]:bg-white data-[state=active]:text-primary">
              <FileText size={16} className="sm:mr-2" />
              <span className="hidden sm:inline">Panduan</span>
            </TabsTrigger>
            <TabsTrigger value="contact" className="data-[state=active]:bg-white data-[state=active]:text-primary">
              <MessageCircle size={16} className="sm:mr-2" />
              <span className="hidden sm:inline">Hubungi Kami</span>
            </TabsTrigger>
          </TabsList>

          {/* FAQ Tab */}
          <TabsContent value="faq" className="space-y-6">
            {faqCategories.map((category) => (
              <Card key={category.id}>
                <CardHeader className="bg-secondary-background/30">
                  <div className="flex items-center gap-2">
                    {category.icon}
                    <CardTitle className="font-poppins text-lg">{category.title}</CardTitle>
                  </div>
                  <CardDescription>Pertanyaan umum seputar {category.title.toLowerCase()}</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <Accordion type="single" collapsible className="w-full">
                    {category.faqs.map((faq, index) => (
                      <AccordionItem key={index} value={`item-${index}`} className="border-b border-secondary-background/50 last:border-0">
                        <AccordionTrigger className="text-left font-medium hover:text-primary">
                          {faq.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Guides Tab */}
          <TabsContent value="guides" className="space-y-6">
            <Card>
              <CardHeader className="bg-secondary-background/30">
                <CardTitle className="font-poppins text-lg">Panduan Penggunaan</CardTitle>
                <CardDescription>Pelajari cara menggunakan fitur-fitur TemanBicara</CardDescription>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Guide Cards */}
                <Card className="border border-secondary-background/50 hover:border-primary/30 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <MessageCircle size={20} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Memulai Chat dengan AI</h3>
                      <p className="text-sm text-muted-foreground">Panduan lengkap untuk memulai percakapan dengan AI TemanBicara</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border border-secondary-background/50 hover:border-primary/30 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <Settings size={20} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Mengatur Profil Anda</h3>
                      <p className="text-sm text-muted-foreground">Cara mengatur dan mempersonalisasi profil Anda</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border border-secondary-background/50 hover:border-primary/30 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <FileText size={20} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Melakukan Top-up Koin</h3>
                      <p className="text-sm text-muted-foreground">Panduan lengkap untuk melakukan top-up koin</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border border-secondary-background/50 hover:border-primary/30 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <Shield size={20} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Keamanan Akun</h3>
                      <p className="text-sm text-muted-foreground">Tips dan panduan untuk menjaga keamanan akun Anda</p>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contact Tab */}
          <TabsContent value="contact" className="space-y-6">
            <Card>
              <CardHeader className="bg-secondary-background/30">
                <CardTitle className="font-poppins text-lg">Hubungi Tim Dukungan</CardTitle>
                <CardDescription>Sampaikan pertanyaan atau masalah Anda kepada tim dukungan kami</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">Nama Lengkap</label>
                    <Input id="name" placeholder="Masukkan nama lengkap Anda" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">Email</label>
                    <Input id="email" type="email" placeholder="Masukkan email Anda" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="subject" className="text-sm font-medium">Subjek</label>
                  <Input id="subject" placeholder="Masukkan subjek pesan Anda" />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-medium">Pesan</label>
                  <textarea 
                    id="message" 
                    rows={5} 
                    className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="Jelaskan pertanyaan atau masalah Anda secara detail"
                  />
                </div>
                
                <div className="flex justify-end">
                  <Button className="bg-primary hover:bg-primary/90">Kirim Pesan</Button>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="bg-secondary-background/30">
                <CardTitle className="font-poppins text-lg">Informasi Kontak</CardTitle>
                <CardDescription>Cara lain untuk menghubungi kami</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-secondary-background/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <MessageCircle size={18} className="text-primary" />
                      </div>
                      <h3 className="font-medium">Email</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">info@temanbicara.com</p>
                    <p className="text-sm text-muted-foreground">support@temanbicara.com</p>
                  </div>
                  
                  <div className="p-4 bg-secondary-background/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <MessageCircle size={18} className="text-primary" />
                      </div>
                      <h3 className="font-medium">Telepon</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">+62 812 3456 7890</p>
                    <p className="text-sm text-muted-foreground">Senin - Jumat, 09:00 - 17:00 WIB</p>
                  </div>
                  
                  <div className="p-4 bg-secondary-background/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <MessageCircle size={18} className="text-primary" />
                      </div>
                      <h3 className="font-medium">Alamat</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Jl. Sudirman No. 123</p>
                    <p className="text-sm text-muted-foreground">Jakarta, Indonesia</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}