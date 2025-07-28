// app/(auth)/register/page.tsx
"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FcGoogle } from "react-icons/fc"
import { FaFacebook } from "react-icons/fa"
import { signIn } from "next-auth/react"
import Link from "next/link"

export default function Register() {
    return (
        <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
            {/* Background dengan gradasi warna */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#fff8ef] via-[#fee6ce] to-[#f5786a]/30 z-0"></div>
            
            {/* Pola dekoratif */}
            <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiMxZjQyNWYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-50 z-0"></div>
            
            {/* Lingkaran dekoratif */}
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary/10 blur-3xl z-0"></div>
            <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-primary/10 blur-3xl z-0"></div>
            
            <div className="w-full max-w-md bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 space-y-6 relative z-10 border border-white/20">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-foreground">Join TemanBicara Today</h1>
                    <p className="text-sm text-muted-foreground">Create an account and start your journey.</p>
                </div>

                <div className="space-y-4">
                    <Button
                        variant="outline"
                        className="w-full flex items-center justify-center gap-2 bg-white/80 hover:bg-white/100 transition-all"
                        onClick={() => signIn("google")}
                    >
                        <FcGoogle className="h-5 w-5" />
                        Sign up with Google
                    </Button>

                    <Button
                        variant="outline"
                        className="w-full flex items-center justify-center gap-2 bg-white/80 hover:bg-white/100 transition-all"
                        onClick={() => signIn("facebook")}
                    >
                        <FaFacebook className="h-5 w-5 text-blue-600" />
                        Sign up with Facebook
                    </Button>
                </div>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="bg-white px-2 text-muted-foreground">OR</span>
                    </div>
                </div>

                <form className="space-y-4">
                    <Input type="text" placeholder="Full Name" className="bg-white/80" />
                    <Input type="email" placeholder="Email" className="bg-white/80" />
                    <Input type="password" placeholder="Password" className="bg-white/80" />
                    <Input type="password" placeholder="Confirm Password" className="bg-white/80" />
                    <div className="flex items-center space-x-2">
                        <input 
                            type="checkbox" 
                            id="terms" 
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/80"
                        />
                        <label htmlFor="terms" className="text-xs text-muted-foreground">
                            I agree to the <a href="#" className="text-primary hover:underline">Terms of Service</a> and <a href="#" className="text-primary hover:underline">Privacy Policy</a>
                        </label>
                    </div>
                    <Button type="submit" className="w-full bg-primary hover:bg-primary/90 transition-all">
                        Create Account
                    </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link href="/login" className="text-primary hover:underline font-medium">Sign In</Link>
                </p>
            </div>
        </div>
    )
}