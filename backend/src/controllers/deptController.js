import prisma from '../utils/db.js';

// Get all departments
export const getAll = async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: { employees: true }
        }
      },
      orderBy: { nameEn: 'asc' }
    });
    res.json(departments);
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ message: 'Server error retrieving departments' });
  }
};

// Get department by ID
export const getById = async (req, res) => {
  const { id } = req.params;
  try {
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        positions: true,
        _count: {
          select: { employees: true }
        }
      }
    });

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    res.json(department);
  } catch (error) {
    console.error('Get department by ID error:', error);
    res.status(500).json({ message: 'Server error retrieving department' });
  }
};

// Create department
export const create = async (req, res) => {
  const { nameEn, nameKh, description } = req.body;

  if (!nameEn || !nameKh) {
    return res.status(400).json({ message: 'English and Khmer names are required' });
  }

  try {
    const department = await prisma.department.create({
      data: { nameEn, nameKh, description }
    });
    res.status(201).json(department);
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ message: 'Server error creating department' });
  }
};

// Update department
export const update = async (req, res) => {
  const { id } = req.params;
  const { nameEn, nameKh, description } = req.body;

  try {
    const department = await prisma.department.update({
      where: { id },
      data: { nameEn, nameKh, description }
    });
    res.json(department);
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ message: 'Server error updating department' });
  }
};

// Delete department
export const remove = async (req, res) => {
  const { id } = req.params;
  try {
    // Delete positions first (Prisma handles Cascade onDelete cascade at the position constraint level)
    // We already have Cascade set on relation in Position: `department Department @relation(fields: [departmentId], references: [id], onDelete: Cascade)`
    await prisma.department.delete({
      where: { id }
    });
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ message: 'Server error deleting department' });
  }
};
