"use client"

import Layouts from "@/components/shared/layouts"
import TestimonialCard from "@/components/shared/molecules/testimonial-card"
import { Badge } from "@/components/ui/badge"
import { testimonials } from "@/constant/testimonial"
import { Star } from "lucide-react"

export default function TestimonialSection() {
    const topRowTestimonials = testimonials.slice(0, 3)
    const bottomRowTestimonials = testimonials.slice(3, 6)

    return (
        <div className="relative">
            <Layouts>
                {/* Header Section */}
                <div className="text-center mb-16">
                    <Badge className="bg-black/70 text-white px-4 py-2 rounded-full mb-6 inline-flex items-center gap-2 font-nunito">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span>Rated 4.5/5 by over 1 Lakh users</span>
                    </Badge>

                    <h2 className="text-2xl md:text-4xl font-bold text-primary mb-4 leading-tight">
                        What Others Say About TemanBicara
                        <br />
                        <span className="text-sm text-gray-600">
                            Real stories from our growing community — listeners and sharers alike.
                        </span>
                    </h2>
                </div>

                {/* Testimonials Section */}
                <div className="relative space-y-2">
                    {/* Left Fade Shadow */}
                    <div className="absolute left-0 top-0 bottom-0 w-32 h-full bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />

                    {/* Right Fade Shadow */}
                    <div className="absolute right-0 top-0 bottom-0 w-32 h-full bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

                    {/* Top Row - Moving Right */}
                    <div className="relative overflow-hidden">
                        <div className="flex animate-scroll-right py-5">
                            {[...topRowTestimonials, ...topRowTestimonials, ...topRowTestimonials].map((testimonial, index) => (
                                <TestimonialCard key={`top-${testimonial.id}-${index}`} testimonial={testimonial} />
                            ))}
                        </div>
                    </div>

                    {/* Bottom Row - Moving Left */}
                    <div className="relative overflow-hidden">
                        <div className="flex animate-scroll-left py-5">
                            {[...bottomRowTestimonials, ...bottomRowTestimonials, ...bottomRowTestimonials].map(
                                (testimonial, index) => (
                                    <TestimonialCard key={`bottom-${testimonial.id}-${index}`} testimonial={testimonial} />
                                ),
                            )}
                        </div>
                    </div>
                </div>
            </Layouts>
        </div>
    )
}
