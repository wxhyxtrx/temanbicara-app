"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Coins, CreditCard, Gift, Plus, ShoppingBag, Wallet, X } from "lucide-react";
import { useState } from 'react';

export default function TopUpPage() {
    const [coinAmount, setCoinAmount] = useState<number>(0);
    const [selectedPackage, setSelectedPackage] = useState<string>("");
    const [promoCode, setPromoCode] = useState<string>("");
    const [promoApplied, setPromoApplied] = useState<boolean>(false);
    const [promoDiscount, setPromoDiscount] = useState<number>(0);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("bca");

    // Paket coin yang tersedia
    const coinPackages = [
        { id: "basic", name: "Basic", amount: 50, price: 50000, discount: 0, popular: false },
        { id: "popular", name: "Popular", amount: 100, price: 95000, discount: 5, popular: true },
        { id: "premium", name: "Premium", amount: 200, price: 180000, discount: 10, popular: false },
        { id: "ultimate", name: "Ultimate", amount: 500, price: 425000, discount: 15, popular: false },
    ];

    // Metode pembayaran
    const paymentMethods = [
        { id: "bca", name: "BCA", type: "bank" },
        { id: "mandiri", name: "Mandiri", type: "bank" },
        { id: "bni", name: "BNI", type: "bank" },
        { id: "gopay", name: "GoPay", type: "ewallet" },
        { id: "ovo", name: "OVO", type: "ewallet" },
        { id: "dana", name: "DANA", type: "ewallet" },
    ];

    // Kode promo yang tersedia (simulasi)
    const availablePromoCodes = [
        { code: "WELCOME10", discount: 10 }, // 10% discount
        { code: "NEWUSER", discount: 15 },   // 15% discount
        { code: "SPECIAL20", discount: 20 },  // 20% discount
    ];

    // Handler untuk input jumlah coin
    const handleCoinAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value) || 0;
        setCoinAmount(value);
        
        // Hanya reset paket jika nilai input berbeda dengan paket yang dipilih
        const currentPackage = coinPackages.find(pkg => pkg.id === selectedPackage);
        if (currentPackage && currentPackage.amount !== value) {
            setSelectedPackage("");
        }
    };

    const handlePlusCoin = () => {
        setCoinAmount((prev) => prev + 10)
        setSelectedPackage("");
    }



    // Handler untuk memilih paket
    const handlePackageSelect = (packageId: string) => {
        // Jika paket yang sama diklik lagi, batalkan pemilihan
        if (selectedPackage === packageId) {
            setSelectedPackage("");
            return;
        }
        
        setSelectedPackage(packageId);
        const selectedPkg = coinPackages.find(pkg => pkg.id === packageId);
        if (selectedPkg) {
            setCoinAmount(selectedPkg.amount);
        }
    };

    // Handler untuk input kode promo
    const handlePromoCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPromoCode(e.target.value);
        // Reset status promo saat kode berubah
        if (promoApplied) {
            setPromoApplied(false);
            setPromoDiscount(0);
        }
    };

    // Handler untuk menerapkan kode promo
    const applyPromoCode = () => {
        if (!promoCode) return;
        
        const promo = availablePromoCodes.find(p => p.code === promoCode.toUpperCase());
        if (promo) {
            setPromoApplied(true);
            setPromoDiscount(promo.discount);
        } else {
            // Reset jika kode tidak valid
            setPromoApplied(false);
            setPromoDiscount(0);
            // Bisa tambahkan notifikasi error di sini
        }
    };

    // Handler untuk memilih metode pembayaran
    const handlePaymentMethodSelect = (methodId: string) => {
        setSelectedPaymentMethod(methodId);
    };

    // Menghitung harga dasar (sebelum diskon)
    const calculateBasePrice = () => {
        return coinAmount * 1000;
    };

    // Menghitung diskon paket
    const calculatePackageDiscount = () => {
        // Hanya berikan diskon paket jika paket dipilih DAN jumlah coin tidak diubah manual
        if (!selectedPackage) return 0;
        
        const pkg = coinPackages.find(p => p.id === selectedPackage);
        if (!pkg || pkg.discount === 0) return 0;
        
        // Pastikan jumlah coin sama dengan paket yang dipilih
        if (coinAmount !== pkg.amount) return 0;
        
        const basePrice = calculateBasePrice();
        return basePrice - pkg.price;
    };

    // Menghitung diskon promo
    const calculatePromoDiscount = () => {
        if (!promoApplied || promoDiscount === 0) return 0;
        
        // Hitung dari harga setelah diskon paket
        const priceAfterPackageDiscount = calculateBasePrice() - calculatePackageDiscount();
        return Math.round(priceAfterPackageDiscount * (promoDiscount / 100));
    };

    // Menghitung total harga akhir
    const calculateFinalPrice = () => {
        const basePrice = calculateBasePrice();
        const packageDiscount = calculatePackageDiscount();
        const promoDiscountAmount = calculatePromoDiscount();
        
        return basePrice - packageDiscount - promoDiscountAmount;
    };

    // Mendapatkan metode pembayaran yang dipilih
    const getSelectedPaymentMethod = () => {
        return paymentMethods.find(m => m.id === selectedPaymentMethod) || paymentMethods[0];
    };

    return (
        <div className="min-h-screen font-nunito pb-5">
            <div className="flex flex-col gap-6">
                {/* Header dengan Banner */}
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/80 to-primary p-6 text-white">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="z-10">
                            <h1 className="text-2xl font-bold font-poppins mb-2">Top Up Coins</h1>
                            <p className="opacity-90">Dapatkan lebih banyak coin untuk akses fitur premium</p>
                            <div className="flex items-center gap-2 mt-4 bg-white/20 p-2 rounded-lg w-fit">
                                <Coins size={18} />
                                <span className="font-medium">Saldo: 100 Coins</span>
                            </div>
                        </div>
                        <div className="z-10 flex items-center">
                            <img src="/images/mascot1.png" alt="Mascot" className="w-24 h-24 object-contain" />
                        </div>
                    </div>
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full"></div>
                    <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/10 rounded-full"></div>
                </div>

                {/* Paket Coins */}
                <div>
                    <h2 className="text-xl font-semibold font-poppins mb-4 flex items-center gap-2">
                        <ShoppingBag size={20} className="text-primary" />
                        Pilih Paket Coins
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {coinPackages.map((pkg) => (
                            <Card
                                key={pkg.id}
                                className={`cursor-pointer transition-all overflow-hidden ${selectedPackage === pkg.id ? 'ring-2 ring-primary' : ''} ${pkg.popular ? 'relative' : ''}`}
                                onClick={() => handlePackageSelect(pkg.id)}
                            >
                                {pkg.popular && (
                                    <div className="absolute top-0 right-0">
                                        <div className="bg-primary text-white text-xs px-3 py-1 transform rotate-45 translate-x-6 translate-y-3">
                                            Populer
                                        </div>
                                    </div>
                                )}
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <Badge variant={pkg.popular ? "default" : "outline"} className={pkg.popular ? "bg-primary" : "border-primary text-primary"}>
                                            {pkg.name}
                                        </Badge>
                                        {pkg.discount > 0 && (
                                            <Badge variant="outline" className="bg-primary/10 text-primary border-0">
                                                Hemat {pkg.discount}%
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="bg-primary/10 p-2 rounded-full">
                                            <Coins size={18} className="text-primary" />
                                        </div>
                                        <span className="text-lg font-bold">{pkg.amount}</span>
                                        <span className="text-sm text-muted-foreground">Coins</span>
                                    </div>

                                    <div className="mt-2">
                                        {pkg.discount > 0 && (
                                            <div className="text-sm text-muted-foreground line-through">
                                                Rp {(pkg.amount * 1000).toLocaleString('id-ID')}
                                            </div>
                                        )}
                                        <div className="text-lg font-bold text-primary">
                                            Rp {pkg.price.toLocaleString('id-ID')}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Input Manual - Desain yang diperbarui */}
                <Card>
                    <CardHeader className="bg-secondary-background/30">
                        <CardTitle className="font-poppins text-lg">Input Jumlah Coins</CardTitle>
                        <CardDescription>Masukkan jumlah coin yang ingin dibeli</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="flex flex-col gap-4">
                            <div className="flex-1 space-y-2">
                                <Label htmlFor="coinAmount">Jumlah Coins</Label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                            <Coins size={16} className="text-muted-foreground" />
                                        </div>
                                        <Input
                                            id="coinAmount"
                                            type="number"
                                            placeholder="0"
                                            value={coinAmount || ''}
                                            onChange={handleCoinAmountChange}
                                            min="1"
                                            className="pl-9 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                        />
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="border-primary hover:bg-primary/10"
                                        onClick={handlePlusCoin}
                                    >
                                        <Plus size={16} />
                                    </Button>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    <span>Setara dengan </span>
                                    <span className="font-medium text-primary">Rp {calculateBasePrice().toLocaleString('id-ID')}</span>
                                </div>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {[50, 100, 200, 500].map((amount) => (
                                    <Button
                                        key={amount}
                                        variant="outline"
                                        size="sm"
                                        className={`border-primary ${coinAmount === amount && !selectedPackage ? 'bg-primary/10' : ''}`}
                                        onClick={() => {
                                            setCoinAmount(amount);
                                            setSelectedPackage("");
                                        }}
                                    >
                                        {amount}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Metode Pembayaran */}
                <Card>
                    <CardHeader className="bg-secondary-background/30">
                        <CardTitle className="font-poppins text-lg">Metode Pembayaran</CardTitle>
                        <CardDescription>Pilih metode pembayaran yang tersedia</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        <Tabs defaultValue="bank" className="w-full">
                            <TabsList className="bg-secondary-background/50 p-1 mb-4 flex w-full sm:w-auto overflow-x-auto">
                                <TabsTrigger value="bank" className="data-[state=active]:bg-white data-[state=active]:text-primary">
                                    <CreditCard size={16} className="sm:mr-2" />
                                    <span className="hidden sm:inline">Transfer Bank</span>
                                </TabsTrigger>
                                <TabsTrigger value="ewallet" className="data-[state=active]:bg-white data-[state=active]:text-primary">
                                    <Wallet size={16} className="sm:mr-2" />
                                    <span className="hidden sm:inline">E-Wallet</span>
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="bank" className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {paymentMethods.filter(m => m.type === 'bank').map((method) => (
                                        <Card 
                                            key={method.id} 
                                            className={`cursor-pointer transition-all ${selectedPaymentMethod === method.id ? 'ring-2 ring-primary' : 'hover:border-primary'}`}
                                            onClick={() => handlePaymentMethodSelect(method.id)}
                                        >
                                            <CardContent className="p-4 flex items-center gap-3">
                                                <div className="bg-secondary-background/50 p-2 rounded-full">
                                                    <CreditCard size={18} className="text-primary" />
                                                </div>
                                                <span className="font-medium">{method.name}</span>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="ewallet" className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {paymentMethods.filter(m => m.type === 'ewallet').map((method) => (
                                        <Card 
                                            key={method.id} 
                                            className={`cursor-pointer transition-all ${selectedPaymentMethod === method.id ? 'ring-2 ring-primary' : 'hover:border-primary'}`}
                                            onClick={() => handlePaymentMethodSelect(method.id)}
                                        >
                                            <CardContent className="p-4 flex items-center gap-3">
                                                <div className="bg-secondary-background/50 p-2 rounded-full">
                                                    <Wallet size={18} className="text-primary" />
                                                </div>
                                                <span className="font-medium">{method.name}</span>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                {/* Promo Code */}
                <Card className="overflow-hidden">
                    <CardHeader className="bg-secondary-background/20 py-3 px-6">
                        <CardTitle className="text-sm font-medium">Kode Promo</CardTitle>
                    </CardHeader>
                    <CardContent className="">
                        <div className="flex flex-col gap-4">
                            <div className="flex-1 space-y-2">
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                        <Gift size={16} className="text-muted-foreground" />
                                    </div>
                                    <Input
                                        id="promoCode"
                                        placeholder="Masukkan kode promo"
                                        className="pl-9 pr-10"
                                        value={promoCode}
                                        onChange={handlePromoCodeChange}
                                        disabled={promoApplied}
                                    />
                                    {promoApplied && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                                            <Check size={16} />
                                        </div>
                                    )}
                                </div>
                                {promoApplied && (
                                    <div className="text-sm text-green-600 flex items-center gap-1">
                                        <Check size={14} />
                                        <span>Kode promo berhasil diterapkan! ({promoDiscount}% diskon)</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end">
                                {promoApplied ? (
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        className="border-red-500 text-red-500 hover:bg-red-50 w-full sm:w-auto"
                                        onClick={() => {
                                            setPromoApplied(false);
                                            setPromoDiscount(0);
                                            setPromoCode("");
                                        }}
                                    >
                                        <X size={16} className="mr-2" />
                                        Batalkan
                                    </Button>
                                ) : (
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        className="border-primary text-primary hover:bg-primary/10 w-full sm:w-auto"
                                        onClick={applyPromoCode}
                                        disabled={!promoCode}
                                    >
                                        Terapkan
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Ringkasan Pembayaran - Desain Alternatif */}
                {coinAmount > 0 && (
                    <Card className="border-primary/20 overflow-hidden">
                        <div className="bg-background p-4 text-white">
                            <h3 className="font-poppins text-lg font-bold text-center">Ringkasan Topup</h3>
                        </div>
                        <CardContent className="p-6 space-y-4">
                            {/* Informasi Bank dengan Layout Horizontal */}
                            <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <img
                                        src={`/images/${getSelectedPaymentMethod().id}-logo.png`}
                                        alt={getSelectedPaymentMethod().name}
                                        className="w-10 h-10 object-contain"
                                        onError={(e) => {
                                            e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%230066ae' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='20' height='14' x='2' y='5' rx='2'/%3E%3Cline x1='2' x2='22' y1='10' y2='10'/%3E%3C/svg%3E";
                                        }}
                                    />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm text-muted-foreground">Rekening transfer</p>
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold">5855959131</p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-primary hover:bg-primary/10"
                                            onClick={() => navigator.clipboard.writeText("5855959131")}
                                        >
                                            Salin
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">PT Global Inda multimedia</p>
                                </div>
                            </div>

                            {/* Jumlah Transfer dengan Layout Horizontal */}
                            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                                <p className="text-muted-foreground">Silahkan transfer dana senilai</p>
                                <div className="flex items-center gap-2">
                                    <p className="font-bold text-primary">Rp {calculateFinalPrice().toLocaleString('id-ID')}</p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-primary hover:bg-primary/10"
                                        onClick={() => navigator.clipboard.writeText(calculateFinalPrice().toString())}
                                    >
                                        Salin
                                    </Button>
                                </div>
                            </div>

                            {/* Detail Pembelian */}
                            <div className="bg-secondary-background/30 p-3 rounded-lg space-y-2">
                                <p className="font-medium">Detail Pembelian</p>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Jumlah Coins</span>
                                    <div className="flex items-center gap-1">
                                        <Coins size={14} className="text-primary" />
                                        <span>{coinAmount} Coins</span>
                                    </div>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Harga per Coin</span>
                                    <span>Rp 1.000</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>Rp {calculateBasePrice().toLocaleString('id-ID')}</span>
                                </div>
                                {calculatePackageDiscount() > 0 && (
                                    <div className="flex justify-between text-sm text-primary">
                                        <span>Diskon Paket</span>
                                        <span>- Rp {calculatePackageDiscount().toLocaleString('id-ID')}</span>
                                    </div>
                                )}
                                {calculatePromoDiscount() > 0 && (
                                    <div className="flex justify-between text-sm text-green-600">
                                        <span>Diskon Promo ({promoDiscount}%)</span>
                                        <span>- Rp {calculatePromoDiscount().toLocaleString('id-ID')}</span>
                                    </div>
                                )}
                                <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-medium">
                                    <span>Total</span>
                                    <span className="text-primary">Rp {calculateFinalPrice().toLocaleString('id-ID')}</span>
                                </div>
                            </div>

                            <Button
                                className="w-full bg-primary hover:bg-primary/90 h-12 text-base"
                                disabled={coinAmount <= 0}
                            >
                                Selesai
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}