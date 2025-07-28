import { Nunito, Poppins } from "next/font/google";

export const poppins = Poppins({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-poppins",
});

export const nunito = Nunito({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-nunito",
});