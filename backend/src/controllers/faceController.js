import prisma from '../utils/db.js';
import { processAttendanceScan } from '../utils/attendanceHelper.js';

// Calculate Euclidean distance between two vectors
const getEuclideanDistance = (v1, v2) => {
  if (!v1 || !v2 || v1.length !== v2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < v1.length; i++) {
    sum += Math.pow(v1[i] - v2[i], 2);
  }
  return Math.sqrt(sum);
};

const getHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
};

// POST /api/face/enroll
export const enrollFace = async (req, res) => {
  const { staffId, faceDescriptor, photoUrl } = req.body;

  if (!staffId || !faceDescriptor) {
    return res.status(400).json({ message: 'Staff ID and face descriptor are required' });
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { staffId }
    });

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Check if employee already has face data, if so, delete it or add another template
    // The requirement says: "generate descriptor -> រក្សាទុកក្នុង employee_face_data"
    // We can delete previous templates and store the new template to keep it simple,
    // or allow multiple templates. Let's delete existing templates first to avoid duplicates.
    await prisma.employeeFaceData.deleteMany({
      where: { staffId }
    });

    const faceData = await prisma.employeeFaceData.create({
      data: {
        staffId,
        faceDescriptor, // Store Json (Float32Array converted to standard number array)
        photoUrl
      }
    });

    res.status(201).json({
      message: 'Face coordinates registered successfully',
      data: faceData
    });
  } catch (error) {
    console.error('Face enroll error:', error);
    res.status(500).json({ message: 'Server error enrolling face' });
  }
};

// POST /api/face/checkin
export const verifyAndCheckInFace = async (req, res) => {
  const { faceDescriptor, deviceInfo, location, latitude, longitude } = req.body;

  if (!faceDescriptor || !Array.isArray(faceDescriptor)) {
    return res.status(400).json({ message: 'Valid face descriptor array is required' });
  }

  try {
    // 1. Fetch all registered faces
    const enrolledFaces = await prisma.employeeFaceData.findMany({
      include: {
        employee: {
          select: {
            id: true,
            status: true
          }
        }
      }
    });

    let bestMatch = null;
    let minDistance = 1.0; // standard face recognition threshold is 0.6

    for (const record of enrolledFaces) {
      if (record.employee.status !== 'Active') continue; // Skip inactive employees

      const distance = getEuclideanDistance(faceDescriptor, record.faceDescriptor);
      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = record;
      }
    }

    // Recognition threshold check
    const RECOGNITION_THRESHOLD = 0.55; 
    if (!bestMatch || minDistance > RECOGNITION_THRESHOLD) {
      // Log failed check-in attempt
      await prisma.attendanceLog.create({
        data: {
          staffId: null,
          method: 'face',
          action: 'UNKNOWN',
          status: 'failed',
          deviceInfo: deviceInfo || 'Kiosk Camera',
          location: location || 'HQ Entrance'
        }
      });

      return res.status(400).json({
        success: false,
        message: 'Face not recognized',
        distance: minDistance
      });
    }

    const staffId = bestMatch.staffId;

    // Fetch employee detail to verify their branch assignment
    const employee = await prisma.employee.findUnique({
      where: { staffId }
    });

    if (!employee) {
      return res.status(400).json({ success: false, message: 'Employee not found' });
    }

    const settingsList = await prisma.kioskSetting.findMany();
    if (settingsList.length > 0) {
      if (
        latitude === undefined || 
        longitude === undefined || 
        latitude === null || 
        longitude === null || 
        isNaN(parseFloat(latitude)) || 
        isNaN(parseFloat(longitude))
      ) {
        return res.status(400).json({
          success: false,
          message: 'Location data (GPS) is required to check-in. សូមបើក Location (GPS) លើឧបករណ៍របស់អ្នក។'
        });
      }

      const clientLat = parseFloat(latitude);
      const clientLng = parseFloat(longitude);
      
      // Parse assigned branches (comma-separated string)
      const employeeBranches = employee.branch
        ? employee.branch.split(',').map(b => b.trim().toLowerCase())
        : [];

      // Filter geofence zones matching employee's branch assignment
      const allowedSettingsList = settingsList.filter(setting =>
        employeeBranches.includes(setting.name.toLowerCase())
      );

      if (allowedSettingsList.length === 0) {
        return res.status(403).json({
          success: false,
          message: `គណនីរបស់អ្នកមិនទាន់ត្រូវបានកំណត់ឱ្យចុះវត្តមាននៅសាខាណាមួយឡើយ! (Employee is not assigned to any active branch settings).`
        });
      }

      let isInsideAnyZone = false;
      let closestZone = null;
      let minDistance = Infinity;

      for (const settings of allowedSettingsList) {
        const distance = getHaversineDistance(
          clientLat, 
          clientLng, 
          settings.latitude, 
          settings.longitude
        );
        if (distance <= settings.radius) {
          isInsideAnyZone = true;
          break;
        }
        const delta = distance - settings.radius;
        if (delta < minDistance) {
          minDistance = delta;
          closestZone = {
            name: settings.name,
            distance: Math.round(distance),
            radius: settings.radius
          };
        }
      }

      if (!isInsideAnyZone) {
        return res.status(403).json({
          success: false,
          message: closestZone 
            ? `ក្រៅទីតាំងអនុញ្ញាត! (Out of allowed zone). Closest branch "${closestZone.name}" is ${closestZone.distance}m away (limit is ${closestZone.radius}m).`
            : `ក្រៅទីតាំងអនុញ្ញាត! (Out of allowed zone).`
        });
      }
    }

    // 2. Perform attendance scanning update
    const result = await processAttendanceScan({
      staffId,
      note: 'Auto scan: Face Recognition'
    });

    // 3. Create successful audit trail log
    await prisma.attendanceLog.create({
      data: {
        staffId,
        method: 'face',
        action: result.action,
        status: 'success',
        deviceInfo: deviceInfo || 'Kiosk Camera',
        location: location || 'HQ Entrance'
      }
    });

    res.json({
      success: true,
      message: `Recognized! Scanned: ${result.action}`,
      employee: {
        staffId: bestMatch.staffId,
        nameEn: result.attendance.employee.nameEn,
        nameKh: result.attendance.employee.nameKh,
        department: result.attendance.employee.department?.nameEn || result.attendance.employee.department?.nameKh || 'N/A'
      },
      action: result.action,
      timeString: result.timeString
    });
  } catch (error) {
    console.error('Face check-in error:', error);
    res.status(500).json({ message: 'Server error processing face check-in' });
  }
};
