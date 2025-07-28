import Layouts from '@/components/shared/layouts'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Headphones, Lock, MessageCircleHeart } from 'lucide-react'
import Image from 'next/image'
import { MdOutlineWorkspacePremium } from "react-icons/md"
import { TiGroupOutline } from "react-icons/ti"

export default function FeaturesSection() {
    return (
        <Layouts className='bg-white space-y-10'>
            <div className='flex flex-col gap-4 justify-center text-center max-w-[800px] mx-auto'>
                <h1 className='text-3xl font-bold'>Features</h1>
                <p>TemanCerita is a platform that connects storytellers with readers. We believe that every story has the power to inspire and entertain. That's why we offer a unique platform where you can share your stories, read others, and connect with like-minded people.</p>
            </div>
            <div className="grid grid-cols-5 gap-6 w-full">
                <div className="row-span-2 col-span-2 space-y-3">
                    <Image
                        src="/images/maskot2.png"
                        alt="Feature Section"
                        width={500}
                        height={500}
                        className="object-cover"
                        priority
                        quality={100}
                    />
                </div>
                <div className="col-start-3">
                    <Card className="bg-gray-50 p-0 h-full">
                        <CardContent className="p-6">
                            <div className="mb-4">
                                <MessageCircleHeart className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2 text-gray-800">
                                Speak Without Fear of Judgment
                            </h3>
                            <p className="text-gray-600 text-sm">
                                A safe space for everyone to share their stories, free from stigma or labels.
                            </p>
                        </CardContent>
                    </Card>
                </div>
                <div className="col-start-3 row-start-2">
                    <Card className="bg-gray-50 p-0 h-full">
                        <CardContent className="p-6">
                            <div className="mb-4">
                                <Headphones className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2 text-gray-800">
                                Listeners Ready to Support You
                            </h3>
                            <p className="text-gray-600 text-sm">
                                Connect with verified listeners or fellow users who want to be there for you.
                            </p>
                        </CardContent>
                    </Card>
                </div>
                <div className="col-start-4 row-start-1">
                    <Card className="bg-gray-50 p-0 h-full">
                        <CardContent className="p-6">
                            <div className="mb-4">
                                <Lock className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2 text-gray-800">
                                Privacy and Security Guaranteed
                            </h3>
                            <p className="text-gray-600 text-sm">
                                Your data is safe. Stay anonymous if you choose—your identity is yours to share, or not.
                            </p>
                        </CardContent>
                    </Card>

                </div>
                <div className="col-start-5 row-start-1">
                    <Card className="bg-gray-50 p-0 h-full">
                        <CardContent className="p-6">
                            <div className="mb-4">
                                <MdOutlineWorkspacePremium className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2 text-gray-800">
                                Free & Professional Consultation
                            </h3>
                            <p className="text-gray-600 text-sm">
                                Enjoy sessions with free listeners, or upgrade to certified professionals ready to help you with an empathetic approach.
                            </p>
                        </CardContent>
                    </Card>
                </div>
                <div className="col-span-2 col-start-4 row-start-2">
                    <Card className="bg-secondary-background col-span-1 md:col-span-2 lg:col-span-1 border-secondary-background">
                        <CardContent className="p-6 h-full flex flex-col justify-between">
                            <div>
                                <TiGroupOutline className="w-8 h-8 text-primary mb-4" />
                                <h3 className="text-lg font-semibold mb-2 text-gray-800">
                                    Caring Community
                                </h3>
                                <p className="text-gray-700 text-sm">
                                    We build not just features, but a community. At TemanBicara, you are never alone.
                                </p>
                            </div>
                            <div className="mt-6">
                                <Button size={"lg"}>
                                    Start Now
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </Layouts>
    )
}
