import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { MapPinIcon, CheckCircleIcon, ArrowPathIcon, TrashIcon, PlusIcon, XMarkIcon, QrCodeIcon, DocumentArrowDownIcon, PrinterIcon } from '@heroicons/react/24/outline';
import appIcon from '../assets/app_icon.png';

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
  const [downloadingPdf, setDownloadingPdf] = useState(false);

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

  // Helper to draw rounded rectangle with canvas fallback
  const drawRoundedRect = (ctx, x, y, w, h, r) => {
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  };

  // High-resolution canvas rendering matching the card design template (Template 2)
  const generateCardCanvas = async (branch, qrDataUrl, appIconSrc) => {
    const canvas = document.createElement('canvas');
    const width = 1200;
    const height = 1700;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Fill page background (white)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 2. Outer Card Frame
    const cardX = 80;
    const cardY = 80;
    const cardW = 1040;
    const cardH = 1540;
    const cardRadius = 70;

    ctx.save();
    ctx.beginPath();
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#0284c7';
    ctx.stroke();
    ctx.restore();

    // 3. Inner Card Frame
    const innerInset = 22;
    const innerX = cardX + innerInset;
    const innerY = cardY + innerInset;
    const innerW = cardW - innerInset * 2;
    const innerH = cardH - innerInset * 2;
    const innerRadius = 52;

    ctx.save();
    ctx.beginPath();
    drawRoundedRect(ctx, innerX, innerY, innerW, innerH, innerRadius);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#0284c7';
    ctx.stroke();
    ctx.restore();

    // 4. Clip inner area for background waves
    ctx.save();
    ctx.beginPath();
    drawRoundedRect(ctx, innerX + 2, innerY + 2, innerW - 4, innerH - 4, innerRadius - 2);
    ctx.clip();

    const ix = innerX;
    const iy = innerY;
    const iw = innerW;
    const ih = innerH;

    // Wave 1: Right Lime-Green Wave
    const gradLime = ctx.createLinearGradient(ix + iw * 0.4, iy + ih * 0.4, ix + iw, iy + ih * 0.9);
    gradLime.addColorStop(0, '#84cc16');
    gradLime.addColorStop(0.4, '#22c55e');
    gradLime.addColorStop(1, '#10b981');
    ctx.fillStyle = gradLime;
    ctx.beginPath();
    ctx.moveTo(ix + iw, iy + ih * 0.35);
    ctx.bezierCurveTo(
      ix + iw * 0.85, iy + ih * 0.37,
      ix + iw * 0.65, iy + ih * 0.46,
      ix + iw * 0.60, iy + ih * 0.58
    );
    ctx.bezierCurveTo(
      ix + iw * 0.52, iy + ih * 0.72,
      ix + iw * 0.35, iy + ih * 0.82,
      ix, iy + ih * 0.84
    );
    ctx.lineTo(ix, iy + ih);
    ctx.lineTo(ix + iw, iy + ih);
    ctx.closePath();
    ctx.fill();

    // Wave 2: Left Cyan Accent
    const gradCyanAccent = ctx.createLinearGradient(ix, iy + ih * 0.38, ix + iw * 0.25, iy + ih * 0.65);
    gradCyanAccent.addColorStop(0, '#38bdf8');
    gradCyanAccent.addColorStop(1, '#0284c7');
    ctx.fillStyle = gradCyanAccent;
    ctx.beginPath();
    ctx.moveTo(ix, iy + ih * 0.38);
    ctx.bezierCurveTo(
      ix + iw * 0.15, iy + ih * 0.40,
      ix + iw * 0.20, iy + ih * 0.47,
      ix + iw * 0.18, iy + ih * 0.56
    );
    ctx.bezierCurveTo(
      ix + iw * 0.15, iy + ih * 0.65,
      ix + iw * 0.05, iy + ih * 0.72,
      ix, iy + ih * 0.75
    );
    ctx.closePath();
    ctx.fill();

    // Wave 3: Left Lime Accent Swoop
    ctx.fillStyle = 'rgba(132, 204, 22, 0.9)';
    ctx.beginPath();
    ctx.moveTo(ix, iy + ih * 0.46);
    ctx.bezierCurveTo(
      ix + iw * 0.16, iy + ih * 0.49,
      ix + iw * 0.22, iy + ih * 0.58,
      ix + iw * 0.18, iy + ih * 0.68
    );
    ctx.bezierCurveTo(
      ix + iw * 0.14, iy + ih * 0.76,
      ix + iw * 0.05, iy + ih * 0.82,
      ix, iy + ih * 0.85
    );
    ctx.closePath();
    ctx.fill();

    // Wave 4: Middle Flowing Cyan Wave
    const gradCyan = ctx.createLinearGradient(ix, iy + ih * 0.5, ix + iw, iy + ih);
    gradCyan.addColorStop(0, '#38bdf8');
    gradCyan.addColorStop(0.5, '#06b6d4');
    gradCyan.addColorStop(1, '#0284c7');
    ctx.fillStyle = gradCyan;
    ctx.beginPath();
    ctx.moveTo(ix + iw, iy + ih * 0.49);
    ctx.bezierCurveTo(
      ix + iw * 0.84, iy + ih * 0.52,
      ix + iw * 0.70, iy + ih * 0.63,
      ix + iw * 0.62, iy + ih * 0.73
    );
    ctx.bezierCurveTo(
      ix + iw * 0.48, iy + ih * 0.88,
      ix + iw * 0.30, iy + ih * 0.92,
      ix, iy + ih * 0.93
    );
    ctx.lineTo(ix, iy + ih);
    ctx.lineTo(ix + iw, iy + ih);
    ctx.closePath();
    ctx.fill();

    // Wave 5: Deep Blue Ocean Base Wave
    const gradBlue = ctx.createLinearGradient(ix, iy + ih * 0.65, ix + iw, iy + ih);
    gradBlue.addColorStop(0, '#0284c7');
    gradBlue.addColorStop(0.5, '#2563eb');
    gradBlue.addColorStop(1, '#1d4ed8');
    ctx.fillStyle = gradBlue;
    ctx.beginPath();
    ctx.moveTo(ix + iw, iy + ih * 0.64);
    ctx.bezierCurveTo(
      ix + iw * 0.84, iy + ih * 0.67,
      ix + iw * 0.70, iy + ih * 0.78,
      ix + iw * 0.55, iy + ih * 0.87
    );
    ctx.bezierCurveTo(
      ix + iw * 0.40, iy + ih * 0.95,
      ix + iw * 0.20, iy + ih * 0.98,
      ix, iy + ih * 0.985
    );
    ctx.lineTo(ix, iy + ih);
    ctx.lineTo(ix + iw, iy + ih);
    ctx.closePath();
    ctx.fill();

    // Wave 6: Bottom Darker Blue Curve
    const gradDarkBlue = ctx.createLinearGradient(ix, iy + ih * 0.8, ix + iw, iy + ih);
    gradDarkBlue.addColorStop(0, '#1d4ed8');
    gradDarkBlue.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = gradDarkBlue;
    ctx.beginPath();
    ctx.moveTo(ix + iw, iy + ih * 0.78);
    ctx.bezierCurveTo(
      ix + iw * 0.82, iy + ih * 0.81,
      ix + iw * 0.65, iy + ih * 0.90,
      ix + iw * 0.45, iy + ih * 0.95
    );
    ctx.bezierCurveTo(
      ix + iw * 0.28, iy + ih * 0.985,
      ix + iw * 0.12, iy + ih * 0.995,
      ix, iy + ih
    );
    ctx.lineTo(ix + iw, iy + ih);
    ctx.closePath();
    ctx.fill();

    ctx.restore(); // end clip

    // 5. Draw App Logo Badge (matching Image 2: large squircle overlapping top border)
    const logoSize = 214;
    const logoX = width / 2 - logoSize / 2;
    const logoY = cardY - 58; // Sits centered across top outer border (~28% above)

    if (appIconSrc) {
      const logoImg = await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = appIconSrc;
      });

      if (logoImg) {
        // Soft drop shadow for icon
        ctx.save();
        ctx.shadowColor = 'rgba(2, 132, 199, 0.35)';
        ctx.shadowBlur = 28;
        ctx.shadowOffsetY = 12;

        // Clip to squircle with smooth iOS-style corner radius
        ctx.beginPath();
        drawRoundedRect(ctx, logoX, logoY, logoSize, logoSize, 48);
        ctx.clip();
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
        ctx.restore();
      }
    }

    // 6. Pill Tag: BRANCH LOCATION QR CODE
    const pillY = logoY + logoSize + 22;
    const pillW = 390;
    const pillH = 46;
    const pillX = width / 2 - pillW / 2;

    ctx.save();
    ctx.beginPath();
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 23);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(2, 132, 199, 0.6)';
    ctx.stroke();

    ctx.font = 'bold 18px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0369a1';
    ctx.fillText('BRANCH LOCATION QR CODE', width / 2, pillY + pillH / 2);
    ctx.restore();

    // 7. Branch Name (Title)
    const titleY = pillY + pillH + 48;
    ctx.save();
    ctx.font = 'bold 50px "Kantumruy Pro", "Battambang", "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(branch.name || 'Branch Location', width / 2, titleY);

    // 8. Subtitle
    const subY = titleY + 44;
    ctx.font = '600 28px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#10b981';
    ctx.fillText('Scan to Check-in Attendance', width / 2, subY);
    ctx.restore();

    // 9. Middle White QR Container Card
    const qrCardSize = 640;
    const qrCardX = width / 2 - qrCardSize / 2;
    const qrCardY = subY + 46;

    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 14;
    ctx.beginPath();
    drawRoundedRect(ctx, qrCardX, qrCardY, qrCardSize, qrCardSize, 52);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // 10. Draw QR Code Image inside the card
    if (qrDataUrl) {
      const qrImg = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = qrDataUrl;
      });

      if (qrImg) {
        const qrInnerPadding = 52;
        const qrInnerSize = qrCardSize - qrInnerPadding * 2;
        ctx.drawImage(
          qrImg,
          qrCardX + qrInnerPadding,
          qrCardY + qrInnerPadding,
          qrInnerSize,
          qrInnerSize
        );
      }
    }

    // 11. Instruction Texts Below QR
    const inst1Y = qrCardY + qrCardSize + 60;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 26px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText('Please scan this QR code with your mobile app to check in', width / 2, inst1Y);

    const inst2Y = inst1Y + 34;
    ctx.font = '500 20px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Employee Attendance Management System', width / 2, inst2Y);
    // 12. Monospace Code Tag Pill
    // const codePillY = inst2Y + 36;
    // const codePillW = 340;
    // const codePillH = 48;
    // const codePillX = width / 2 - codePillW / 2;
    // ctx.beginPath();
    // drawRoundedRect(ctx, codePillX, codePillY, codePillW, codePillH, 24);
    // ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    // ctx.fill();
    // ctx.lineWidth = 1.5;
    // ctx.strokeStyle = '#cbd5e1';
    // ctx.stroke();
    // ctx.font = 'bold 22px "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace';
    // ctx.fillStyle = '#334155';
    //ctx.fillText(`branch_qr:${branch.id}`, width / 2, codePillY + codePillH / 2);
    // ctx.fillText(`branch qr:${branch.name}`, width / 2, codePillY + codePillH / 2);
    ctx.restore();

    return canvas;
  };

  const loadJsPdf = async () => {
    try {
      const module = await import('jspdf');
      const Cls = module.jsPDF || module.default?.jsPDF || module.default;
      if (Cls) return Cls;
    } catch {
      // fallback to dynamic script
    }

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
      setDownloadingPdf(true);
      const JsPdfClass = await loadJsPdf();
      if (!JsPdfClass) {
        throw new Error('jsPDF is not loaded yet.');
      }

      const canvas = await generateCardCanvas(qrBranch, branchQrImage, appIcon);
      if (!canvas) {
        throw new Error('Failed to render card canvas');
      }

      const imgData = canvas.toDataURL('image/png', 1.0);

      const doc = new JsPdfClass({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
      const pageHeight = doc.internal.pageSize.getHeight(); // 297mm

      const cardWidth = 180;
      const cardHeight = cardWidth * (1700 / 1200); // 255mm
      const x = (pageWidth - cardWidth) / 2; // 15mm
      const y = (pageHeight - cardHeight) / 2; // 21mm

      doc.addImage(imgData, 'PNG', x, y, cardWidth, cardHeight, undefined, 'FAST');

      const safeName = (qrBranch.name || 'Branch').replace(/[^a-zA-Z0-9_-]/g, '_');
      doc.save(`Branch_QR_${safeName}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert(isKhmer ? 'កំហុសក្នុងការទាញយក PDF' : 'Error generating PDF file.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrint = async () => {
    if (!branchQrImage || !qrBranch) return;

    try {
      setDownloadingPdf(true);
      const canvas = await generateCardCanvas(qrBranch, branchQrImage, appIcon);
      if (!canvas) return;

      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert(isKhmer ? 'សូមអនុញ្ញាត Popup ដើម្បី Print' : 'Please allow popups to print');
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Print QR - ${qrBranch.name || 'Branch'}</title>
            <style>
              @page {
                size: A4 portrait;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                background-color: #ffffff;
              }
              img {
                max-width: 90vw;
                max-height: 94vh;
                object-fit: contain;
              }
            </style>
          </head>
          <body>
            <img src="${dataUrl}" onload="window.print(); window.close();" />
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err) {
      console.error('Error printing QR:', err);
    } finally {
      setDownloadingPdf(false);
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <span className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="font-khmer text-sm">Loading Bracnch Settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* flex flex-col sm:flex-row justify-between items-start sm:items-center glass-card p-6 rounded-2xl glow-indigo gap-4 */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <MapPinIcon className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-khmer">
              {isKhmer ? 'ការកំណត់ទីតាំងសាខា (Branch Settings)' : 'Branch & Geofence Settings'}
            </h1>
            {/* <p className="text-xs text-slate-400 mt-0.5 font-khmer">
              {isKhmer
                ? 'គ្រប់គ្រងទីតាំង Geofences និងកម្រិតកាំ (Radius) សម្រាប់គណនាវត្តមានតាមសាខាផ្សេងៗ។'
                : 'Manage branch geofence coordinates and allowed radius for attendance check-ins.'}
            </p> */}
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
                  placeholder={isKhmer ? "ឧ. ការិយាល័យកណ្តាល (Phnom Penh HQ)" : "Ex. Phnom Penh "}
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

      {/* Branch QR Modal - Template 2 Redesign */}
      {showQrModal && qrBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn">
          <div className="relative my-auto flex flex-col items-center max-w-lg w-full pt-10">
            {/* Close Button Top-Right of Modal Container */}
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-0 right-0 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-all cursor-pointer border-none bg-transparent outline-none"
              title={isKhmer ? 'បិទ' : 'Close'}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>

            {/* Poster / Standee Card matching Template 2 */}
            <div className="relative w-full max-w-[420px] rounded-[36px] bg-white p-2.5 shadow-2xl border-[3.5px] border-[#0284c7]">

              {/* Inner Card Frame */}
              <div className="relative rounded-[26px] border-[1.5px] border-[#0284c7] bg-white overflow-hidden pt-12 sm:pt-14 pb-7 px-5 flex flex-col items-center">

                {/* Flowing Wave SVG Background */}
                <svg viewBox="0 0 440 620" className="absolute inset-0 w-full h-full pointer-events-none select-none" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="gradLime" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#84cc16" />
                      <stop offset="40%" stopColor="#22c55e" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>

                    <linearGradient id="gradCyan" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="50%" stopColor="#06b6d4" />
                      <stop offset="100%" stopColor="#0284c7" />
                    </linearGradient>

                    <linearGradient id="gradBlue" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0284c7" />
                      <stop offset="60%" stopColor="#2563eb" />
                      <stop offset="100%" stopColor="#1d4ed8" />
                    </linearGradient>
                  </defs>

                  {/* Right Side Lime Ribbon */}
                  <path d="M 440,210 C 370,225 310,270 280,340 C 240,430 160,490 0,510 L 0,620 L 440,620 Z" fill="url(#gradLime)" />

                  {/* Left Side Cyan Accent */}
                  <path d="M 0,230 C 50,240 80,270 70,320 C 60,370 20,410 0,430 Z" fill="url(#gradCyan)" />

                  {/* Left Side Lime Accent */}
                  <path d="M 0,270 C 60,285 90,340 75,395 C 60,440 20,475 0,495 Z" fill="url(#gradLime)" opacity="0.9" />

                  {/* Middle Cyan Wave */}
                  <path d="M 440,300 C 370,315 310,380 270,440 C 210,530 130,560 0,565 L 0,620 L 440,620 Z" fill="url(#gradCyan)" />

                  {/* Bottom Deep Blue Layer */}
                  <path d="M 440,380 C 370,400 310,470 240,530 C 170,590 80,600 0,605 L 0,620 L 440,620 Z" fill="url(#gradBlue)" />

                  {/* Bottom Dark Ocean Wave */}
                  <path d="M 440,470 C 360,490 290,545 200,580 C 120,610 50,615 0,618 L 0,620 L 440,620 Z" fill="#1e40af" opacity="0.85" />
                </svg>

                {/* Pill Tag: BRANCH LOCATION QR CODE */}
                <div className="relative z-10 mt-1 inline-flex items-center justify-center px-4 sm:px-5 py-1 rounded-full border border-sky-600/40 bg-white/95 text-[10px] sm:text-[10.5px] font-bold text-sky-900 tracking-[0.16em] uppercase shadow-xs">
                  BRANCH LOCATION QR CODE
                </div>

                {/* Title: Branch Name */}
                <h2 className="relative z-10 mt-2.5 text-2xl sm:text-[26px] font-extrabold text-[#0f172a] tracking-tight text-center font-khmer">
                  {qrBranch.name || 'Branch Location'}
                </h2>

                {/* Subtitle */}
                <p className="relative z-10 mt-0.5 text-[14px] sm:text-[15px] font-semibold text-[#10b981] text-center">
                  Scan to Check-in Attendance
                </p>

                {/* Center White QR Card with Drop Shadow */}
                <div className="relative z-10 mt-4 w-60 h-60 sm:w-68 sm:h-68 bg-white rounded-3xl p-4 sm:p-5 shadow-[0_12px_32px_rgba(15,23,42,0.12)] border border-slate-100/90 flex items-center justify-center">
                  {qrLoading ? (
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <ArrowPathIcon className="h-8 w-8 animate-spin text-sky-500" />
                      <span className="text-xs font-khmer text-slate-500">
                        {isKhmer ? 'កំពុងបង្កើត QR Code...' : 'Generating QR Code...'}
                      </span>
                    </div>
                  ) : branchQrImage ? (
                    <img
                      src={branchQrImage}
                      alt="Branch QR"
                      className="w-full h-full object-contain select-none"
                    />
                  ) : (
                    <p className="text-xs text-rose-500 font-khmer text-center">
                      {isKhmer ? 'កំហុសក្នុងការបង្កើត QR Code' : 'Error generating QR Code'}
                    </p>
                  )}
                </div>

                {/* Instruction Texts */}
                <p className="relative z-10 mt-5 text-[12px] sm:text-[12.5px] font-bold text-[#1e293b] text-center px-3 leading-tight">
                  Please scan this QR code with your mobile app to check in
                </p>
                <p className="relative z-10 mt-1 text-[10px] sm:text-[10.5px] font-medium font-bold  text-slate-500 text-center">
                  Employee Attendance Management System
                </p>
                {/* <p className="relative z-10 mt-1 inline-block text-[10px] sm:text-[10.5px] font-bold text-slate-500 text-center border border-slate-200 rounded-full px-2.5 py-0.5 bg-slate-50">
                  Employee Attendance Management System
                </p> */}

                {/* Monospace Code Tag Pill */}
                {/* <div className="relative z-10 mt-3 inline-flex items-center justify-center px-6 py-1.5 rounded-full bg-white/95 border border-slate-200/90 shadow-xs">
                  <span className="font-mono text-[11px] sm:text-xs font-semibold text-slate-700 tracking-wider">
                    {`branch_qr:${qrBranch.id}`}
                  </span>
                </div> */}
              </div>

              {/* Top Center App Icon Badge (sitting on top border, matching Image 2) */}
              <div className="absolute -top-7 sm:-top-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none select-none">
                <div className="w-20 h-20 sm:w-[86px] sm:h-[86px] rounded-[22px] overflow-hidden shadow-[0_10px_25px_rgba(2,132,199,0.35)] flex items-center justify-center">
                  <img src={appIcon} alt="HR Chomnan" className="w-full h-full object-contain" />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-4 flex flex-wrap gap-2.5 w-full max-w-[420px]">
              <button
                type="button"
                onClick={handleSavePdf}
                disabled={!branchQrImage || qrLoading || downloadingPdf}
                className="flex-1 py-2.5 px-4 font-bold text-xs rounded-xl bg-sky-600 hover:bg-sky-500 text-white transition-all cursor-pointer outline-none border-none disabled:opacity-50 flex items-center justify-center gap-2 font-khmer shadow-lg shadow-sky-600/30"
              >
                {downloadingPdf ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <DocumentArrowDownIcon className="h-4 w-4" />
                )}
                <span>{downloadingPdf ? (isKhmer ? 'កំពុងដំណើរការ...' : 'Generating...') : (isKhmer ? 'រក្សាទុកជា PDF' : 'Save as PDF')}</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                disabled={!branchQrImage || qrLoading || downloadingPdf}
                className="py-2.5 px-4 font-bold text-xs rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all cursor-pointer outline-none border border-white/10 flex items-center justify-center gap-2 font-khmer"
                title={isKhmer ? 'បោះពុម្ព (Print)' : 'Print'}
              >
                <PrinterIcon className="h-4 w-4" />
                <span>{isKhmer ? 'បោះពុម្ព' : 'Print'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="py-2.5 px-5 font-bold text-xs rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer outline-none border border-white/10 font-khmer"
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
