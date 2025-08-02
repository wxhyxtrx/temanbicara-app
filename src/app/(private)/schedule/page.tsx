"use client";

import TableInfo from '@/components/shared/atoms/Table/TableInfo';
import TablePagination from '@/components/shared/atoms/Table/TablePagination';
import Tables from '@/components/shared/atoms/Table/Tables';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon, PlusCircle, Search } from 'lucide-react';
import { useState } from 'react';

export default function SchedulePage() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)

  // Data jadwal sesi (contoh)
  const scheduleData = [
    {
      id: 1,
      date: "Kamis, 15 Agustus 2024",
      time: "14:00-15:00 WIB",
      consultant: "Rina Aulia, M.Psi",
      status: "terjadwal"
    },
    {
      id: 2,
      date: "Sabtu, 17 Agustus 2024",
      time: "10:00-11:00 WIB",
      consultant: "AI Konselor",
      status: "menunggu"
    },
    {
      id: 3,
      date: "Senin, 19 Agustus 2024",
      time: "16:00-17:00 WIB",
      consultant: "Budi Santoso, S.Psi",
      status: "selesai"
    }
  ]

  // Definisi kolom untuk tabel
  const columns = [
    {
      label: "Waktu",
      renderCell: (row: any) => (
        <div>
          <p className="font-medium">{row.date}</p>
          <p className="text-muted-foreground text-xs">{row.time}</p>
        </div>
      )
    },
    {
      label: "Konsultan",
      renderCell: (row: any) => <span>{row.consultant}</span>
    },
    {
      label: "Status",
      renderCell: (row: any) => {
        if (row.status === "terjadwal") {
          return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Terjadwal</Badge>
        } else if (row.status === "menunggu") {
          return <Badge variant="outline" className="border-orange-200 text-orange-800">Menunggu Konfirmasi</Badge>
        } else {
          return <Badge variant="outline" className="border-slate-200 text-slate-800">Selesai</Badge>
        }
      }
    },
    {
      label: "",
      renderCell: (row: any) => (
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" className="text-xs border-primary text-primary hover:bg-primary/10">
            Lihat Detail
          </Button>
          {row.status !== "selesai" && (
            <Button variant="outline" size="sm" className="text-xs border-red-200 text-red-800 hover:bg-red-50">
              Batalkan
            </Button>
          )}
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6 font-nunito w-full">
      <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-poppins">Jadwal Bicara Saya</h1>
          <p className="text-muted-foreground">Kelola jadwal sesi konsultasi Anda</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-primary text-primary hover:bg-primary/10 gap-1">
            <CalendarIcon size={16} /> Sinkronkan Kalender
          </Button>
          <Button className="bg-primary hover:bg-primary/90 gap-1">
            <PlusCircle size={16} /> Buat Janji Baru
          </Button>
        </div>
      </div>
      {/* Tabel Jadwal */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg font-poppins">Daftar Jadwal</CardTitle>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Cari konsultan..."
                className="pl-8 h-9 text-sm w-full md:w-60"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Tables
              columns={columns}
              data={scheduleData}
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
            />

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <TableInfo
                total={scheduleData.length}
                displayed={itemsPerPage}
                onChangeDisplayed={setItemsPerPage}
              />
              <TablePagination
                totalItems={scheduleData.length}
                page={currentPage}
                limit={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
