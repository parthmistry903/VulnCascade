"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function GlobalLoader() {
  const [isFading, setIsFading] = useState(false);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, 1700);

    
    const doneTimer = setTimeout(() => {
      setIsDone(true);
    }, 2100);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (isDone) return null;

  return (
    <div
      className="global-loader"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e3f6e8',
        transition: 'opacity 0.4s ease-in-out',
        opacity: isFading ? 0 : 1,
        pointerEvents: isFading ? 'none' : 'all',
      }}
    >
      <div 
        className="relative glitch-container" 
        style={{ position: 'relative', width: '160px', height: '160px' }}
      >
        <Image
          src="/logo.svg"
          alt="VulnCascade Logo"
          fill
          className="base-logo"
          priority
        />
        <Image
          src="/logo.svg"
          alt=""
          fill
          className="glitch-slice slice-1"
          priority
        />
        <Image
          src="/logo.svg"
          alt=""
          fill
          className="glitch-slice slice-2"
          priority
        />
        <Image
          src="/logo.svg"
          alt=""
          fill
          className="glitch-slice slice-3"
          priority
        />
      </div>
      <div style={{ position: 'relative', marginTop: '24px' }}>
        <h2 
          className="glitch-text"
          style={{ 
            fontSize: '2.75rem', 
            fontWeight: 'bold', 
            letterSpacing: '-0.025em', 
            color: '#000000' 
          }}
        >
          VulnCascade
        </h2>
        <h2 
          className="glitch-slice slice-1"
          style={{ 
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            fontSize: '2.75rem', fontWeight: 'bold', letterSpacing: '-0.025em', color: '#000000',
            whiteSpace: 'nowrap'
          }}
          aria-hidden="true"
        >
          VulnCascade
        </h2>
        <h2 
          className="glitch-slice slice-2"
          style={{ 
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            fontSize: '2.75rem', fontWeight: 'bold', letterSpacing: '-0.025em', color: '#000000',
            whiteSpace: 'nowrap'
          }}
          aria-hidden="true"
        >
          VulnCascade
        </h2>
        <h2 
          className="glitch-slice slice-3"
          style={{ 
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            fontSize: '2.75rem', fontWeight: 'bold', letterSpacing: '-0.025em', color: '#000000',
            whiteSpace: 'nowrap'
          }}
          aria-hidden="true"
        >
          VulnCascade
        </h2>
      </div>
    </div>
  );
}
