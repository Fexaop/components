"use client"
import { useEffect,useState } from "react";
export default function Page() {
    // log mouse position
    const [prevmousePosition, setPrevMousePosition] = useState([{ x: 0, y: 0 }]);
    useEffect(() => {
        const handleMouseMove = (event: MouseEvent) => {
            setPrevMousePosition((prev) => {
                const newPrev = [...prev, { x: event.clientX, y: event.clientY }];
                if (newPrev.length > 3) {
                    newPrev.shift();
                }
                return newPrev;
            });
        };
        window.addEventListener("mousemove", handleMouseMove);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
        };
    }, []);
    useEffect(() => {
        console.log(prevmousePosition);        
        // find a circle that passes through the last three points
        if (prevmousePosition.length < 3) return;
        const p1 = prevmousePosition[prevmousePosition.length - 1];
        const p2 = prevmousePosition[prevmousePosition.length - 2];
        const p3 = prevmousePosition[prevmousePosition.length - 3];
        const A = p2.x - p1.x;
        const B = p2.y - p1.y;
        const C = p3.x - p1.x;
        const D = p3.y - p1.y;
        const E = A * (p1.x + p2.x) + B * (p1.y + p2.y);
        const F = C * (p1.x + p3.x) + D * (p1.y + p3.y);
        const G = 2 * (A * (p3.y - p2.y) - B * (p3.x - p2.x));
        if (G === 0) return; // points are collinear
        const cx = (D * E - B * F) / G;
        const cy = (A * F - C * E) / G;
        const radius = Math.sqrt((cx - p1.x) ** 2 + (cy - p1.y) ** 2);
        console.log(`Circle center: (${cx}, ${cy}), radius: ${radius}`);
        
    }, [prevmousePosition]);
    
    return (
        <div className="v-lvh w-lvw">
        
        </div>
    );
}