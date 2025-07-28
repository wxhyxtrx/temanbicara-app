"use client"

import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Home, LogIn } from "lucide-react"

export default function NotFound() {
    return (
        <div className="min-h-screen flex flex-col md:flex-row items-center justify-center px-4 relative overflow-hidden">
            {/* Background with color gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#fff8ef] via-[#fee6ce] to-[#f5786a]/20 z-0"></div>
            
            {/* Animated decorative elements */}
            <div className="absolute inset-0 overflow-hidden z-0">
                <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-primary/5 animate-pulse"></div>
                <div className="absolute bottom-1/3 right-1/3 w-96 h-96 rounded-full bg-primary/10 animate-pulse [animation-delay:1s]"></div>
                <div className="absolute top-1/2 left-1/2 w-48 h-48 rounded-full bg-primary/5 animate-pulse [animation-delay:2s]"></div>
            </div>
            
            {/* Left side - Illustration */}
            <div className="relative z-10 mb-8 md:mb-0 md:w-1/2 flex justify-center items-center">
                <div className="relative">
                    <div className="absolute -inset-4 rounded-full bg-primary/10 blur-xl animate-pulse"></div>
                    <Image 
                        src="/images/mascot1.png" 
                        alt="TemanBicara Mascot" 
                        width={280} 
                        height={280} 
                        className="relative drop-shadow-2xl animate-bounce [animation-duration:6s]" 
                    />
                    <div className="absolute -bottom-6 w-full h-12 bg-black/10 blur-xl rounded-full scale-75 transform translate-y-2"></div>
                </div>
            </div>
            
            {/* Right side - Content */}
            <div className="relative z-10 md:w-1/2 max-w-md">
                <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-white/50 transform transition-all hover:scale-[1.01] hover:shadow-primary/20">
                    <div className="text-center md:text-left">
                        <h1 className="text-8xl font-bold text-primary mb-2 tracking-tighter">404</h1>
                        <h2 className="text-3xl font-bold text-foreground mb-3">Oops! Lost in Space</h2>
                        <p className="text-muted-foreground mb-8 text-lg">The page you're looking for has floated away or never existed.</p>
                    </div>
                    
                    <div className="space-y-4">
                        <Link href="/" className="block">
                            <Button 
                                className="w-full bg-primary hover:bg-primary/90 transition-all group rounded-xl py-6"
                                size="lg"
                            >
                                <Home className="mr-2 h-5 w-5 group-hover:animate-bounce" />
                                Return to Homepage
                            </Button>
                        </Link>
                        
                        <div className="flex gap-4">
                            <Button 
                                variant="outline" 
                                className="flex-1 bg-white/80 hover:bg-white/100 transition-all rounded-xl py-5"
                                size="lg"
                                onClick={() => window.history.back()}
                            >
                                <ArrowLeft className="mr-2 h-5 w-5" />
                                Go Back
                            </Button>
                            
                            <Link href="/login" className="flex-1">
                                <Button 
                                    variant="outline" 
                                    className="w-full bg-white/80 hover:bg-white/100 transition-all rounded-xl py-5"
                                    size="lg"
                                >
                                    <LogIn className="mr-2 h-5 w-5" />
                                    Sign In
                                </Button>
                            </Link>
                        </div>
                    </div>
                    
                    <div className="pt-6 text-center md:text-left">
                        <p className="text-sm text-muted-foreground">
                            Need help? <Link href="#" className="text-primary hover:underline font-medium transition-colors">Contact Support</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}