// app/page.js

"use client"
import FluidGlass from '@/components/FluidGlass';

export default function Home() {
  return (
    <div className="h-lvh" style={{ position: 'relative' }}>
      <FluidGlass 
        mode="lens" 
        lensProps={{
          // Fluid Simulation Controls
          distortion: 0.1,       // Sets the distortion amount (0.00 to 2.00)
          curl: 0,              // Sets the amount of the curl effect (0.0 to 50)
          swirl: 0.5,             // Sets the amount of the swirling effect (0 to 20)
          radius: 0.15,          // Sets the fluid radius (0.01 to 1.00)
          force: 5,              // Multiplies mouse velocity to increase splatter (0.0 to 20)
          pressure: 0.8,         // Controls the reduction of pressure (0.00 to 1.00)
          densityDissipation: 0.92, // How quickly the fluid density fades (0.00 to 1.00)
          velocityDissipation: 1, // How quickly the fluid's movement slows down (0.00 to 1.00)
          intensity: 10,          // Sets the fluid intensity (0 to 10)
          rainbow: false,         // Activates color mode based on mouse direction
        }} 
      />
    </div>  
  );
}