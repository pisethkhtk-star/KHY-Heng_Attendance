import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../utils/api';
import { MapPinIcon, CheckCircleIcon, ArrowPathIcon, TrashIcon, PlusIcon, XMarkIcon, QrCodeIcon } from '@heroicons/react/24/outline';

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

  // Handle Map clicks to move/set active coordinates
  const handleMapClick = useCallback((lat, lng) => {
    setMarkerPos([lat, lng]);
  }, []);

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
            <h1 className="text-xl font-bold text-white font-khmer">Branch Settings</h1>
            <p className="text-xs text-slate-400 mt-0.5 font-khmer">
              គ្រប់គ្រងទីតាំង Geofences និងកម្រិតកាំ (Radius) សម្រាប់គណនាវត្តមានតាមសាខាផ្សេងៗ។
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
          {gpsLoading ? 'Getting GPS...' : '📍 Use My Location'}
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
                <span>ចុចលើផែនទី ឬអូស Marker ដើម្បីកំណត់ទីតាំង</span>
              </div>
              <span className="text-[10px] text-slate-500">Active Map View</span>
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
                    <React.Fragment key={s.id}>
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
                  draggable
                  eventHandlers={{
                    dragend: (e) => {
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
              <h3 className="text-sm font-bold text-white font-khmer">សាខាដែលបានកំណត់ ({settingsList.length})</h3>

              {selectedId && (
                <button
                  onClick={resetForm}
                  className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 font-khmer cursor-pointer border-none bg-transparent outline-none"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  Add New
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
                        title="View Branch QR Code"
                      >
                        <QrCodeIcon className="h-4 w-4" />
                      </button>

                      <button
                        onClick={(e) => handleDelete(s.id, e)}
                        disabled={deletingId === s.id}
                        className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                        title="Delete geofence"
                      >
                        {deletingId === s.id ? (
                          <ArrowPathIcon className="h-4 w-4 animate-spin" />
                        ) : (
                          <TrashIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Edit/Create Form Card */}
          <div className="glass-card rounded-3xl p-5 border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold text-white font-khmer">
                {selectedId ? '📝 កែប្រែ Geofence ទីតាំង' : '➕ បន្ថែម Geofence ថ្មី'}
              </h3>
              {selectedId && (
                <button
                  onClick={resetForm}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer border-none bg-transparent outline-none"
                  title="Switch to Add Mode"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1 font-khmer">
                  ឈ្មោះទីតាំង / ឈ្មោះសាខា (Location Name)
                </label>
                <input
                  id="geofence-name"
                  type="text"
                  placeholder="e.g. Phnom Penh HQ"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full py-2.5 px-4 bg-slate-950/60 border border-white/10 text-white rounded-xl text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all font-khmer font-medium"
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
                    onChange={(e) => setMarkerPos([parseFloat(e.target.value) || 0, markerPos[1]])}
                    className="w-full py-2.5 px-4 bg-slate-950/60 border border-white/10 text-white rounded-xl text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all tabular-nums"
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
                    onChange={(e) => setMarkerPos([markerPos[0], parseFloat(e.target.value) || 0])}
                    className="w-full py-2.5 px-4 bg-slate-950/60 border border-white/10 text-white rounded-xl text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all tabular-nums"
                  />
                </div>
              </div>

              {/* Radius Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase font-khmer">
                    កាំដែលអនុញ្ញាត (Allowed Radius)
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
                  onChange={(e) => setRadius(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />

                {/* Radius Presets */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[50, 100, 200, 500].map((r) => (
                    <button
                      key={r}
                      id={`preset-radius-${r}`}
                      onClick={() => setRadius(r)}
                      className={`py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer outline-none font-khmer ${radius === r
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
                  {distanceFromGps <= radius ? '✅ Your location is within radius' : '❌ Your location is outside radius'}
                </span>
                <span className="block font-bold mt-0.5 tabular-nums text-sm">
                  Distance: {distanceFromGps < 1000 ? `${Math.round(distanceFromGps)}m` : `${(distanceFromGps / 1000).toFixed(2)}km`}
                </span>
              </div>
            )}

            {/* Save Action Button */}
            <button
              id="save-kiosk-settings-btn"
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 px-6 font-bold text-xs rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 transition-all cursor-pointer outline-none border-none disabled:opacity-50 disabled:cursor-not-allowed font-khmer flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircleIcon className="h-4 w-4 text-emerald-300" />
                  Saved Successfully!
                </>
              ) : (
                '💾 រក្សាទុកទីតាំង (Save Zone)'
              )}
            </button>
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
              <h3 className="text-lg font-bold text-white font-khmer">QR Code សាខា / Branch QR Code</h3>
              <p className="text-sm font-semibold text-indigo-400 font-khmer">{qrBranch.name}</p>
            </div>

            <div className="flex flex-col items-center justify-center p-6 bg-slate-950/40 border border-white/5 rounded-2xl relative min-h-[220px]">
              {qrLoading ? (
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-400" />
                  <span className="text-xs font-khmer">Generating QR Code...</span>
                </div>
              ) : branchQrImage ? (
                <>
                  <img src={branchQrImage} alt="Branch QR" className="w-48 h-48 rounded-xl border border-white/10 bg-white p-2" />
                  <p className="text-[10px] text-slate-500 mt-4 select-all font-mono">
                    {`branch_qr:${qrBranch.id}`}
                  </p>
                </>
              ) : (
                <p className="text-xs text-rose-300 font-khmer">កំហុសក្នុងការបង្កើត QR Code / Error generating QR Code</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  const printWindow = window.open('', '_blank');
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Print QR Code - ${qrBranch.name}</title>
                        <style>
                          body {
                            font-family: 'Inter', sans-serif;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            height: 90vh;
                            margin: 0;
                            text-align: center;
                          }
                          .container {
                            border: 3px solid #6366f1;
                            border-radius: 24px;
                            padding: 40px;
                            background: #fff;
                          }
                          h1 { margin: 0 0 10px 0; color: #1e1b4b; font-size: 28px; }
                          h2 { margin: 0 0 20px 0; color: #4f46e5; font-size: 20px; }
                          img { width: 300px; height: 300px; }
                          p { margin-top: 20px; color: #64748b; font-size: 14px; }
                        </style>
                      </head>
                      <body>
                        <div class="container">
                          <h1>${qrBranch.name}</h1>
                          <h2>ស្កេនដើម្បីចុះវត្តមាន / Scan to Check-in</h2>
                          <img src="${branchQrImage}" />
                          <p>ប្រព័ន្ធគ្រប់គ្រងវត្តមានបុគ្គលិក Kiosk Attendance</p>
                        </div>
                        <script>
                          window.onload = function() {
                            window.print();
                            window.onafterprint = function() { window.close(); };
                          }
                        </script>
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                }}
                disabled={!branchQrImage}
                className="flex-1 py-3 px-4 font-bold text-xs rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer outline-none border-none disabled:opacity-50 flex items-center justify-center gap-2 font-khmer shadow-lg shadow-indigo-500/25"
              >
                🖨️ បោះពុម្ព QR (Print QR)
              </button>
              <button
                onClick={() => setShowQrModal(false)}
                className="py-3 px-5 font-bold text-xs rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer outline-none border border-white/5 font-khmer"
              >
                បិទ (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KioskSettings;
