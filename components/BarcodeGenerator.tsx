
import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeProps {
  value: string;
  className?: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
}

export const BarcodeGenerator: React.FC<BarcodeProps> = ({ 
  value, 
  className = '', 
  width = 1.5, 
  height = 38,
  displayValue = true 
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: "CODE128",
          width,
          height,
          displayValue,
          font: "monospace",
          fontSize: 12,
          textMargin: 2,
          margin: 4,
          background: "transparent",
          lineColor: "#0f172a"
        });
      } catch (err) {
        console.warn("JsBarcode render error:", err);
      }
    }
  }, [value, width, height, displayValue]);

  if (!value) return null;

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <svg ref={svgRef} className="max-w-full" />
    </div>
  );
};

