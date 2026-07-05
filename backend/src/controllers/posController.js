import prisma from '../utils/db.js';

// Get all positions
export const getAll = async (req, res) => {
  try {
    const positions = await prisma.position.findMany({
      include: {
        department: {
          select: { nameEn: true, nameKh: true }
        },
        _count: {
          select: { employees: true }
        }
      },
      orderBy: { titleEn: 'asc' }
    });
    res.json(positions);
  } catch (error) {
    console.error('Get positions error:', error);
    res.status(500).json({ message: 'Server error retrieving positions' });
  }
};

// Get position by ID
export const getById = async (req, res) => {
  const { id } = req.params;
  try {
    const position = await prisma.position.findUnique({
      where: { id },
      include: {
        department: true,
        _count: {
          select: { employees: true }
        }
      }
    });

    if (!position) {
      return res.status(404).json({ message: 'Position not found' });
    }

    res.json(position);
  } catch (error) {
    console.error('Get position by ID error:', error);
    res.status(500).json({ message: 'Server error retrieving position' });
  }
};

// Create position
export const create = async (req, res) => {
  const { titleEn, titleKh, departmentId } = req.body;

  if (!titleEn || !titleKh || !departmentId) {
    return res.status(400).json({ message: 'English title, Khmer title, and Department ID are required' });
  }

  try {
    const position = await prisma.position.create({
      data: { titleEn, titleKh, departmentId }
    });
    res.status(201).json(position);
  } catch (error) {
    console.error('Create position error:', error);
    res.status(500).json({ message: 'Server error creating position' });
  }
};

// Update position
export const update = async (req, res) => {
  const { id } = req.params;
  const { titleEn, titleKh, departmentId } = req.body;

  try {
    const position = await prisma.position.update({
      where: { id },
      data: { titleEn, titleKh, departmentId }
    });
    res.json(position);
  } catch (error) {
    console.error('Update position error:', error);
    res.status(500).json({ message: 'Server error updating position' });
  }
};

// Delete position
export const remove = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.position.delete({
      where: { id }
    });
    res.json({ message: 'Position deleted successfully' });
  } catch (error) {
    console.error('Delete position error:', error);
    res.status(500).json({ message: 'Server error deleting position' });
  }
};
