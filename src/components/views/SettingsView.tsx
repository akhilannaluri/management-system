import React, { useState, useEffect } from 'react';
import { useApartment } from '../../context/ApartmentContext';
import { useAuth } from '../../context/AuthContext';
import { ApartmentSettings } from '../../types';
import { 
  Building2, 
  Save, 
  Key, 
  User, 
  MapPin, 
  IndianRupee,
  ShieldCheck
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, showToast } = useApartment();
  const { user, updateProfile } = useAuth();

  const [apartmentName, setApartmentName] = useState(settings.apartmentName || '');
  const [address, setAddress] = useState(settings.address || '');
  const [defaultFee, setDefaultFee] = useState(String(settings.defaultMonthlyMaintenance || 1500));
  const [totalFlats, setTotalFlats] = useState(String(settings.totalFlats || 57));
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Admin profile
  const [adminName, setAdminName] = useState(user?.name || 'Administrator');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    setApartmentName(settings.apartmentName || '');
    setAddress(settings.address || '');
    setDefaultFee(String(settings.defaultMonthlyMaintenance || 1500));
    setTotalFlats(String(settings.totalFlats || 57));
  }, [settings]);

  useEffect(() => {
    if (user) {
      setAdminName(user.name);
    }
  }, [user]);

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await updateSettings({
        apartmentName: apartmentName.trim(),
        address: address.trim(),
        defaultMonthlyMaintenance: Number(defaultFee) || 1500,
        totalFlats: Number(totalFlats) || 57
      });
      showToast('Settings saved successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update settings', 'danger');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'warning');
      return;
    }
    if (newPassword && !currentPassword) {
      showToast('Please enter your current password to change password', 'warning');
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateProfile({
        name: adminName,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined
      });
      showToast('Admin password updated successfully', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast(err.message || 'Failed to update password', 'danger');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const currency = settings.currencySymbol || '₹';

  return (
    <div className="container-fluid p-3 p-md-4 max-w-4xl mx-auto pb-5">
      
      {/* Header */}
      <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white mb-4">
        <div>
          <h3 className="fw-bold text-dark mb-1">
            Settings
          </h3>
          <p className="text-muted small mb-0">
            Configure apartment name, default maintenance rate, and admin credentials.
          </p>
        </div>
      </div>

      <div className="row g-4">
        
        {/* Apartment Configuration */}
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
            <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom">
              <Building2 size={20} className="text-primary" />
              <h5 className="fw-bold text-dark mb-0">Apartment Details</h5>
            </div>

            <form onSubmit={handleSettingsSubmit}>
              <div className="mb-3">
                <label className="form-label small fw-semibold text-dark">
                  Apartment Name
                </label>
                <input
                  type="text"
                  className="form-control rounded-3"
                  value={apartmentName}
                  onChange={(e) => setApartmentName(e.target.value)}
                  placeholder="e.g. Greenview Heights"
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold text-dark">
                  Address / Location
                </label>
                <textarea
                  className="form-control rounded-3"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Plot 42, Main Road, Hyderabad"
                />
              </div>

              <div className="row g-2 mb-4">
                <div className="col-6">
                  <label className="form-label small fw-semibold text-dark">
                    Total Flats
                  </label>
                  <input
                    type="number"
                    className="form-control rounded-3"
                    value={totalFlats}
                    onChange={(e) => setTotalFlats(e.target.value)}
                    required
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-semibold text-dark">
                    Default Maintenance ({currency})
                  </label>
                  <input
                    type="number"
                    className="form-control rounded-3 fw-bold"
                    value={defaultFee}
                    onChange={(e) => setDefaultFee(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100 fw-bold rounded-3 py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
                disabled={isSavingSettings}
              >
                <Save size={18} />
                <span>{isSavingSettings ? 'Saving...' : 'Save Apartment Details'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Admin Credentials */}
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
            <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom">
              <ShieldCheck size={20} className="text-primary" />
              <h5 className="fw-bold text-dark mb-0">Admin Login & Password</h5>
            </div>

            <form onSubmit={handleProfileSubmit}>
              <div className="mb-3">
                <label className="form-label small fw-semibold text-dark">
                  Admin Name
                </label>
                <input
                  type="text"
                  className="form-control rounded-3"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold text-dark">
                  Current Password
                </label>
                <input
                  type="password"
                  className="form-control rounded-3"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold text-dark">
                  New Password
                </label>
                <input
                  type="password"
                  className="form-control rounded-3"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave empty to keep same"
                />
              </div>

              <div className="mb-4">
                <label className="form-label small fw-semibold text-dark">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  className="form-control rounded-3"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-outline-dark w-100 fw-bold rounded-3 py-2 d-flex align-items-center justify-content-center gap-2"
                disabled={isSavingProfile}
              >
                <Key size={18} />
                <span>{isSavingProfile ? 'Saving...' : 'Update Password'}</span>
              </button>
            </form>
          </div>
        </div>

      </div>

    </div>
  );
};
