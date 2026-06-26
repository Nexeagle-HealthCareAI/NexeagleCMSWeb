import React, { useState } from 'react';
import { partnerService } from '../services/partnerService';
import type { CreatePartnerPayload } from '../services/partnerService';
import { X } from 'lucide-react';

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'age' ? parseInt(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await partnerService.create(formData);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add partner. Please verify all fields.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }}>
        <div className="modal-header">
          <h2>Add New Partner</h2>
          <button className="icon-button" onClick={onClose}><X size={20} /></button>
        </div>
        
        {error && <div className="alert error" style={{ margin: '16px 24px' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label>Full Name *</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Age *</label>
              <input type="number" name="age" value={formData.age || ''} onChange={handleChange} required min="18" />
            </div>
            <div className="form-group">
              <label>Sex *</label>
              <select name="sex" value={formData.sex} onChange={handleChange} required>
                <option value="">Select Sex</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Highest Qualification *</label>
              <input type="text" name="highestQualification" value={formData.highestQualification} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Current Profession *</label>
              <input type="text" name="currentProfession" value={formData.currentProfession} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Email (Optional)</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Phone Number (Optional)</label>
              <input type="text" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Address *</label>
              <input type="text" name="address" value={formData.address} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>City *</label>
              <input type="text" name="city" value={formData.city} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>State *</label>
              <input type="text" name="state" value={formData.state} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Country *</label>
              <input type="text" name="country" value={formData.country} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Pincode *</label>
              <input type="text" name="pincode" value={formData.pincode} onChange={handleChange} required />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Add Partner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPartnerModal;
