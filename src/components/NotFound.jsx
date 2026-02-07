import React from "react";
import { motion } from "framer-motion";
import { Home, Ghost } from "lucide-react";

export default function NotFound() {
  // Animation variants for staggered entrance
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 100 },
    },
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 w-full">
      <motion.div
        className="rounded-3xl bg-[rgba(10,13,16,.8)] text-white p-8 md:p-12 shadow-2xl backdrop-blur-sm border border-white/10 max-w-lg w-full text-center relative overflow-hidden"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Decorative background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-amber-500/20 blur-[50px] rounded-full pointer-events-none" />

        <motion.div variants={itemVariants} className="flex justify-center mb-6">
          <div className="p-4 bg-white/5 rounded-full">
            <Ghost className="w-12 h-12 text-amber-300" />
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <h1 className="text-6xl md:text-8xl font-black mb-2 tracking-tighter">
            <span className="text-white">Eroare </span>
            {/* Floating animation for the 404 number */}
            <motion.span
              className="inline-block text-amber-400"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              404
            </motion.span>
          </h1>
        </motion.div>

        <motion.h2
          variants={itemVariants}
          className="text-2xl md:text-3xl font-semibold mb-4 text-gray-200"
        >
          Pagină negăsită
        </motion.h2>

        <motion.p
          variants={itemVariants}
          className="text-lg text-gray-400 mb-8 leading-relaxed"
        >
          Ne pare rău, pagina pe care o cauți s-a rătăcit în spațiu sau nu mai există.
        </motion.p>

        <motion.div variants={itemVariants}>
          <a href="/">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-8 rounded-xl transition-colors mx-auto w-full sm:w-auto cursor-pointer"
            >
              <Home className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span>Înapoi la pagina principală</span>
            </motion.button>
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
}