import Layouts from '@/components/shared/layouts';
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import React from 'react'
import { BsChatHeartFill, BsShieldLockFill } from "react-icons/bs";
import { LuEar } from "react-icons/lu";
import Link from 'next/link';

function HeroSection() {
    return (
        <Layouts className='space-y-12 md:space-y-24 py-10 md:pb-20'>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
                <div className="space-y-4 md:space-y-6 text-center lg:text-left order-2 lg:order-1">
                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl font-bold text-foreground leading-tight">
                        Start Healing by Talking
                    </h1>
                    <p className="text-sm sm:text-base md:text-lg text-muted-foreground font-poppins leading-relaxed max-w-lg mx-auto lg:mx-0">
                        You don't have to go through it alone. Talk to a listener who's ready to understand, support, and stand with you— all in a space that's private, safe, and free of judgment.
                    </p>
                    <Link href="/login">
                        <Button size={"lg"} className='font-semibold rounded-full font-poppins'>
                            Get Started
                        </Button>
                    </Link>
                </div>

                <div className="flex justify-center order-1 lg:order-2 font-poppins">
                    <div className="relative">
                        <Image
                            src="/images/mascot1.png"
                            alt="TemanBicara Mascot"
                            width={500}
                            height={500}
                            className="w-56 h-56 sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 xl:w-[500px] xl:h-[500px] object-contain"
                            priority
                        />
                    </div>
                </div>
            </div>
            <div className='max-w-[1200px] mx-auto grid grid-cols-2 sm:grid-cols-3 gap-6 md:gap-10'>
                <div className='flex justify-center flex-col gap-3 items-center'>
                    <div className='bg-secondary-background p-4 rounded-full w-fit'>
                        <BsChatHeartFill size={30} className="sm:text-3xl md:text-4xl" />
                    </div>
                    <p className='text-center font-bold text-xl sm:text-2xl'>
                        Anonymously
                    </p>
                </div>
                <div className='flex justify-center flex-col gap-3 items-center'>
                    <div className='bg-secondary-background p-4 rounded-full w-fit'>
                        <BsShieldLockFill size={30} className="sm:text-3xl md:text-4xl" />
                    </div>
                    <p className='text-center font-bold text-xl sm:text-2xl'>
                        Secure & Private
                    </p>
                </div>
                <div className='flex justify-center flex-col gap-3 items-center max-md:col-span-2'>
                    <div className='bg-secondary-background p-4 rounded-full w-fit'>
                        <LuEar size={30} className="sm:text-3xl md:text-4xl" />
                    </div>
                    <p className='text-center font-bold text-xl sm:text-2xl'>
                        Various Listeners
                    </p>
                </div>
            </div>
        </Layouts>
    )
}

export default HeroSection
