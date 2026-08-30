import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { MapPinIcon, CheckCircleIcon, ArrowPathIcon, TrashIcon, PlusIcon, XMarkIcon, QrCodeIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';

// Fix default Leaflet marker icon broken by bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom glowing marker icon
const glowIcon = new L.DivIcon({
  className: '',
  html: `<div style="
    width: 26px; height: 26px;
    background: #6366f1;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 0 0 4px rgba(99,102,241,0.4), 0 0 20px rgba(99,102,241,0.6);
    cursor: grab;
  "></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

// Component to handle map clicks
const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const KioskSettings = () => {
  const { language, locale } = useLanguage();
  const { hasPermission } = useAuth();
  const isKhmer = language === 'kh' || locale === 'kh';

  // Granular Branch Permissions
  const canAdd = hasPermission('add_branch');
  const canEdit = hasPermission('edit_branch');
  const canDelete = hasPermission('delete_branch');

  const [settingsList, setSettingsList] = useState([]);
  const [selectedId, setSelectedId] = useState(null); // null means "Add Mode"

  // Form fields
  const [name, setName] = useState('');
  const [markerPos, setMarkerPos] = useState([11.5564, 104.9282]);
  const [radius, setRadius] = useState(100);

  // Branch QR Code States
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrBranch, setQrBranch] = useState(null);
  const [branchQrImage, setBranchQrImage] = useState('');
  const [qrLoading, setQrLoading] = useState(false);

  // States
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [currentGps, setCurrentGps] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const mapRef = useRef(null);

  // Fetch settings from API
  const fetchSettings = async () => {
    try {
      const res = await api.get('/kiosk-settings');
      setSettingsList(res.data);

      // If we are currently editing a selected one, refresh its state
      if (selectedId) {
        const current = res.data.find(s => s.id === selectedId);
        if (current) {
          setName(current.name);
          setMarkerPos([current.latitude, current.longitude]);
          setRadius(current.radius);
        } else {
          resetForm();
        }
      }
    } catch (err) {
      console.error('Error loading kiosk settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleViewBranchQr = async (branch, e) => {
    e.stopPropagation();
    setQrBranch(branch);
    setShowQrModal(true);
    setQrLoading(true);
    setBranchQrImage('');
    try {
      const res = await api.get(`/kiosk-settings/${branch.id}/qrcode`);
      setBranchQrImage(res.data.qrImage);
    } catch (err) {
      console.error('Error fetching branch QR:', err);
      alert('Failed to load branch QR code');
    } finally {
      setQrLoading(false);
    }
  };

  // When settingsList loads and user cannot add, automatically select first branch to view
  useEffect(() => {
    if (!canAdd && !selectedId && settingsList.length > 0) {
      selectSetting(settingsList[0]);
    }
  }, [settingsList, canAdd, selectedId]);

  // Handle Map clicks to move/set active coordinates
  const handleMapClick = useCallback((lat, lng) => {
    if (selectedId ? !canEdit : !canAdd) return;
    setMarkerPos([lat, lng]);
  }, [selectedId, canEdit, canAdd]);

  // Reset form to Add Mode
  const resetForm = () => {
    setSelectedId(null);
    setName('');
    setRadius(100);
    // Use current GPS or fallback to Phnom Penh HQ
    if (currentGps) {
      setMarkerPos([currentGps.lat, currentGps.lng]);
    } else if (settingsList.length > 0) {
      setMarkerPos([settingsList[0].latitude, settingsList[0].longitude]);
    } else {
      setMarkerPos([11.5564, 104.9282]);
    }
  };

  // Select a geofence for editing
  const selectSetting = (s) => {
    setSelectedId(s.id);
    setName(s.name);
    setMarkerPos([s.latitude, s.longitude]);
    setRadius(s.radius);

    if (mapRef.current) {
      mapRef.current.flyTo([s.latitude, s.longitude], 15, { animate: true, duration: 1 });
    }
  };

  // Get user's current GPS location
  const getMyLocation = () => {
    setGpsLoading(true);
    setGpsError('');
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by this browser.');
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentGps({ lat, lng });
        setMarkerPos([lat, lng]);

        // Pan map
        if (mapRef.current) {
          mapRef.current.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
        }
        setGpsLoading(false);
      },
      (_err) => {
        setGpsError('Could not access your GPS. Please allow location access.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  // Save settings (Create or Update)
  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter a location name');
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      const payload = {
        name: name.trim(),
        latitude: markerPos[0],
        longitude: markerPos[1],
        radius: parseFloat(radius),
      };

      if (selectedId) {
        // Update mode
        await api.put(`/kiosk-settings/${selectedId}`, payload);
      } else {
        // Create mode
        const res = await api.post('/kiosk-settings', payload);
        // Select it after creation
        setSelectedId(res.data.data.id);
      }

      setSaveSuccess(true);
      await fetchSettings();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving kiosk settings:', err);
      alert(err.response?.data?.message || 'Failed to save geofence settings');
    } finally {
      setSaving(false);
    }
  };

  // Delete geofence
  const handleDelete = async (id, e) => {
    e.stopPropagation(); // Prevent selecting the card
    if (!window.confirm('Are you sure you want to delete this geofence zone?')) {
      return;
    }

    setDeletingId(id);
    try {
      await api.delete(`/kiosk-settings/${id}`);
      if (selectedId === id) {
        resetForm();
      }
      await fetchSettings();
    } catch (err) {
      console.error('Error deleting kiosk setting:', err);
      alert('Failed to delete geofence');
    } finally {
      setDeletingId(null);
    }
  };

  const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const distanceFromGps = currentGps
    ? haversineDistance(currentGps.lat, currentGps.lng, markerPos[0], markerPos[1])
    : null;

  const loadJsPdf = () => {
    return new Promise((resolve, reject) => {
      if (window.jspdf?.jsPDF) {
        resolve(window.jspdf.jsPDF);
        return;
      }
      const existingScript = document.querySelector('script[src*="jspdf"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          if (window.jspdf?.jsPDF) resolve(window.jspdf.jsPDF);
          else reject(new Error('jsPDF loaded but class not found'));
        });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load jsPDF')));
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload = () => {
        if (window.jspdf?.jsPDF) resolve(window.jspdf.jsPDF);
        else reject(new Error('jsPDF not found'));
      };
      script.onerror = () => reject(new Error('Failed to load jsPDF script'));
      document.head.appendChild(script);
    });
  };

  const handleSavePdf = async () => {
    if (!branchQrImage || !qrBranch) return;

    try {
      const JsPdfClass = await loadJsPdf();
      if (!JsPdfClass) {
        throw new Error('jsPDF is not loaded yet.');
      }

      const doc = new JsPdfClass({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth(); // 210
      const pageHeight = doc.internal.pageSize.getHeight(); // 297

      // Outer Decorative Border
      doc.setDrawColor(37, 99, 235); // Blue #2563EB
      doc.setLineWidth(1.5);
      doc.roundedRect(16, 16, pageWidth - 32, pageHeight - 32, 6, 6, 'S');

      // Inner Background Panel
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.roundedRect(22, 22, pageWidth - 44, pageHeight - 44, 4, 4, 'FD');

      // Top Tag Badge
      doc.setFillColor(238, 242, 255);
      doc.setDrawColor(199, 210, 254);
      doc.setLineWidth(0.5);
      doc.roundedRect(60, 36, pageWidth - 120, 10, 5, 5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(79, 70, 229);
      doc.text('BRANCH LOCATION QR CODE', pageWidth / 2, 42.5, { align: 'center' });

      // Branch Name
      doc.setFontSize(26);
      doc.setTextColor(30, 27, 75);
      doc.text(qrBranch.name || 'Branch Location', pageWidth / 2, 62, { align: 'center' });

      // Subtitle
      doc.setFontSize(13);
      doc.setTextColor(79, 70, 229);
      doc.text('Scan to Check-in Attendance', pageWidth / 2, 72, { align: 'center' });

      // QR Code Card Container
      const qrSize = 115;
      const qrX = (pageWidth - qrSize) / 2;
      const qrY = 86;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.8);
      doc.roundedRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 4, 4, 'FD');

      // Add Base64 QR Image to PDF
      doc.addImage(branchQrImage, 'PNG', qrX, qrY, qrSize, qrSize);

      // Instruction Text
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text('Please scan this QR code with your mobile app to check in', pageWidth / 2, 224, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Employee Attendance & Kiosk Management System', pageWidth / 2, 232, { align: 'center' });

      // Code String Tag
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(50, 241, pageWidth - 100, 9, 3, 3, 'FD');
      doc.setFont('courier', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`branch_qr:${qrBranch.id}`, pageWidth / 2, 247, { align: 'center' });

      // Directly download PDF file
      const safeName = (qrBranch.name || 'Branch').replace(/[^a-zA-Z0-9_-]/g, '_');
      doc.save(`Branch_QR_${safeName}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Error generating PDF file.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <span className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="font-khmer text-sm">Loading Kiosk Settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <MapPinIcon className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-khmer">
              {isKhmer ? 'ការកំណត់ទីតាំងសាខា (Branch Settings)' : 'Branch & Geofence Settings'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 font-khmer">
              {isKhmer
                ? 'គ្រប់គ្រងទីតាំង Geofences និងកម្រិតកាំ (Radius) សម្រាប់គណនាវត្តមានតាមសាខាផ្សេងៗ។'
                : 'Manage branch geofence coordinates and allowed radius for attendance check-ins.'}
            </p>
          </div>
        </div>

        {/* My Location Button */}
        <button
          id="get-my-location-btn"
          onClick={getMyLocation}
          disabled={gpsLoading}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 transition-all cursor-pointer outline-none disabled:opacity-50 font-khmer"
        >
          {gpsLoading ? (
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
          ) : (
            <MapPinIcon className="h-4 w-4" />
          )}
          {gpsLoading
            ? (isKhmer ? 'កំពុងស្វែងរក GPS...' : 'Getting GPS...')
            : (isKhmer ? '📍 ទីតាំងបច្ចុប្បន្នរបស់ខ្ញុំ' : '📍 Use My Location')}
        </button>
      </div>

      {gpsError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-khmer animate-pulse">
          ⚠️ {gpsError}
        </div>
      )}

      {/* Main Layout: Map + Geofences Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Side: Map Panel — 2/3 width */}
        <div className="lg:col-span-2">
          <div className="glass-card rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
            {/* Map instruction */}
            <div className="px-5 py-3.5 bg-slate-950/60 border-b border-white/5 flex items-center justify-between text-xs text-slate-400 font-khmer">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse inline-block" />
                <span>{isKhmer ? 'ចុចលើផែនទី ឬអូស Marker ដើម្បីកំណត់ទីតាំង' : 'Click on map or drag marker to set branch location'}</span>
              </div>
              <span className="text-[10px] text-slate-500">{isKhmer ? 'ទិដ្ឋភាពផែនទី' : 'Active Map View'}</span>
            </div>

            {/* Leaflet Map */}
            <div className="h-[480px] w-full relative" id="kiosk-map-container">
              <MapContainer
                center={markerPos}
                zoom={14}
                style={{ height: '100%', width: '100%' }}
                ref={mapRef}
                className="z-0"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Click handler */}
                <MapClickHandler onMapClick={handleMapClick} />

                {/* Render ALL other inactive geofence zones on map */}
                {settingsList.map((s) => {
                  if (s.id === selectedId) return null;
                  return (
                    <React.Fragment key={`inactive-${s.id}`}>
                      <Circle
                        center={[s.latitude, s.longitude]}
                        radius={s.radius}
                        pathOptions={{
                          color: '#a5b4fc', // Light lavender-indigo
                          fillColor: '#c7d2fe',
                          fillOpacity: 0.08,
                          weight: 1.5,
                          dashArray: '5 5',
                        }}
                      />
                      <Marker
                        position={[s.latitude, s.longitude]}
                        eventHandlers={{
                          click: () => selectSetting(s)
                        }}
                        icon={new L.DivIcon({
                          className: '',
                          html: `<div style="
                            width: 18px; height: 18px;
                            background: #64748b;
                            border: 2px solid white;
                            border-radius: 50%;
                            cursor: pointer;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                          " title="${s.name}"></div>`,
                          iconSize: [18, 18],
                          iconAnchor: [9, 9],
                        })}
                      />
                    </React.Fragment>
                  );
                })}

                {/* Active Geofence circle */}
                <Circle
                  center={markerPos}
                  radius={radius}
                  pathOptions={{
                    color: '#6366f1',
                    fillColor: '#6366f1',
                    fillOpacity: 0.14,
                    weight: 2,
                    dashArray: '6 4',
                  }}
                />

                {/* Active Draggable Center Marker */}
                <Marker
                  position={markerPos}
                  icon={glowIcon}
                  draggable={selectedId ? canEdit : canAdd}
                  eventHandlers={{
                    dragend: (e) => {
                      if (selectedId ? !canEdit : !canAdd) return;
                      const latlng = e.target.getLatLng();
                      setMarkerPos([latlng.lat, latlng.lng]);
                    },
                  }}
                />

                {/* Current GPS position marker (light blue dot) */}
                {currentGps && (
                  <Marker
                    position={[currentGps.lat, currentGps.lng]}
                    icon={new L.DivIcon({
                      className: '',
                      html: `<div style="
                        width: 14px; height: 14px;
                        background: #22d3ee;
                        border: 2px solid white;
                        border-radius: 50%;
                        box-shadow: 0 0 0 4px rgba(34,211,238,0.3);
                      " title="Your current GPS position"></div>`,
                      iconSize: [14, 14],
                      iconAnchor: [7, 7],
                    })}
                  />
                )}
              </MapContainer>
            </div>
          </div>
        </div>

        {/* Right Side: Geofence List & Edit Form Panel — 1/3 width */}
        <div className="lg:col-span-1 flex flex-col gap-5">

          {/* Geofence List Section */}
          <div className="glass-card rounded-3xl p-5 border border-white/10 flex flex-col max-h-[300px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white font-khmer">
                {isKhmer ? `សាខាដែលបានកំណត់ (${settingsList.length})` : `Configured Branches (${settingsList.length})`}
              </h3>

              {selectedId && canAdd && (
                <button
                  onClick={resetForm}
                  className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 font-khmer cursor-pointer border-none bg-transparent outline-none"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  {isKhmer ? 'បន្ថែមថ្មី' : 'Add New'}
                </button>
              )}
            </div>

            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1 custom-scrollbar">
              {settingsList.map((s) => {
                const isActive = s.id === selectedId;
                return (
                  <div
                    key={s.id}
                    onClick={() => selectSetting(s)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex justify-between items-center group ${isActive
                        ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-200'
                        : 'bg-slate-900/40 border-white/5 text-slate-300 hover:bg-slate-900/70 hover:border-white/10'
                      }`}
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-bold font-khmer leading-tight">{s.name}</p>
                      <p className="text-[10px] text-slate-400 tabular-nums">
                        Radius: {s.radius}m · ({s.latitude.toFixed(4)}, {s.longitude.toFixed(4)})
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleViewBranchQr(s, e)}
                        className="p-2 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title={isKhmer ? "មើល QR Code សាខា" : "View Branch QR Code"}
                      >
                        <QrCodeIcon className="h-4 w-4" />
                      </button>

                      {canDelete && (
                        <button
                          onClick={(e) => handleDelete(s.id, e)}
                          disabled={deletingId === s.id}
                          className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                          title={isKhmer ? "លុបទីតាំងសាខា" : "Delete geofence"}
                        >
                          {deletingId === s.id ? (
                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                          ) : (
                            <TrashIcon className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Edit/Create Form Card */}
          <div className="glass-card rounded-3xl p-5 border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white font-khmer">
                  {selectedId
                    ? (isKhmer ? '📝 កែប្រែ Geofence ទីតាំង' : '📝 Edit Branch Geofence')
                    : (isKhmer ? '➕ បន្ថែម Geofence ថ្មី' : '➕ Add New Geofence')}
                </h3>
                {selectedId && !canEdit && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-300 font-khmer">
                    {isKhmer ? '🔒 មើលតែប៉ុណ្ណោះ' : '🔒 Read-only'}
                  </span>
                )}
                {!selectedId && !canAdd && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-300 font-khmer">
                    {isKhmer ? '🔒 គ្មានសិទ្ធិបង្កើត' : '🔒 No Create Permission'}
                  </span>
                )}
              </div>
              {selectedId && canAdd && (
                <button
                  onClick={resetForm}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer border-none bg-transparent outline-none"
                  title={isKhmer ? "ប្តូរទៅបន្ថែមថ្មី" : "Switch to Add Mode"}
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1 font-khmer">
                  {isKhmer ? 'ឈ្មោះទីតាំង / ឈ្មោះសាខា (Location Name)' : 'Location / Branch Name'}
                </label>
                <input
                  id="geofence-name"
                  type="text"
                  placeholder={isKhmer ? "ឧ. ការិយាល័យកណ្តាល (Phnom Penh HQ)" : "e.g. Phnom Penh HQ"}
                  value={name}
                  disabled={selectedId ? !canEdit : !canAdd}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full py-2.5 px-4 bg-slate-950/60 border border-white/10 text-white rounded-xl text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1 font-khmer">
                    Latitude
                  </label>
                  <input
                    id="geofence-lat"
                    type="number"
                    step="any"
                    value={markerPos[0]}
                    disabled={selectedId ? !canEdit : !canAdd}
                    onChange={(e) => setMarkerPos([parseFloat(e.target.value) || 0, markerPos[1]])}
                    className="w-full py-2.5 px-4 bg-slate-950/60 border border-white/10 text-white rounded-xl text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all tabular-nums disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1 font-khmer">
                    Longitude
                  </label>
                  <input
                    id="geofence-lng"
                    type="number"
                    step="any"
                    value={markerPos[1]}
                    disabled={selectedId ? !canEdit : !canAdd}
                    onChange={(e) => setMarkerPos([markerPos[0], parseFloat(e.target.value) || 0])}
                    className="w-full py-2.5 px-4 bg-slate-950/60 border border-white/10 text-white rounded-xl text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all tabular-nums disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Radius Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase font-khmer">
                    {isKhmer ? 'កាំដែលអនុញ្ញាត (Allowed Radius)' : 'Allowed Radius'}
                  </label>
                  <span className="text-sm font-extrabold text-indigo-400 tabular-nums">{radius}m</span>
                </div>

                <input
                  id="radius-slider"
                  type="range"
                  min={10}
                  max={5000}
                  step={10}
                  value={radius}
                  disabled={selectedId ? !canEdit : !canAdd}
                  onChange={(e) => setRadius(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />

                {/* Radius Presets */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[50, 100, 200, 500].map((r) => (
                    <button
                      key={r}
                      id={`preset-radius-${r}`}
                      disabled={selectedId ? !canEdit : !canAdd}
                      onClick={() => setRadius(r)}
                      className={`py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer outline-none font-khmer disabled:opacity-40 disabled:cursor-not-allowed ${radius === r
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                          : 'bg-slate-950/60 text-slate-400 border-white/5 hover:text-white hover:border-white/20'
                        }`}
                    >
                      {r}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Distance check if my location is loaded */}
            {distanceFromGps !== null && (
              <div className={`rounded-2xl p-3 border text-center text-xs ${distanceFromGps <= radius
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                }`}>
                <span className="font-khmer font-semibold">
                  {distanceFromGps <= radius
                    ? (isKhmer ? '✅ ទីតាំងរបស់អ្នកស្ថិតក្នុងរង្វង់អនុញ្ញាត' : '✅ Your location is within radius')
                    : (isKhmer ? '❌ ទីតាំងរបស់អ្នកនៅក្រៅរង្វង់អនុញ្ញាត' : '❌ Your location is outside radius')}
                </span>
                <span className="block font-bold mt-0.5 tabular-nums text-sm">
                  {isKhmer ? 'ចម្ងាយ:' : 'Distance:'} {distanceFromGps < 1000 ? `${Math.round(distanceFromGps)}m` : `${(distanceFromGps / 1000).toFixed(2)}km`}
                </span>
              </div>
            )}

            {/* Save Action Button or Read-Only Banner */}
            {(selectedId ? canEdit : canAdd) ? (
              <button
                id="save-kiosk-settings-btn"
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 px-6 font-bold text-xs rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 transition-all cursor-pointer outline-none border-none disabled:opacity-50 disabled:cursor-not-allowed font-khmer flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    {isKhmer ? 'កំពុងរក្សាទុក...' : 'Saving...'}
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircleIcon className="h-4 w-4 text-emerald-300" />
                    {isKhmer ? 'បានរក្សាទុកដោយជោគជ័យ!' : 'Saved Successfully!'}
                  </>
                ) : (
                  selectedId
                    ? (isKhmer ? '💾 កែប្រែទីតាំង (Update Zone)' : '💾 Update Branch Zone')
                    : (isKhmer ? '💾 រក្សាទុកទីតាំង (Save Zone)' : '💾 Save Branch Zone')
                )}
              </button>
            ) : (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center text-xs text-amber-300 font-khmer flex items-center justify-center gap-2">
                <span>🔒</span>
                <span>
                  {selectedId
                    ? (isKhmer ? 'គណនីរបស់អ្នកមិនមានសិទ្ធិកែប្រែទីតាំងសាខាទេ (View-only)' : 'You do not have permission to edit branch geofences (View-only)')
                    : (isKhmer ? 'គណនីរបស់អ្នកមិនមានសិទ្ធិបង្កើតសាខាថ្មីទេ' : 'You do not have permission to create branch geofences')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Branch QR Modal */}
      {showQrModal && qrBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="glass-card max-w-md w-full p-6 border border-white/10 rounded-3xl space-y-6 shadow-2xl relative bg-slate-900">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer border-none bg-transparent outline-none"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-white font-khmer">
                {isKhmer ? 'QR Code សាខា' : 'Branch QR Code'}
              </h3>
              <p className="text-sm font-semibold text-indigo-400 font-khmer">{qrBranch.name}</p>
            </div>

            <div className="flex flex-col items-center justify-center p-6 bg-slate-950/40 border border-white/5 rounded-2xl relative min-h-[220px]">
              {qrLoading ? (
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-400" />
                  <span className="text-xs font-khmer">{isKhmer ? 'កំពុងបង្កើត QR Code...' : 'Generating QR Code...'}</span>
                </div>
              ) : branchQrImage ? (
                <>
                  <img src={branchQrImage} alt="Branch QR" className="w-72 h-72 rounded-xl border border-white/10 bg-white p-4 shadow-lg" />
                  <p className="text-[10px] text-slate-500 mt-4 select-all font-mono">
                    {`branch_qr:${qrBranch.id}`}
                  </p>
                </>
              ) : (
                <p className="text-xs text-rose-300 font-khmer">
                  {isKhmer ? 'កំហុសក្នុងការបង្កើត QR Code' : 'Error generating QR Code'}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSavePdf}
                disabled={!branchQrImage}
                className="flex-1 py-3 px-4 font-bold text-xs rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer outline-none border-none disabled:opacity-50 flex items-center justify-center gap-2 font-khmer shadow-lg shadow-blue-500/25"
                title="Save as PDF"
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                <span>{isKhmer ? 'រក្សាទុកជា PDF' : 'Save as PDF'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="py-3 px-6 font-bold text-xs rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer outline-none border border-white/5 font-khmer"
              >
                {isKhmer ? 'បិទ' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KioskSettings;
