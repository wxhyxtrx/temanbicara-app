"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Brain,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Calendar,
  HeartHandshake,
  HeartPulse,
  Activity,
  History,
  FileCheck2,
} from "lucide-react";
import {
  useAssessmentStore,
  dass21Questions,
  calculateSeverity,
  DASS21Result,
} from "@/store/assessment-store";

const likertOptions = [
  { value: 0, label: "Tidak Pernah", desc: "Tidak pernah dialami sepekan ini" },
  { value: 1, label: "Kadang-kadang", desc: "Dialami 1-2 hari sepekan" },
  { value: 2, label: "Sering", desc: "Dialami 3-4 hari sepekan" },
  { value: 3, label: "Hampir Selalu", desc: "Dialami 5-7 hari sepekan" },
];

export default function PatientAssessmentPage() {
  const { dassResults, latestResult, saveDASSResult } = useAssessmentStore();

  const [activeTab, setActiveTab] = useState<"quiz" | "result" | "history">(latestResult ? "result" : "quiz");
  const [answers, setAnswers] = useState<Record<number, number>>(latestResult?.answers || {});
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pageSize = 7;
  const totalPages = Math.ceil(dass21Questions.length / pageSize);
  const pageQuestions = dass21Questions.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const answeredCount = Object.keys(answers).length;
  const progressPercent = Math.round((answeredCount / 21) * 100);

  const handleSelectOption = (questionId: number, value: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmitQuiz = () => {
    if (answeredCount < 21) {
      alert("Harap jawab seluruh 21 pertanyaan sebelum menghitung hasil.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      saveDASSResult(answers);
      setIsSubmitting(false);
      setActiveTab("result");
    }, 600);
  };

  const handleRetake = () => {
    setAnswers({});
    setCurrentPage(0);
    setActiveTab("quiz");
  };

  const resultToShow = latestResult || dassResults[0];

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-xs font-semibold">
            <Brain size={14} />
            <span>Instrumen Terstandar HIMPSI</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
            Asesmen Mandiri Kondisi Batin (DASS-21)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Depression, Anxiety, and Stress Scale — Mengukur tingkat keparahan emosional selama 7 hari terakhir
          </p>
        </div>

        {/* Tab Navigator */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl shrink-0 self-start sm:self-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("result")}
            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeTab === "result"
                ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs font-bold"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Hasil & Rekomendasi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("quiz")}
            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeTab === "quiz"
                ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs font-bold"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Kuesioner (21 Butir)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeTab === "history"
                ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs font-bold"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Riwayat Asesmen
          </button>
        </div>
      </div>

      {/* VIEW 1: KUESIONER DASS-21 */}
      {activeTab === "quiz" && (
        <div className="space-y-6">
          {/* Progress Header Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <FileCheck2 size={15} className="text-teal-600" />
                <span>Pertanyaan {currentPage * pageSize + 1} - {Math.min((currentPage + 1) * pageSize, 21)} dari 21</span>
              </span>
              <span className="text-teal-700 dark:text-teal-400 font-mono font-bold">
                {answeredCount} / 21 Terjawab ({progressPercent}%)
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 font-nunito">
              Petunjuk: Pilih opsi yang paling menggambarkan apa yang Anda rasakan selama <strong>sepekan terakhir</strong>. Tidak ada jawaban benar atau salah.
            </p>
          </div>

          {/* List of Questions for Current Page */}
          <div className="space-y-4">
            {pageQuestions.map((q) => {
              const selectedVal = answers[q.id];
              return (
                <Card
                  key={q.id}
                  className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
                >
                  <CardContent className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-bold text-xs flex items-center justify-center shrink-0 font-mono">
                        {q.id}
                      </span>
                      <p className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white leading-relaxed">
                        {q.text}
                      </p>
                    </div>

                    {/* 4 Likert Options */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 pl-9">
                      {likertOptions.map((opt) => {
                        const isSelected = selectedVal === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleSelectOption(q.id, opt.value)}
                            className={`p-2.5 rounded-xl text-left border text-xs transition-all cursor-pointer ${
                              isSelected
                                ? "bg-teal-600 text-white border-teal-600 font-semibold shadow-2xs"
                                : "bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            <span className="block font-bold text-xs">{opt.label}</span>
                            <span
                              className={`text-[10px] block mt-0.5 ${
                                isSelected ? "text-teal-100" : "text-slate-400"
                              }`}
                            >
                              {opt.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              className="text-xs rounded-xl h-10 px-4 font-semibold cursor-pointer gap-1"
            >
              <ArrowLeft size={14} />
              <span>Halaman Sebelumnya</span>
            </Button>

            {currentPage < totalPages - 1 ? (
              <Button
                onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-10 px-5 font-semibold cursor-pointer gap-1"
              >
                <span>Halaman Selanjutnya</span>
                <ArrowRight size={14} />
              </Button>
            ) : (
              <Button
                disabled={answeredCount < 21 || isSubmitting}
                onClick={handleSubmitQuiz}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-6 font-semibold shadow-xs cursor-pointer gap-1.5"
              >
                <CheckCircle2 size={15} />
                <span>{isSubmitting ? "Menghitung Hasil..." : "Selesai & Lihat Hasil Asesmen"}</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: HASIL ASESMEN & REKOMENDASI TERPADU */}
      {activeTab === "result" && resultToShow && (
        <div className="space-y-6 sm:space-y-8">
          {/* Card Triad Tingkat Keparahan */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Depresi */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Skala Depresi</span>
                <Badge className={`text-xs font-semibold ${
                  resultToShow.depressionSeverity === "Normal"
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : resultToShow.depressionSeverity === "Ringan"
                    ? "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                    : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                }`}>
                  {resultToShow.depressionSeverity}
                </Badge>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold font-heading text-slate-900 dark:text-white">
                  {resultToShow.depressionScore}
                </span>
                <span className="text-xs text-slate-400">/ 42 Skor</span>
              </div>
              <p className="text-[11px] text-slate-500 font-nunito leading-relaxed">
                Tingkat kehilangan minat, antusiasme, dan pandangan optimisme terhadap masa depan.
              </p>
            </div>

            {/* Ansietas */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Skala Ansietas</span>
                <Badge className={`text-xs font-semibold ${
                  resultToShow.anxietySeverity === "Normal"
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : resultToShow.anxietySeverity === "Ringan"
                    ? "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                    : "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                }`}>
                  {resultToShow.anxietySeverity}
                </Badge>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold font-heading text-slate-900 dark:text-white">
                  {resultToShow.anxietyScore}
                </span>
                <span className="text-xs text-slate-400">/ 42 Skor</span>
              </div>
              <p className="text-[11px] text-slate-500 font-nunito leading-relaxed">
                Tingkat reaksi fisiologis kegelisahan (palpitasi, gemetar, sesak napas antisipatif).
              </p>
            </div>

            {/* Stres */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Skala Stres</span>
                <Badge className={`text-xs font-semibold ${
                  resultToShow.stressSeverity === "Normal"
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : resultToShow.stressSeverity === "Ringan"
                    ? "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                    : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                }`}>
                  {resultToShow.stressSeverity}
                </Badge>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold font-heading text-slate-900 dark:text-white">
                  {resultToShow.stressScore}
                </span>
                <span className="text-xs text-slate-400">/ 42 Skor</span>
              </div>
              <p className="text-[11px] text-slate-500 font-nunito leading-relaxed">
                Tingkat ketegangan saraf kronis, kesulitan untuk rileks, dan reaktivitas terhadap hambatan.
              </p>
            </div>
          </div>

          {/* Clinical Interpretation & Integrated Action Plan */}
          <Card className="rounded-3xl border border-teal-200/90 dark:border-teal-800 bg-gradient-to-br from-teal-50/50 via-white to-emerald-50/40 dark:from-teal-950/30 dark:via-slate-900 dark:to-slate-900 shadow-xs overflow-hidden">
            <CardHeader className="p-6 border-b border-teal-100 dark:border-teal-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <Sparkles size={14} />
                    Interpretasi Klinis & Rekomendasi Terpadu
                  </span>
                  <CardTitle className="font-heading text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                    Rencana Pemulihan Kesehatan Mental Anda
                  </CardTitle>
                </div>
                <span className="text-xs text-slate-400 font-mono self-start sm:self-center">
                  Tanggal Tes: {resultToShow.date}
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-teal-100 dark:border-teal-800/70 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-nunito">
                {resultToShow.recommendation}
              </div>

              {/* 3 Call-to-Action Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {/* Pillar 1: Booking Psikolog */}
                <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-850 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400">
                        <Calendar size={16} />
                      </span>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Psikolog Klinis</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 font-nunito leading-snug">
                      Konseling mendalam berlisensi SIPPK untuk restrukturisasi kecemasan & trauma.
                    </p>
                  </div>
                  <Link href="/patient/schedule?booking=true">
                    <Button className="w-full text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-8 font-semibold cursor-pointer">
                      Jadwalkan Konsultasi
                    </Button>
                  </Link>
                </div>

                {/* Pillar 2: Curhat Sebaya */}
                <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-850 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-pink-50 dark:bg-pink-950 text-pink-700 dark:text-pink-400">
                        <HeartHandshake size={16} />
                      </span>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Pendengar Sebaya</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 font-nunito leading-snug">
                      Curhat 100% anonim dan gratis dengan relawan terlatih Psychological First Aid.
                    </p>
                  </div>
                  <Link href="/patient/room?type=peer">
                    <Button variant="outline" className="w-full text-xs border-pink-200 dark:border-pink-900 text-pink-700 dark:text-pink-300 hover:bg-pink-50 rounded-xl h-8 font-semibold cursor-pointer">
                      Mulai Curhat Sebaya
                    </Button>
                  </Link>
                </div>

                {/* Pillar 3: AI Grounding */}
                <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-850 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400">
                        <Brain size={16} />
                      </span>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Refleksi AI</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 font-nunito leading-snug">
                      Panduan napas diafragma dan grounding instan 24 jam gratis kapan saja.
                    </p>
                  </div>
                  <Link href="/patient/beranda">
                    <Button variant="outline" className="w-full text-xs rounded-xl h-8 font-semibold cursor-pointer">
                      Latihan Pernapasan
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Retake Button */}
              <div className="pt-2 flex justify-end">
                <Button
                  variant="ghost"
                  onClick={handleRetake}
                  className="text-xs text-slate-500 hover:text-slate-800 gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={14} />
                  <span>Ulangi Tes Kuesioner</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* VIEW 3: RIWAYAT ASESMEN SEBELUMNYA */}
      {activeTab === "history" && (
        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History size={16} className="text-teal-600" />
              Riwayat Skor Asesmen DASS-21
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 font-nunito">
              Pantau tren pemulihan kesehatan mental Anda dari waktu ke waktu
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 text-slate-500 font-semibold">
                    <th className="p-3.5 pl-5">Tanggal & Waktu</th>
                    <th className="p-3.5">Depresi</th>
                    <th className="p-3.5">Ansietas</th>
                    <th className="p-3.5">Stres</th>
                    <th className="p-3.5 pr-5 text-right">Rangkuman Rekomendasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dassResults.map((res) => (
                    <tr key={res.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3.5 pl-5 font-mono font-medium text-slate-900 dark:text-white">
                        {res.date}
                      </td>
                      <td className="p-3.5">
                        <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[10px]">
                          {res.depressionScore} ({res.depressionSeverity})
                        </Badge>
                      </td>
                      <td className="p-3.5">
                        <Badge className="bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 text-[10px]">
                          {res.anxietyScore} ({res.anxietySeverity})
                        </Badge>
                      </td>
                      <td className="p-3.5">
                        <Badge className="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 text-[10px]">
                          {res.stressScore} ({res.stressSeverity})
                        </Badge>
                      </td>
                      <td className="p-3.5 pr-5 text-right text-slate-500 max-w-xs truncate text-[11px]">
                        {res.recommendation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
