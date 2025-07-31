"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MessageCircle, BookOpen, History, Star, Clock, ChevronRight, PlusCircle } from "lucide-react";

// Data konsultan terverifikasi
const verifiedConsultants = [
    {
        id: 1,
        name: "Dr. Anita Wijaya",
        specialty: "Psikolog Klinis",
        rating: 4.9,
        reviews: 124,
        avatar: "/images/mascot1.png",
        available: true,
    },
    {
        id: 2,
        name: "Budi Santoso, M.Psi",
        specialty: "Konselor Karier",
        rating: 4.7,
        reviews: 98,
        avatar: "/images/mascot1.png",
        available: true,
    },
    {
        id: 3,
        name: "Siti Rahayu, S.Psi",
        specialty: "Konselor Remaja",
        rating: 4.8,
        reviews: 112,
        avatar: "/images/mascot1.png",
        available: false,
    },
];

// Data jadwal sesi
const upcomingSessions = [
    {
        id: 1,
        consultant: "Dr. Anita Wijaya",
        date: "Senin, 15 Juli 2024",
        time: "14:00 - 15:00",
        status: "confirmed", // confirmed, pending, completed
    },
    {
        id: 2,
        consultant: "Budi Santoso, M.Psi",
        date: "Rabu, 17 Juli 2024",
        time: "10:00 - 11:00",
        status: "pending",
    },
];

// Data riwayat percakapan
const recentConversations = [
    {
        id: 1,
        with: "TemanBicara AI",
        lastMessage: "Terima kasih sudah berbagi cerita hari ini. Bagaimana perasaanmu sekarang?",
        time: "Kemarin, 20:45",
        avatar: "/images/mascot1.png",
    },
    {
        id: 2,
        with: "Dr. Anita Wijaya",
        lastMessage: "Jangan lupa latihan pernapasan yang sudah kita bahas ya.",
        time: "3 hari lalu",
        avatar: "/images/mascot1.png",
    },
];

function BerandaPage() {
    const [mood, setMood] = useState<string | null>(null);

    const moodOptions = [
        { value: "happy", label: "😊 Senang", color: "bg-green-100 text-green-800" },
        { value: "neutral", label: "😐 Biasa", color: "bg-blue-100 text-blue-800" },
        { value: "sad", label: "😔 Sedih", color: "bg-yellow-100 text-yellow-800" },
        { value: "anxious", label: "😰 Cemas", color: "bg-orange-100 text-orange-800" },
        { value: "stressed", label: "😫 Stres", color: "bg-red-100 text-red-800" },
    ];

    return (
        <div className='min-h-screen font-nunito pb-5'>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Kolom Kiri */}
                <div className="md:col-span-2 space-y-6">
                    {/* Mulai Percakapan Sekarang */}
                    <Card className="bg-gradient-to-r from-[#fff8ef] to-[#fee6ce] border-0 shadow-md overflow-hidden relative">
                        <div className="absolute right-0 bottom-0 w-32 h-32 opacity-20">
                            <div className="w-full h-full bg-primary rounded-full blur-3xl"></div>
                        </div>
                        <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="space-y-3 text-center md:text-left">
                                <h2 className="text-2xl md:text-3xl font-bold font-poppins text-foreground">Mulai Percakapan Sekarang</h2>
                                <p className="text-muted-foreground">Ceritakan apa yang kamu rasakan atau pilih konsultan untuk sesi bicara</p>
                                <div className="flex flex-col sm:flex-row gap-3 pt-2 max-md:justify-center">
                                    <Button className="bg-primary hover:bg-primary/90 gap-2">
                                        <MessageCircle size={18} />
                                        Mulai Chat dengan AI
                                    </Button>
                                    <Button variant="outline" className="border-primary text-primary hover:bg-primary/10 gap-2">
                                        <PlusCircle size={18} />
                                        Pilih Konsultan
                                    </Button>
                                </div>
                            </div>
                            <div className="hidden md:block">
                                <img src="/images/mascot1.png" alt="TemanBicara Mascot" className="w-32 h-32 object-contain" />
                            </div>
                        </CardContent>
                    </Card>

                    <div className='grid sm:grid-cols-2 md:grid-cols-3 gap-6'>
                        {/* Catatan atau Insight Harian */}
                        <Card className='md:col-span-2'>
                            <CardHeader>
                                <CardTitle className="font-poppins text-lg">Bagaimana Perasaanmu Hari Ini?</CardTitle>
                                <CardDescription>Pilih mood yang paling menggambarkan perasaanmu saat ini</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {moodOptions.map((option) => (
                                        <Button
                                            key={option.value}
                                            variant={mood === option.value ? "default" : "outline"}
                                            className={`${mood === option.value ? option.color : 'border-gray-200'} transition-all`}
                                            onClick={() => setMood(option.value)}
                                        >
                                            {option.label}
                                        </Button>
                                    ))}
                                </div>
                                {mood && (
                                    <div className="mt-4 p-4 bg-secondary-background rounded-lg">
                                        <p className="text-sm font-medium">Kutipan Hari Ini:</p>
                                        <p className="italic text-muted-foreground mt-1">
                                            "Mengenali perasaan adalah langkah pertama untuk memahami diri sendiri. Beri dirimu ruang untuk merasakan."
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        {/* Promo / Upgrade Akun */}
                        <Card className="bg-gradient-to-br from-[#f5786a]/20 to-[#f5786a]/40 border-0 overflow-hidden relative justify-center">
                            <CardContent className="p-6">
                                <div className="flex flex-col items-center text-center gap-3">
                                    <Badge variant="outline" className="bg-white/80 border-0 text-primary font-medium px-3 py-1">
                                        Premium
                                    </Badge>
                                    <h3 className="text-lg font-bold font-poppins">Tingkatkan ke Premium</h3>
                                    <p className="text-sm text-muted-foreground">Akses konsultan 24/7, sesi tak terbatas, dan fitur eksklusif</p>
                                    <Button className="w-full mt-2 bg-primary hover:bg-primary/90">
                                        Upgrade Sekarang
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Jadwal Sesi Anda */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div>
                                <CardTitle className="font-poppins text-lg">Jadwal Sesi Anda</CardTitle>
                                <CardDescription>Sesi konsultasi yang akan datang</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" className="text-primary gap-1">
                                Lihat Semua <ChevronRight size={16} />
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {upcomingSessions.length > 0 ? (
                                <div className="space-y-4">
                                    {upcomingSessions.map((session) => (
                                        <div key={session.id} className="flex items-center justify-between p-3 bg-secondary-background/50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-white p-2 rounded-full">
                                                    <Calendar size={20} className="text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">{session.consultant}</p>
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <span>{session.date}</span>
                                                        <span>•</span>
                                                        <span>{session.time}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge
                                                variant={session.status === 'confirmed' ? 'default' : 'outline'}
                                                className={session.status === 'confirmed' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'border-orange-200 text-orange-800'}
                                            >
                                                {session.status === 'confirmed' ? 'Terkonfirmasi' : 'Menunggu'}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <p className="text-muted-foreground">Belum ada jadwal sesi yang akan datang</p>
                                    <Button variant="outline" className="mt-2 border-primary text-primary hover:bg-primary/10">
                                        Buat Jadwal Baru
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>


                </div>

                {/* Kolom Kanan */}
                <div className="md:col-span-2 lg:col-span-1 space-y-6">
                    {/* Konsultan Terverifikasi */}
                    <Card>
                        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2">
                            <div>
                                <CardTitle className="font-poppins text-lg">Konsultan Terverifikasi</CardTitle>
                                <CardDescription>Profesional siap membantu Anda</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" className="text-primary gap-1 mt-2 sm:mt-0">
                                Lihat Semua <ChevronRight size={16} />
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {verifiedConsultants.map((consultant) => (
                                    <div key={consultant.id} className="p-3 bg-secondary-background/50 rounded-lg">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                            <Avatar className="w-12 h-12 border-2 border-primary/20">
                                                <AvatarImage src={consultant.avatar} alt={consultant.name} />
                                                <AvatarFallback>{consultant.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="mt-2 sm:mt-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-medium">{consultant.name}</p>
                                                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                                                        Verified
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{consultant.specialty}</p>
                                                <div className="flex items-center gap-1 mt-1">
                                                    <Star size={14} className="text-yellow-500 fill-yellow-500" />
                                                    <span className="text-sm font-medium">{consultant.rating}</span>
                                                    <span className="text-xs text-muted-foreground">({consultant.reviews} ulasan)</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex flex-col sm:flex-row gap-2">
                                            <Button size="sm" variant="outline" className="text-xs border-primary text-primary hover:bg-primary/10 flex-1">
                                                Lihat Profil
                                            </Button>
                                            <Button size="sm" className="text-xs bg-primary hover:bg-primary/90 flex-1">
                                                {consultant.available ? 'Jadwalkan Sesi' : 'Ajukan Pertanyaan'}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Riwayat Singkat Percakapan */}
                    <Card>
                        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2">
                            <div>
                                <CardTitle className="font-poppins text-lg">Riwayat Percakapan</CardTitle>
                                <CardDescription>Percakapan terbaru Anda</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" className="text-primary gap-1 mt-2 sm:mt-0">
                                Lihat Semua <ChevronRight size={16} />
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {recentConversations.map((conversation) => (
                                    <div key={conversation.id} className="p-3 bg-secondary-background/50 rounded-lg">
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <Avatar className="w-10 h-10">
                                                <AvatarImage src={conversation.avatar} alt={conversation.with} />
                                                <AvatarFallback>{conversation.with.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 mt-2 sm:mt-0">
                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                                                    <p className="font-medium">{conversation.with}</p>
                                                    <span className="text-xs text-muted-foreground">{conversation.time}</span>
                                                </div>
                                                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{conversation.lastMessage}</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="w-full mt-2 text-primary hover:bg-primary/10">
                                            Lanjutkan Chat
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

export default BerandaPage
