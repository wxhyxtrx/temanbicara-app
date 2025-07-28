"use client"

import { Button } from '@/components/ui/button'
import Image from 'next/image'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import Layouts from '../layouts'

export default function Navbar() {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const scrollToSection = (sectionId: string) => {
        if (!mounted) return
        
        const section = document.getElementById(sectionId)
        if (section) {
            section.scrollIntoView({ behavior: 'smooth' })
        }
    }

    return (
        <Layouts>
            <div className="flex justify-between items-center py-4">
                <div className="flex items-center cursor-pointer" onClick={() => scrollToSection('hero')}>
                    <Image
                        src="/images/logo.png"
                        alt="TemanBicara Logo"
                        width={100}
                        height={100}
                        className="w-40 h-16 object-contain"
                        priority
                    />
                </div>
                <div className="flex items-center gap-10 justify-end font-bold font-poppins">
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
                    <Button 
                        size={"lg"} 
                        className='font-semibold rounded-full'
                        onClick={() => scrollToSection('start-now')}
                    >
                        Get Started
                    </Button>
                </div>
            </div>
        </Layouts>
    )
}
