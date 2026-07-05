import prisma from '../utils/db.js';

// GET /api/kiosk-settings
export const getKioskSettings = async (req, res) => {
  try {
    let settingsList = await prisma.kioskSetting.findMany({
      orderBy: { updatedAt: 'desc' }
    });
    
    if (settingsList.length === 0) {
      // Fallback fallback if table is empty
      const defaultSetting = await prisma.kioskSetting.create({
        data: {
          name: "Phnom Penh HQ",
          latitude: 11.5564,
          longitude: 104.9282,
          radius: 100.0
        }
      });
      settingsList = [defaultSetting];
    }
    
    res.json(settingsList);
  } catch (error) {
    console.error('Error fetching kiosk settings:', error);
    res.status(500).json({ message: 'Server error loading geofence settings' });
  }
};

// POST /api/kiosk-settings
export const createKioskSetting = async (req, res) => {
  const { name, latitude, longitude, radius } = req.body;

  if (!name || latitude === undefined || longitude === undefined || radius === undefined) {
    return res.status(400).json({ message: 'Name, latitude, longitude, and radius are required' });
  }

  try {
    const newSetting = await prisma.kioskSetting.create({
      data: {
        name: name.trim(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius: parseFloat(radius)
      }
    });

    res.status(201).json({ message: 'Geofence zone created successfully', data: newSetting });
  } catch (error) {
    console.error('Error creating kiosk setting:', error);
    res.status(500).json({ message: 'Server error creating geofence setting' });
  }
};

// PUT /api/kiosk-settings/:id
export const updateKioskSetting = async (req, res) => {
  const { id } = req.params;
  const { name, latitude, longitude, radius } = req.body;

  if (!name || latitude === undefined || longitude === undefined || radius === undefined) {
    return res.status(400).json({ message: 'Name, latitude, longitude, and radius are required' });
  }

  try {
    const updatedSetting = await prisma.kioskSetting.update({
      where: { id },
      data: {
        name: name.trim(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius: parseFloat(radius)
      }
    });

    res.json({ message: 'Geofence zone updated successfully', data: updatedSetting });
  } catch (error) {
    console.error('Error updating kiosk setting:', error);
    res.status(500).json({ message: 'Server error updating geofence setting' });
  }
};

// DELETE /api/kiosk-settings/:id
export const deleteKioskSetting = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.kioskSetting.delete({
      where: { id }
    });

    res.json({ message: 'Geofence zone deleted successfully' });
  } catch (error) {
    console.error('Error deleting kiosk setting:', error);
    res.status(500).json({ message: 'Server error deleting geofence setting' });
  }
};
