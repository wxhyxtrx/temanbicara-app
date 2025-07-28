"use client"

import { Button } from '@/components/ui/button'
import Image from 'next/image'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import Layouts from '../layouts'
import { Menu, X } from 'lucide-react'

export default function Navbar() {
    const [mounted, setMounted] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const scrollToSection = (sectionId: string) => {
        if (!mounted) return
        
        const section = document.getElementById(sectionId)
        if (section) {
            section.scrollIntoView({ behavior: 'smooth' })
            setMobileMenuOpen(false) // Close mobile menu after clicking
        }
    }

    return (
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm">
            <Layouts>
                <div className="flex justify-between items-center py-4">
                    <div className="flex items-center cursor-pointer" onClick={() => scrollToSection('hero')}>
                        <Image
                            src="/images/logo.png"
                            alt="TemanBicara Logo"
                            width={100}
                            height={100}
                            className="w-32 h-12 md:w-40 md:h-16 object-contain"
                            priority
                        />
                    </div>
                    
                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-6 lg:gap-10 justify-end font-bold font-poppins">
                        <span 
                            className="cursor-pointer hover:text-primary transition-colors"
                            onClick={() => scrollToSection('features')}
                        >
                            Features
                        </span>
                        <span 
                            className="cursor-pointer hover:text-primary transition-colors"
                            onClick={() => scrollToSection('testimonial')}
                        >
                            Testimonial
                        </span>
                        <span 
                            className="cursor-pointer hover:text-primary transition-colors"
                            onClick={() => scrollToSection('join')}
                        >
                            Contact
                        </span>
                        <Link href="/login">
                            <Button 
                                size={"lg"} 
                                className='font-semibold rounded-full'
                            >
                                Get Started
                            </Button>
                        </Link>
                    </div>
                    
                    {/* Mobile Menu Button */}
                    <button 
                        className="md:hidden p-2 text-foreground"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
                
                {/* Mobile Navigation */}
                {mobileMenuOpen && (
                    <div className="md:hidden py-4 px-2 bg-background border-t">
                        <div className="flex flex-col space-y-4 font-poppins">
                            <span 
                                className="cursor-pointer hover:text-primary transition-colors py-2"
                                onClick={() => scrollToSection('features')}
                            >
                                Features
                            </span>
                            <span 
                                className="cursor-pointer hover:text-primary transition-colors py-2"
                                onClick={() => scrollToSection('testimonial')}
                            >
                                Testimonial
                            </span>
                            <span 
                                className="cursor-pointer hover:text-primary transition-colors py-2"
                                onClick={() => scrollToSection('join')}
                            >
                                Contact
                            </span>
                            <Link href="/login">
                                <Button 
                                    size={"default"} 
                                    className='font-semibold rounded-full w-full'
                                >
                                    Get Started
                                </Button>
                            </Link>
                        </div>
                    </div>
                )}
            </Layouts>
        </div>
    )
}
