import React from "react";
import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import MegaNav from "../components/MegaNav.jsx";
import MarketplaceSidebar from "../components/MarketplaceSidebar.jsx";

/** Marketplace shell — public /marketplace/* browse and /dashboard/* account routes */
export default function MarketplaceLayout() {
  return (
    <div className="antialiased min-h-screen bg-[#f9f9f9]">
      <MegaNav />

      <MarketplaceSidebar />

      <main className="md:ml-[240px] pt-20 min-h-screen">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="px-4 sm:px-6 pb-16 max-w-6xl mx-auto"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}