"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Camera, Globe, Lock, Shield, User } from "lucide-react";
import { useState } from 'react';

export default function SettingsPage() {
  const [profileImage, setProfileImage] = useState("/images/mascot1.png");

  return (
    <div className="min-h-screen font-nunito pb-5">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold font-poppins">Pengaturan Akun</h1>
          <p className="text-muted-foreground">Kelola profil, preferensi, dan keamanan akun Anda</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="bg-secondary-background/50 p-1 mb-4 flex w-full sm:w-auto overflow-x-auto">
            <TabsTrigger value="profile" className="data-[state=active]:bg-white data-[state=active]:text-primary">
              <User size={16} className="sm:mr-2" />
              <span className="hidden sm:inline">Profil</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-white data-[state=active]:text-primary">
              <Bell size={16} className="sm:mr-2" />
              <span className="hidden sm:inline">Notifikasi</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-white data-[state=active]:text-primary">
              <Lock size={16} className="sm:mr-2" />
              <span className="hidden sm:inline">Keamanan</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="data-[state=active]:bg-white data-[state=active]:text-primary">
              <Globe size={16} className="sm:mr-2" />
              <span className="hidden sm:inline">Preferensi</span>
            </TabsTrigger>
          </TabsList>

          {/* Profil Tab */}
          <TabsContent value="profile" className="space-y-6">
            {/* Foto Profil */}
            <Card className="overflow-hidden">
              <CardHeader className="bg-secondary-background/30">
                <CardTitle className="font-poppins text-lg">Foto Profil</CardTitle>
                <CardDescription>Pilih foto yang mewakili diri Anda</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative">
                    <Avatar className="w-24 h-24 border-4 border-primary/20">
                      <AvatarImage src={profileImage} alt="Profile" />
                      <AvatarFallback>TB</AvatarFallback>
                    </Avatar>
                    <Button size="icon" variant="outline" className="absolute -bottom-2 -right-2 rounded-full bg-white border-primary text-primary hover:bg-primary/10">
                      <Camera size={16} />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Unggah gambar JPG, PNG, atau GIF dengan ukuran maksimal 2MB.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" className="text-primary border-primary hover:bg-primary/10">Unggah Foto</Button>
                      <Button variant="outline" className="text-muted-foreground">Hapus</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Informasi Pribadi */}
            <Card>
              <CardHeader className="bg-secondary-background/30">
                <CardTitle className="font-poppins text-lg">Informasi Pribadi</CardTitle>
                <CardDescription>Perbarui informasi profil Anda</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nama Lengkap</Label>
                    <Input id="fullName" placeholder="Nama Lengkap" defaultValue="Teman Bicara" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" placeholder="Username" defaultValue="temanbicara" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="Email" defaultValue="user@temanbicara.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Nomor Telepon</Label>
                    <Input id="phone" placeholder="Nomor Telepon" defaultValue="+62 812 3456 7890" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="bio">Bio</Label>
                    <textarea 
                      id="bio" 
                      className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      placeholder="Ceritakan sedikit tentang diri Anda"
                      defaultValue="Saya senang berbagi cerita dan mendengarkan orang lain."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline">Batal</Button>
                  <Button className="bg-primary hover:bg-primary/90">Simpan Perubahan</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifikasi Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader className="bg-secondary-background/30">
                <CardTitle className="font-poppins text-lg">Pengaturan Notifikasi</CardTitle>
                <CardDescription>Kelola preferensi notifikasi Anda</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Notifikasi Email</p>
                      <p className="text-sm text-muted-foreground">Terima notifikasi melalui email</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Notifikasi Aplikasi</p>
                      <p className="text-sm text-muted-foreground">Terima notifikasi dalam aplikasi</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Pengingat Sesi</p>
                      <p className="text-sm text-muted-foreground">Terima pengingat sebelum sesi dimulai</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Pesan Baru</p>
                      <p className="text-sm text-muted-foreground">Notifikasi saat ada pesan baru</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Pembaruan Sistem</p>
                      <p className="text-sm text-muted-foreground">Notifikasi tentang pembaruan sistem</p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Keamanan Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader className="bg-secondary-background/30">
                <CardTitle className="font-poppins text-lg">Ubah Password</CardTitle>
                <CardDescription>Perbarui password akun Anda</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Password Saat Ini</Label>
                    <Input id="currentPassword" type="password" placeholder="••••••••" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Password Baru</Label>
                    <Input id="newPassword" type="password" placeholder="••••••••" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
                    <Input id="confirmPassword" type="password" placeholder="••••••••" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline">Batal</Button>
                  <Button className="bg-primary hover:bg-primary/90">Perbarui Password</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-secondary-background/30">
                <CardTitle className="font-poppins text-lg">Verifikasi Dua Faktor</CardTitle>
                <CardDescription>Tingkatkan keamanan akun Anda</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Shield size={18} className="text-primary" />
                      <p className="font-medium">Autentikasi Dua Faktor</p>
                    </div>
                    <p className="text-sm text-muted-foreground">Tambahkan lapisan keamanan ekstra untuk akun Anda</p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferensi Tab */}
          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader className="bg-secondary-background/30">
                <CardTitle className="font-poppins text-lg">Preferensi Bahasa</CardTitle>
                <CardDescription>Pilih bahasa yang Anda inginkan</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <Label htmlFor="language">Bahasa</Label>
                  <Select defaultValue="id">
                    <SelectTrigger id="language" className="w-full sm:w-[240px]">
                      <SelectValue placeholder="Pilih bahasa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="id">Bahasa Indonesia</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="jw">Bahasa Jawa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-secondary-background/30">
                <CardTitle className="font-poppins text-lg">Tema Aplikasi</CardTitle>
                <CardDescription>Sesuaikan tampilan aplikasi</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Mode Gelap</p>
                      <p className="text-sm text-muted-foreground">Aktifkan mode gelap untuk tampilan yang lebih nyaman di malam hari</p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-secondary-background/30">
                <CardTitle className="font-poppins text-lg">Privasi</CardTitle>
                <CardDescription>Kelola pengaturan privasi Anda</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Profil Publik</p>
                      <p className="text-sm text-muted-foreground">Izinkan orang lain melihat profil Anda</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Status Online</p>
                      <p className="text-sm text-muted-foreground">Tampilkan status online Anda kepada orang lain</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
