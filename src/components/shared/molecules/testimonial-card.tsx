import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { testimonials } from "@/constant/testimonial";
import { Quote } from "lucide-react";

function TestimonialCard({ testimonial }: { testimonial: (typeof testimonials)[0] }) {
    return (
        <Card className="w-80 h-full bg-white/90 backdrop-blur-sm border-0 shadow-lg flex-shrink-0 mx-3 p-0">
            <CardContent className="p-6 h-full flex flex-col justify-between">
                <div>
                    <Quote className="w-6 h-6 text-primary mb-3" />
                    <p className="text-sm leading-relaxed line-clamp-3 ">{testimonial.text}</p>
                </div>
                <div className="flex items-center gap-3 mt-4">
                    <Avatar className="w-10 h-10">
                        <AvatarImage src={testimonial.avatar || "/placeholder.svg"} alt={testimonial.author} />
                        <AvatarFallback>
                            {testimonial.author
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold font-poppins text-sm">{testimonial.author}</p>
                        <p className="text-gray-600 text-xs">{testimonial.role}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export default TestimonialCard
