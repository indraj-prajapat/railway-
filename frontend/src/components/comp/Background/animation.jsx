import React, { useEffect, useRef } from 'react';

export default function DocHuntBackground ({ isDarkMode = true }) {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let time = 0;
    
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Neural network particles for AI
    class Particle {
      constructor() {
        this.reset();
      }
      
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = Math.random() * 2 + 1;
        this.opacity = Math.random() * 0.5 + 0.3;
      }
      
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
      }
      
      draw(ctx, color) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = this.opacity;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    
    const particles = [];
    const particleCount = 80;
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }
    
    // Floating documents
    class Document {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 50 + 70;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.01;
        this.opacity = Math.random() * 0.2 + 0.1;
        this.highlighted = false;
        this.highlightTime = 0;
        this.highlightDelay = Math.random() * 500;
      }
      
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;
        
        if (this.x < -this.size) this.x = canvas.width + this.size;
        if (this.x > canvas.width + this.size) this.x = -this.size;
        if (this.y < -this.size) this.y = canvas.height + this.size;
        if (this.y > canvas.height + this.size) this.y = -this.size;
        
        // // Random highlight for search match effect
        // this.highlightDelay--;
        // if (this.highlightDelay <= 0 && !this.highlighted) {
        //   this.highlighted = true;
        //   this.highlightTime = 0;
        // }
        
        // if (this.highlighted) {
        //   this.highlightTime += 0.02;
        //   if (this.highlightTime > 2) {
        //     this.highlighted = false;
        //     this.highlightDelay = Math.random() * 300 + 200;
        //   }
        // }
      }
      
      draw(ctx, color) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Highlight glow for search match
        if (this.highlighted) {
          const glowIntensity = Math.sin(this.highlightTime * Math.PI * 2) * 0.5 + 0.5;
          ctx.shadowBlur = 40 * glowIntensity;
          ctx.shadowColor = isDarkMode ? 'rgba(0, 255, 150, 1)' : 'rgba(0, 200, 100, 1)';
        }
        
        // Document base
        ctx.globalAlpha = this.opacity + (this.highlighted ? 0.3 : 0);
        ctx.fillStyle = this.highlighted 
          ? (isDarkMode ? 'rgba(0, 255, 150, 0.4)' : 'rgba(0, 200, 100, 0.5)')
          : color;
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size * 1.3);
        
        // Folded corner
        ctx.fillStyle = isDarkMode ? 'rgba(100,100,255,0.3)' : 'rgba(50,50,150,0.2)';
        ctx.beginPath();
        ctx.moveTo(this.size/2, -this.size/2);
        ctx.lineTo(this.size/2, -this.size/2 + this.size * 0.3);
        ctx.lineTo(this.size/2 - this.size * 0.3, -this.size/2);
        ctx.closePath();
        ctx.fill();
        
        // Text lines
        ctx.strokeStyle = isDarkMode ? 'rgba(100,150,255,0.5)' : 'rgba(50,100,200,0.4)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(-this.size/2 + 10, -this.size/2 + 20 + i * 15);
          ctx.lineTo(this.size/2 - 10, -this.size/2 + 20 + i * 15);
          ctx.stroke();
        }
        
        // Checkmark when highlighted
        if (this.highlighted && this.highlightTime > 0.3) {
          ctx.strokeStyle = isDarkMode ? 'rgba(0, 255, 150, 1)' : 'rgba(0, 200, 100, 1)';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(-15, 0);
          ctx.lineTo(-5, 10);
          ctx.lineTo(15, -10);
          ctx.stroke();
        }
        
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }
    
    const documents = [];
    for (let i = 0; i < 18; i++) {
      documents.push(new Document());
    }
    
    // Central AI Core - Fixed in middle
    class AICore {
      constructor() {
        this.x = 0;
        this.y = 0;
        this.pulseRadius = 0;
        this.maxPulseRadius = 150;
      }
      
      update() {
        this.x = canvas.width * 0.5;
        this.y = canvas.height * 0.5;
        
        this.pulseRadius += 1.5;
        if (this.pulseRadius > this.maxPulseRadius) {
          this.pulseRadius = 0;
        }
      }
      
      draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        const time2 = time * 2;
        
        // Outer pulse rings
        for (let i = 0; i < 3; i++) {
          const r = this.pulseRadius + i * 50;
          if (r < this.maxPulseRadius) {
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.strokeStyle = isDarkMode 
              ? `rgba(138, 43, 226, ${0.5 * (1 - r / this.maxPulseRadius)})` 
              : `rgba(100, 30, 180, ${0.4 * (1 - r / this.maxPulseRadius)})`;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
        
        // Large outer glow
        const outerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 80);
        outerGlow.addColorStop(0, isDarkMode ? 'rgba(138, 43, 226, 0.3)' : 'rgba(100, 30, 180, 0.3)');
        outerGlow.addColorStop(1, 'rgba(138, 43, 226, 0)');
        ctx.fillStyle = outerGlow;
        ctx.beginPath();
        ctx.arc(0, 0, 80, 0, Math.PI * 2);
        ctx.fill();
        
        // Central AI core with glow
        const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 45);
        coreGradient.addColorStop(0, isDarkMode ? 'rgba(138, 43, 226, 1)' : 'rgba(100, 30, 180, 1)');
        coreGradient.addColorStop(0.5, isDarkMode ? 'rgba(147, 51, 234, 0.8)' : 'rgba(120, 40, 200, 0.8)');
        coreGradient.addColorStop(1, isDarkMode ? 'rgba(138, 43, 226, 0.4)' : 'rgba(100, 30, 180, 0.4)');
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(0, 0, 45, 0, Math.PI * 2);
        ctx.fill();
        
        // Outer hexagon ring
        ctx.strokeStyle = isDarkMode ? 'rgba(147, 51, 234, 0.9)' : 'rgba(120, 40, 200, 0.9)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const x = Math.cos(angle) * 35;
          const y = Math.sin(angle) * 35;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        
        // Rotating energy nodes at hexagon corners
        ctx.save();
        ctx.rotate(time2 * 0.5);
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i;
          const x = Math.cos(angle) * 35;
          const y = Math.sin(angle) * 35;
          
          const nodeGradient = ctx.createRadialGradient(x, y, 0, x, y, 6);
          nodeGradient.addColorStop(0, isDarkMode ? 'rgba(0, 255, 255, 1)' : 'rgba(0, 200, 255, 1)');
          nodeGradient.addColorStop(1, isDarkMode ? 'rgba(0, 255, 255, 0.3)' : 'rgba(0, 200, 255, 0.3)');
          ctx.fillStyle = nodeGradient;
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        
        // Inner rotating triangle (data flow)
        ctx.save();
        ctx.rotate(-time2 * 0.7);
        ctx.strokeStyle = isDarkMode ? 'rgba(0, 255, 255, 0.7)' : 'rgba(0, 200, 255, 0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const angle = (Math.PI * 2 / 3) * i - Math.PI / 2;
          const x = Math.cos(angle) * 20;
          const y = Math.sin(angle) * 20;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
        
        // AI text in center
        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('AI', 0, 0);
        
        // Orbiting data particles
        for (let i = 0; i < 6; i++) {
          const orbitAngle = time2 + (Math.PI / 3) * i;
          const orbitRadius = 50 + Math.sin(time2 * 2 + i) * 5;
          const px = Math.cos(orbitAngle) * orbitRadius;
          const py = Math.sin(orbitAngle) * orbitRadius;
          
          ctx.fillStyle = isDarkMode ? 'rgba(255, 100, 255, 0.9)' : 'rgba(255, 50, 255, 0.9)';
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
          
          // Particle trail
          ctx.strokeStyle = isDarkMode ? 'rgba(255, 100, 255, 0.3)' : 'rgba(255, 50, 255, 0.3)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, orbitRadius, orbitAngle - 0.4, orbitAngle);
          ctx.stroke();
        }
        
        // Pulsing outer ring effect
        const pulseScale = 1 + Math.sin(time2 * 3) * 0.1;
        ctx.strokeStyle = isDarkMode 
          ? `rgba(147, 51, 234, ${0.5 + Math.sin(time2 * 3) * 0.3})` 
          : `rgba(120, 40, 200, ${0.4 + Math.sin(time2 * 3) * 0.2})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 55 * pulseScale, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
      }
    }
    
    const aiCore = new AICore();
    
    // Animation loop
    const animate = () => {
      time += 0.01;
      
      if (isDarkMode) {
        ctx.fillStyle = 'rgba(10, 15, 30, 0.15)';
      } else {
        ctx.fillStyle = 'rgba(240, 245, 255, 0.15)';
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw documents
      const docColor = isDarkMode ? 'rgba(80, 100, 200, 0.2)' : 'rgba(200, 210, 255, 0.5)';
      documents.forEach(doc => {
        doc.update();
        doc.draw(ctx, docColor);
      });
      
      // Draw neural network
      const particleColor = isDarkMode ? 'rgba(138, 43, 226, 0.7)' : 'rgba(100, 30, 180, 0.6)';
      const lineColor = isDarkMode ? 'rgba(138, 43, 226, 0.15)' : 'rgba(100, 30, 180, 0.12)';
      
      particles.forEach((p, i) => {
        p.update();
        p.draw(ctx, particleColor);
        
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 1;
            ctx.globalAlpha = (1 - distance / 120) * 0.4;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      });
      
      // Draw AI Core in center
      aiCore.update();
      aiCore.draw(ctx);
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDarkMode]);
  
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <canvas
        ref={canvasRef}
        className={`w-full h-full transition-colors duration-1000 ${
          isDarkMode ? 'bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900' : 'bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-50'
        }`}
      />
    </div>
  );
};

// export default function App() {
//   const [isDarkMode, setIsDarkMode] = React.useState(true);
  
//   return (
//     <div className="relative min-h-screen">
//       <DocHuntBackground isDarkMode={isDarkMode} />
      
//       <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8">
//         <div className={`max-w-2xl w-full rounded-2xl backdrop-blur-xl p-8 shadow-2xl border transition-all duration-500 ${
//           isDarkMode 
//             ? 'bg-slate-900/40 border-purple-500/20' 
//             : 'bg-white/40 border-purple-200/50'
//         }`}>
//           <h1 className={`text-5xl font-bold mb-4 transition-colors ${
//             isDarkMode ? 'text-white' : 'text-slate-900'
//           }`}>
//             DocHunt-AI
//           </h1>
//           <p className={`text-xl mb-8 transition-colors ${
//             isDarkMode ? 'text-purple-200' : 'text-slate-700'
//           }`}>
//             Intelligent Document Search with AI-Powered Semantic Analysis
//           </p>
          
//           <div className={`mb-6 p-4 rounded-lg ${isDarkMode ? 'bg-purple-900/30' : 'bg-purple-100/50'}`}>
//             <p className={`text-sm ${isDarkMode ? 'text-purple-200' : 'text-purple-900'}`}>
//               🤖 <strong>AI Robot:</strong> Lives inside magnifier, moves intelligently<br/>
//               🔍 <strong>Smart Search:</strong> Travels document-to-document scanning content<br/>
//               ✅ <strong>Results:</strong> Documents glow green with checkmark when matched<br/>
//               💜 <strong>Neural Net:</strong> Purple AI brain processes in background
//             </p>
//           </div>
          
//           <button
//             onClick={() => setIsDarkMode(!isDarkMode)}
//             className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
//               isDarkMode
//                 ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/50'
//                 : 'bg-purple-500 hover:bg-purple-600 text-white shadow-lg shadow-purple-400/50'
//             }`}
//           >
//             {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }