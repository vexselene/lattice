import React from 'react';
import '../../styles/speederLoader.css';

interface SpeederLoaderProps {
  className?: string;
}

export const SpeederLoader: React.FC<SpeederLoaderProps> = ({ className = '' }) => {
  return (
    <div className={`speeder-container ${className}`} aria-label="Decrypting canvas animation">
      <div className="speeder-loader">
        <span>
          <span />
          <span />
          <span />
          <span />
        </span>
        <div className="speeder-base">
          <span />
          <div className="speeder-face" />
        </div>
      </div>
      <div className="speeder-longfazers">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
};

export default SpeederLoader;
