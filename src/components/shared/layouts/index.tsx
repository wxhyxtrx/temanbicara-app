import React from 'react'

export default function Layouts({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={`container mx-auto max-w-[1440px] px-4 sm:px-6 ${className}`}>
            {children}
        </div>
    )
}
