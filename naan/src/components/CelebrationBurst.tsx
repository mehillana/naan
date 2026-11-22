import {AnimatePresence, motion} from 'motion/react';

interface CelebrationBurstProps {
  triggerKey: number;
}

const PARTICLES = Array.from({length: 18}, (_, idx) => {
  const angle = (idx / 18) * Math.PI * 2;
  const distance = 90 + (idx % 3) * 48;
  const colors = ['#2563EB', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4'];
  return {
    id: idx,
    dx: Math.cos(angle) * distance,
    dy: Math.sin(angle) * distance - 40,
    rotate: (idx % 2 === 0 ? 1 : -1) * (120 + idx * 20),
    color: colors[idx % colors.length],
    size: 7 + (idx % 4) * 2,
  };
});

export function CelebrationBurst({triggerKey}: CelebrationBurstProps) {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      aria-hidden="true"
    >
      <AnimatePresence>
        {triggerKey > 0 && (
          <motion.div
            key={triggerKey}
            initial={{opacity: 1}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            className="relative"
          >
            {PARTICLES.map((p) => (
              <motion.span
                key={p.id}
                initial={{x: 0, y: 0, scale: 0.3, opacity: 1, rotate: 0}}
                animate={{
                  x: p.dx,
                  y: p.dy,
                  scale: [0.6, 1.2, 0.2],
                  opacity: [1, 1, 0],
                  rotate: p.rotate,
                }}
                transition={{duration: 0.9, ease: [0.16, 1, 0.3, 1]}}
                style={{
                  background: p.color,
                  width: p.size,
                  height: p.size,
                }}
                className="absolute rounded-sm shadow-xs"
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
