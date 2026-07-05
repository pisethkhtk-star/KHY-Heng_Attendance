import prisma from '../utils/db.js';

// GET /api/leave-types
export const getLeaveTypes = async (req, res) => {
  try {
    const leaveTypes = await prisma.leaveType.findMany({
      orderBy: { code: 'asc' }
    });
    res.json(leaveTypes);
  } catch (error) {
    console.error('Error fetching leave types:', error);
    res.status(500).json({ message: 'Server error loading leave types' });
  }
};

// POST /api/leave-types
export const createLeaveType = async (req, res) => {
  const { nameEn, nameKh, code, maxDays, description } = req.body;

  if (!nameEn || !nameKh || !code) {
    return res.status(400).json({ message: 'nameEn, nameKh, and code are required' });
  }

  const cleanCode = code.trim().toUpperCase();

  try {
    // Check if code is unique
    const existing = await prisma.leaveType.findUnique({
      where: { code: cleanCode }
    });
    if (existing) {
      return res.status(400).json({ message: `Leave type code '${cleanCode}' is already in use` });
    }

    const leaveType = await prisma.leaveType.create({
      data: {
        nameEn: nameEn.trim(),
        nameKh: nameKh.trim(),
        code: cleanCode,
        maxDays: maxDays !== undefined ? parseFloat(maxDays) : 18.0,
        description: description ? description.trim() : null
      }
    });

    res.status(201).json({ message: 'Leave type created successfully', data: leaveType });
  } catch (error) {
    console.error('Error creating leave type:', error);
    res.status(500).json({ message: 'Server error creating leave type' });
  }
};

// PUT /api/leave-types/:id
export const updateLeaveType = async (req, res) => {
  const { id } = req.params;
  const { nameEn, nameKh, code, maxDays, description } = req.body;

  if (!nameEn || !nameKh || !code) {
    return res.status(400).json({ message: 'nameEn, nameKh, and code are required' });
  }

  const cleanCode = code.trim().toUpperCase();

  try {
    // Check code uniqueness for other records
    const existing = await prisma.leaveType.findFirst({
      where: {
        code: cleanCode,
        NOT: { id }
      }
    });
    if (existing) {
      return res.status(400).json({ message: `Leave type code '${cleanCode}' is already in use` });
    }

    const updated = await prisma.leaveType.update({
      where: { id },
      data: {
        nameEn: nameEn.trim(),
        nameKh: nameKh.trim(),
        code: cleanCode,
        maxDays: maxDays !== undefined ? parseFloat(maxDays) : 18.0,
        description: description ? description.trim() : null
      }
    });

    res.json({ message: 'Leave type updated successfully', data: updated });
  } catch (error) {
    console.error('Error updating leave type:', error);
    res.status(500).json({ message: 'Server error updating leave type' });
  }
};

// DELETE /api/leave-types/:id
export const deleteLeaveType = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.leaveType.delete({
      where: { id }
    });

    res.json({ message: 'Leave type deleted successfully' });
  } catch (error) {
    console.error('Error deleting leave type:', error);
    res.status(500).json({ message: 'Server error deleting leave type' });
  }
};
