import { Button } from '@/components/ui/button'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import Layouts from '../layouts'

export default function Navbar() {
    return (
        <Layouts>
            <div className="flex justify-between items-center py-4">
                <div className="flex items-center">
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
                    <Link href="/features">
                        Features
                    </Link>
                    <Link href="/testimonial">
                        Testimonial
                    </Link>
                    <Link href="/contact">
                        Contact
                    </Link>
                    <Button size={"lg"} className='font-semibold rounded-full'>
                        Get Started
                    </Button>
                </div>
            </div>
        </Layouts>
    )
}
