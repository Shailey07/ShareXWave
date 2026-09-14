import React from 'react';
import Particles from 'react-tsparticles';
import { loadSlim } from 'tsparticles-slim';

export default function ParticleBackground() {
  const init = async (engine) => { await loadSlim(engine); };
  return (
    <Particles id="tsparticles" init={init}
      options={{
        background: { color: { value: 'transparent' } },
        fpsLimit: 60,
        interactivity: {
          events: { onHover: { enable: true, mode: 'bubble' }, onClick: { enable: true, mode: 'push' } },
          modes: { bubble: { distance: 120, size: 5, duration: 0.4 }, push: { quantity: 3 } },
        },
        particles: {
          color: { value: ['#6c63ff', '#3da9fc', '#2ec4b6', '#a78bfa'] },
          links: { color: '#6c63ff', distance: 140, enable: true, opacity: 0.15, width: 1 },
          move: { enable: true, speed: 0.8, random: true, outModes: { default: 'bounce' } },
          number: { density: { enable: true, area: 900 }, value: 60 },
          opacity: { value: { min: 0.2, max: 0.55 } },
          shape: { type: 'circle' },
          size: { value: { min: 1.5, max: 4 } },
        },
        detectRetina: true,
      }}
      style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}