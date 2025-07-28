import FeaturesSection from './features-section'
import HeroSection from './hero-section'
import JoinSection from './join-section'
import StartNowSection from './startnow-section'
import TestimonialSection from './testimonial-section'

export default function Landing() {
    return (
        <div>
            <HeroSection />
            <div className='bg-white py-20'>
                <FeaturesSection />
            </div>
            <div className='bg-secondary-background'>
                <JoinSection />
            </div>
            <div className='py-20'>
                <TestimonialSection />
            </div>
            <div className='bg-white py-20'>
                <StartNowSection />
            </div>
        </div>
    )
}
