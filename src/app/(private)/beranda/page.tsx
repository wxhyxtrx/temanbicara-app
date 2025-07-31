"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { moodOptions, recentConversations, upcomingSessions, verifiedConsultants } from "@/constant/beranda";
import { Calendar, ChevronRight, MessageCircle, PlusCircle, Star } from "lucide-react";
import { useState } from 'react';
import { MdVerified } from "react-icons/md";

function BerandaPage() {
    const [mood, setMood] = useState<string | null>(null);

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
                                                    {/* <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                                                        Verified
                                                    </Badge> */}
                                                    <span className="!text-shadow-blue-400">
                                                        <MdVerified className="text-xl" color="#4299E1" />
                                                    </span>
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
                                            <Button variant="outline" className="text-xs border-primary text-primary hover:bg-primary/10 flex-1">
                                                Lihat Profil
                                            </Button>
                                            <Button className="text-xs bg-primary hover:bg-primary/90 flex-1">
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
