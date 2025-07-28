import React from 'react'
import Layouts from '@/components/shared/layouts'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

export default function StartNowSection() {
    return (
        <Layouts>
            <div className="relative overflow-hidden bg-background rounded-xl p-8 md:p-10 my-8">
                {/* Background Patterns */}
                <div className="absolute inset-0 z-0 overflow-hidden">
                    {/* Circles */}
                    <div className="absolute w-32 h-32 rounded-full border border-foreground opacity-10 -top-10 -left-10"></div>
                    <div className="absolute w-48 h-48 rounded-full border border-foreground opacity-10 top-1/2 -right-10 transform -translate-y-1/2"></div>
                    <div className="absolute w-16 h-16 rounded-full bg-primary opacity-10 bottom-10 left-1/4"></div>

                    {/* Dots */}
                    <div className="absolute w-2 h-2 rounded-full bg-primary top-1/4 right-1/4 opacity-30"></div>
                    <div className="absolute w-2 h-2 rounded-full bg-foreground bottom-1/3 right-1/3 opacity-20"></div>
                    <div className="absolute w-3 h-3 rounded-full bg-secondary-background top-1/3 left-1/3 opacity-60"></div>

                    {/* Lines */}
                    <svg className="absolute top-0 left-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0,50 Q150,150 300,100 T600,150" fill="none" stroke="rgba(31,66,95,0.1)" strokeWidth="2" />
                        <path d="M0,100 Q200,50 400,120 T800,100" fill="none" stroke="rgba(245,120,106,0.1)" strokeWidth="2" />
                    </svg>
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="space-y-4 max-w-xl">
                        <h2 className="text-3xl md:text-4xl font-bold font-poppins text-foreground">Start Talking Today</h2>
                        <p className="text-foreground/80 font-nunito">
                            Discover the power of simply being heard. Whether you're feeling overwhelmed, lonely, or just need someone to talk to — TemanBicara is here for you.
                        </p>
                        <div className="flex flex-wrap gap-4 pt-2">
                            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                                Start Now
                            </Button>
                        </div>
                    </div>

                    {/* Optional Illustration/Icon */}
                    <div className="flex-shrink-0">
                        <div className="relative w-32 h-32 md:w-40 md:h-40 bg-secondary-background/70 rounded-full flex items-center justify-center">
                            <Image
                                src="/images/mascot1.png"
                                alt="TemanBicara Mascot"
                                width={120}
                                height={120}
                                className="object-contain"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Layouts>
    )
}
