import React from "react";
import Icon from "../../../components/common/Icon";
import "./EquipmentVisualization.css";

const EquipmentVisualization = () => {
  return (
    <div className="equipment-viz-container fade-in">
      <div className="equipment-hero-card glass-card">
        <div className="hero-camera-image">
          {/* Placeholder for an actual camera image, using a large icon for now */}
          <Icon name="videocam" modifiers="xl" />
        </div>
        <div className="hero-camera-details">
          <span className="hero-label">Primary Camera</span>
          <h2>ARRI Alexa Mini LF</h2>
          <p>Format: Large Format Sensor • Resolution: 4.5K • Mount: LPL</p>
          <div className="hero-status">
            <span className="status-dot pulse" style={{ backgroundColor: '#10b981' }}></span>
            <span>Allocated</span>
          </div>
        </div>
      </div>

      <div className="equipment-grid">
        <div className="equipment-category glass-card">
          <div className="cat-header">
            <Icon name="camera" modifiers="sm" />
            <h3>Lenses</h3>
          </div>
          <ul className="equipment-list">
            <li>
              <span>Signature Prime Set (18-125mm)</span>
              <span className="eq-qty">x1</span>
            </li>
            <li>
              <span>Angenieux Optimo Ultra 12x</span>
              <span className="eq-qty">x1</span>
            </li>
          </ul>
        </div>

        <div className="equipment-category glass-card">
          <div className="cat-header">
            <Icon name="highlight" modifiers="sm" />
            <h3>Lighting</h3>
          </div>
          <ul className="equipment-list">
            <li>
              <span>ARRI SkyPanel S60-C</span>
              <span className="eq-qty">x4</span>
            </li>
            <li>
              <span>Aputure 1200d Pro</span>
              <span className="eq-qty">x2</span>
            </li>
            <li>
              <span>Astera Titan Tube Set</span>
              <span className="eq-qty">x8</span>
            </li>
          </ul>
        </div>

        <div className="equipment-category glass-card">
          <div className="cat-header">
            <Icon name="handyman" modifiers="sm" />
            <h3>Grip & Support</h3>
          </div>
          <ul className="equipment-list">
            <li>
              <span>Chapman Peewee Dolly</span>
              <span className="eq-qty">x1</span>
            </li>
            <li>
              <span>OConnor 2575D Fluid Head</span>
              <span className="eq-qty">x2</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default EquipmentVisualization;
