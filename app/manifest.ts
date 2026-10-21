import type { MetadataRoute } from "next";
import { ROUTES } from "@/lib/constants";

/** Lets phones and desktops install ProximaTrax to the home screen, opening without browser chrome. */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "ProximaTrax",
        short_name: "ProximaTrax",
        description: "Project management and real-time task monitoring for AEG Home Fashion.",
        // The dashboard sends each role to its own home, and signed-out visitors to login.
        start_url: ROUTES.DASHBOARD,
        scope: "/",
        display: "standalone",
        background_color: "#F4F5F8",
        theme_color: "#0B0E1A",
        // ponytail: one 512px "any" icon; add a padded maskable icon if Android crops the mark.
        icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" }],
    };
}
