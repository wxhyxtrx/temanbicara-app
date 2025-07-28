import Link from "next/link";
import Image from "next/image";
import { Mail, Phone, MapPin, Facebook, Twitter, Instagram, Linkedin } from "lucide-react";
import Layouts from "../layouts";

export default function Footer() {
  return (
    <footer className="bg-gradient-to-t from-secondary-background to-background py-12 sm:py-16">
      <Layouts>
        <div className="container mx-auto px-4 sm:px-6">
          {/* Main Footer Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12">
            {/* Logo and Description Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Image
                  src="/images/logo.png"
                  alt="TemanBicara Logo"
                  width={120}
                  height={40}
                  className="object-contain"
                />
              </div>
              <p className="text-sm font-nunito max-w-xs">
                Connect with listeners who understand. Get support anonymously and securely in a safe, judgment-free environment.
              </p>
              <div className="flex space-x-4 pt-2">
                <a href="#" className="bg-white p-2 rounded-full shadow-sm hover:shadow-md transition-all">
                  <Facebook size={18} className="text-primary" />
                </a>
                <a href="#" className="bg-white p-2 rounded-full shadow-sm hover:shadow-md transition-all">
                  <Twitter size={18} className="text-primary" />
                </a>
                <a href="#" className="bg-white p-2 rounded-full shadow-sm hover:shadow-md transition-all">
                  <Instagram size={18} className="text-primary" />
                </a>
                <a href="#" className="bg-white p-2 rounded-full shadow-sm hover:shadow-md transition-all">
                  <Linkedin size={18} className="text-primary" />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-base sm:text-lg font-semibold mb-4 sm:mb-5 font-poppins">
                Quick Links
              </h4>
              <ul className="space-y-3 font-nunito">
                <li>
                  <a href="#" className="text-sm hover:text-primary transition-colors flex items-center">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></span>
                    Home
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm hover:text-primary transition-colors flex items-center">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></span>
                    About Us
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm hover:text-primary transition-colors flex items-center">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></span>
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm hover:text-primary transition-colors flex items-center">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></span>
                    Testimonials
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm hover:text-primary transition-colors flex items-center">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></span>
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            {/* Support Links */}
            <div>
              <h4 className="text-base sm:text-lg font-semibold mb-4 sm:mb-5 font-poppins">
                Support
              </h4>
              <ul className="space-y-3 font-nunito">
                <li>
                  <a href="#" className="text-sm hover:text-primary transition-colors flex items-center">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></span>
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm text-gray-600 hover:text-primary transition-colors flex items-center">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></span>
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm text-gray-600 hover:text-primary transition-colors flex items-center">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></span>
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm text-gray-600 hover:text-primary transition-colors flex items-center">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></span>
                    FAQ
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm text-gray-600 hover:text-primary transition-colors flex items-center">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></span>
                    Community Guidelines
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact Information */}
            <div>
              <h4 className="text-base sm:text-lg font-semibold mb-4 sm:mb-5 font-poppins">
                Contact Us
              </h4>
              <ul className="space-y-3 font-nunito">
                <li>
                  <a href="mailto:info@temanbicara.com" className="text-sm text-gray-600 hover:text-primary transition-colors flex items-start">
                    <Mail size={16} className="mr-2 mt-0.5 text-primary" />
                    <span>info@temanbicara.com</span>
                  </a>
                </li>
                <li>
                  <a href="tel:+6281234567890" className="text-sm text-gray-600 hover:text-primary transition-colors flex items-start">
                    <Phone size={16} className="mr-2 mt-0.5 text-primary" />
                    <span>+62 812 3456 7890</span>
                  </a>
                </li>
                <li className="flex items-start">
                  <MapPin size={16} className="mr-2 mt-0.5 text-primary" />
                  <span className="text-sm text-gray-600">Jl. Sudirman No. 123, Jakarta, Indonesia</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Newsletter Subscription */}
          <div className="mt-12 p-6 bg-primary/30 rounded-xl shadow-sm text-white">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="md:col-span-2">
                <h5 className="text-lg font-semibold mb-2 font-poppins">Subscribe to Our Newsletter</h5>
                <p className="text-sm text-gray-600 font-nunito">Stay updated with our latest news and announcements</p>
              </div>
              <div>
                <div className="flex">
                  <input
                    type="email"
                    placeholder="Your email address"
                    className="flex-1 px-4 py-2 text-sm text-foreground bg-accent border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-primary/50 font-nunito"
                  />
                  <button className="bg-primary text-white px-4 py-2 rounded-r-md hover:bg-primary/90 transition-colors font-poppins">
                    Subscribe
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Copyright Section */}
          <div className="border-t border-foreground mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-600 font-nunito mb-4 md:mb-0">
              © 2024 TemanBicara. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <a href="#" className="text-xs text-gray-500 hover:text-primary transition-colors font-nunito">Privacy Policy</a>
              <a href="#" className="text-xs text-gray-500 hover:text-primary transition-colors font-nunito">Terms of Service</a>
              <a href="#" className="text-xs text-gray-500 hover:text-primary transition-colors font-nunito">Cookie Policy</a>
            </div>
          </div>
        </div>
      </Layouts>
    </footer>
  );
}