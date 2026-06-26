import React, { useState, useEffect, useRef } from 'react';
import { partnerService } from '../services/partnerService';
import type { CreatePartnerPayload } from '../services/partnerService';
import { X, CheckCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import './AddPartnerDrawer.css';

interface AddPartnerModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const AddPartnerModal: React.FC<AddPartnerModalProps> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState<CreatePartnerPayload>({
    name: '',
    age: 0,
    sex: '',
    highestQualification: '',
    currentProfession: '',
    address: '',
    city: '',
    state: '',
    country: '',
    pincode: '',
    email: '',
    phoneNumber: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const drawerRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // Matches animation duration
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'age' ? parseInt(value) || 0 : value
    }));
  };

  const fireConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await partnerService.create(formData);
      setIsSuccess(true);
      fireConfetti();
      
      // Keep it open for 2.5s to show the celebration
      setTimeout(() => {
        onSuccess();
      }, 2500);
      
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add partner. Please verify all fields.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`drawer-overlay ${isClosing ? 'drawer-closing' : ''}`}>
      <div className="drawer-content" ref={drawerRef}>
        <div className="drawer-header">
          <h2>Add New Partner</h2>
          <button className="drawer-close-btn" onClick={handleClose}><X size={20} /></button>
        </div>
        
        {isSuccess ? (
          <div className="drawer-success">
            <div className="drawer-success-icon">
              <CheckCircle size={48} strokeWidth={2.5} />
            </div>
            <h3>Partner Added!</h3>
            <p>Welcome {formData.name} to the network.</p>
          </div>
        ) : (
          <>
            {error && <div className="alert error" style={{ margin: '16px 32px' }}>{error}</div>}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="drawer-body">
                <div className="drawer-grid">
                  <div className="drawer-form-group full-width">
                    <label>Full Name *</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="Enter full name" />
                  </div>
                  <div className="drawer-form-group">
                    <label>Age *</label>
                    <input type="number" name="age" value={formData.age || ''} onChange={handleChange} required min="18" placeholder="e.g. 35" />
                  </div>
                  <div className="drawer-form-group">
                    <label>Sex *</label>
                    <select name="sex" value={formData.sex} onChange={handleChange} required>
                      <option value="">Select Sex</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="drawer-form-group">
                    <label>Highest Qualification *</label>
                    <input type="text" name="highestQualification" value={formData.highestQualification} onChange={handleChange} required placeholder="e.g. MBBS, MD" />
                  </div>
                  <div className="drawer-form-group">
                    <label>Current Profession *</label>
                    <input type="text" name="currentProfession" value={formData.currentProfession} onChange={handleChange} required placeholder="e.g. Doctor, Pharmacist" />
                  </div>
                  <div className="drawer-form-group">
                    <label>Email (Optional)</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="email@example.com" />
                  </div>
                  <div className="drawer-form-group">
                    <label>Phone Number (Optional)</label>
                    <input type="text" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="+91..." />
                  </div>
                  <div className="drawer-form-group full-width">
                    <label>Address *</label>
                    <input type="text" name="address" value={formData.address} onChange={handleChange} required placeholder="Street address" />
                  </div>
                  <div className="drawer-form-group">
                    <label>City *</label>
                    <input type="text" name="city" value={formData.city} onChange={handleChange} required placeholder="City" />
                  </div>
                  <div className="drawer-form-group">
                    <label>State *</label>
                    <input type="text" name="state" value={formData.state} onChange={handleChange} required placeholder="State" />
                  </div>
                  <div className="drawer-form-group">
                    <label>Country *</label>
                    <input type="text" name="country" value={formData.country} onChange={handleChange} required placeholder="Country" />
                  </div>
                  <div className="drawer-form-group">
                    <label>Pincode *</label>
                    <input type="text" name="pincode" value={formData.pincode} onChange={handleChange} required placeholder="Postal code" />
                  </div>
                </div>
              </div>
              <div className="drawer-footer">
                <button type="button" className="btn-drawer-cancel" onClick={handleClose}>Cancel</button>
                <button type="submit" className="btn-drawer-submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Add Partner'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default AddPartnerModal;

