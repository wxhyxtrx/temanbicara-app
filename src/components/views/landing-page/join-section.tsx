import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from 'next/link'

export default function JoinSection() {
    return (
        <section className="relative py-12 md:py-24 overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 z-0"></div>
            
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10 z-0">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('/images/pattern.png')] bg-repeat opacity-20"></div>
            </div>
            
            {/* Decorative circles */}
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl z-0"></div>
            <div className="absolute -bottom-32 -right-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl z-0"></div>
            
            <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    {/* Left content */}
                    <div className="space-y-6 text-center lg:text-left">
                        <div className="inline-block px-4 py-2 bg-black/70 rounded-full text-white font-medium text-sm mb-3 font-nunito">
                            Join Our Community
                        </div>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
                            Ready to Connect with Someone Who Cares?
                        </h2>
                        <p className="text-neutral-700 text-base md:text-lg max-w-xl mx-auto lg:mx-0 font-nunito">
                            Whether you want to talk or just listen, TemanBicara is here for you. Join our caring community where every voice matters.
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4 pt-2">
                            <Link href="/login">
                                <Button size={"lg"} className="rounded-full shadow-lg shadow-primary/20 font-poppins">
                                    Start Talking
                                </Button>
                            </Link>
                            <Link href="/login">
                                <Button size={"lg"} variant={"outline"} className="rounded-full font-poppins">
                                    Become a Listener
                                </Button>
                            </Link>
                        </div>
                    </div>
                    
                    {/* Right image - hidden on mobile, visible on desktop */}
                    <div className="relative hidden lg:block">
                        <div className="absolute -top-6 -left-6 w-24 h-24 bg-primary/10 rounded-full z-0"></div>
                        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-primary/10 rounded-full z-0"></div>
                        
                        <div className="relative bg-white p-4 rounded-2xl shadow-xl rotate-2 z-10">
                            <Image
                                src="/images/mascot1.png"
                                alt="TemanBicara Community"
                                width={500}
                                height={400}
                                className="rounded-xl object-cover"
                            />
                        </div>
                    </div>
                    
                    {/* Mobile image - only visible on mobile */}
                    <div className="relative flex justify-center lg:hidden">
                        <div className="relative bg-white p-3 rounded-2xl shadow-xl rotate-2 z-10 max-w-xs">
                            <Image
                                src="/images/mascot1.png"
                                alt="TemanBicara Community"
                                width={300}
                                height={240}
                                className="rounded-xl object-cover"
                            />
                        </div>
                    </div>
                </div>
                
                {/* Stats section */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-12 md:mt-16 text-center max-w-[1000px] mx-auto">
                    <div className="bg-background backdrop-blur-sm p-3 md:p-4 rounded-xl shadow-sm">
                        <p className="text-xl md:text-3xl font-bold">5000+</p>
                        <p className="text-xs md:text-sm text-primary font-nunito">Active Users</p>
                    </div>
                    <div className="bg-background backdrop-blur-sm p-3 md:p-4 rounded-xl shadow-sm">
                        <p className="text-xl md:text-3xl font-bold">200+</p>
                        <p className="text-xs md:text-sm text-primary font-nunito">Verified Listeners</p>
                    </div>
                    <div className="bg-background backdrop-blur-sm p-3 md:p-4 rounded-xl shadow-sm">
                        <p className="text-xl md:text-3xl font-bold">24/7</p>
                        <p className="text-xs md:text-sm text-primary font-nunito">Support Available</p>
                    </div>
                    <div className="bg-background backdrop-blur-sm p-3 md:p-4 rounded-xl shadow-sm">
                        <p className="text-xl md:text-3xl font-bold">100%</p>
                        <p className="text-xs md:text-sm text-primary font-nunito">Confidential</p>
                    </div>
                </div>
            </div>
        </section>
    );
}