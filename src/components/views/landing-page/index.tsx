import FeaturesSection from './features-section'
import HeroSection from './hero-section'
import JoinSection from './join-section'
import StartNowSection from './startnow-section'
import TestimonialSection from './testimonial-section'

export default function Landing() {
    return (
        <div>
            <div id="hero">
                <HeroSection />
            </div>
            <div id="features" className='bg-white py-20'>
                <FeaturesSection />
            </div>
            <div id="join" className='bg-secondary-background'>
                <JoinSection />
            </div>
            <div id="testimonial" className='py-20'>
                <TestimonialSection />
            </div>
            <div id="start-now" className='bg-white py-20'>
                <StartNowSection />
            </div>
        </div>
    )
}
