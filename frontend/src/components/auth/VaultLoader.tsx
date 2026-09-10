import React from 'react';
import '../../styles/vaultLoader.css';

interface VaultLoaderProps {
  className?: string;
}

export const VaultLoader: React.FC<VaultLoaderProps> = ({ className = '' }) => {
  return (
    <div className={`vault-loader-container ${className}`} aria-label="Loading animation">
      <div className="vault-loader-wide">
        <div className="vl-l1" />
        <div className="vl-l2" />
        <div className="vl-e1 vl-animation-effect-light" />
        <div className="vl-e2 vl-animation-effect-light-d" />
        <div className="vl-e3 vl-animation-effect-rot">X</div>
        <div className="vl-e4 vl-animation-effect-light" />
        <div className="vl-e5 vl-animation-effect-light-d" />
        <div className="vl-e6 vl-animation-effect-scale">*</div>
        <div className="vl-e7" />
        <div className="vl-e8" />
      </div>
    </div>
  );
};

export default VaultLoader;
