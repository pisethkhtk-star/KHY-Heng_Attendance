import prisma from '../utils/db.js';

// GET /api/permissions
export const getPermissions = async (req, res) => {
  try {
    const permissions = await prisma.rolePermission.findMany({
      orderBy: [
        { role: 'asc' },
        { resource: 'asc' }
      ]
    });
    res.json(permissions);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ message: 'Server error loading permissions' });
  }
};

// PUT /api/permissions
export const updatePermissions = async (req, res) => {
  const { permissions } = req.body;

  if (!permissions || !Array.isArray(permissions)) {
    return res.status(400).json({ message: 'Invalid permissions payload' });
  }

  try {
    // Perform updates in a batch transaction
    const updates = permissions.map(p => {
      return prisma.rolePermission.update({
        where: {
          role_resource: {
            role: p.role,
            resource: p.resource
          }
        },
        data: {
          canAccess: p.canAccess
        }
      });
    });

    await prisma.$transaction(updates);

    res.json({ message: 'Permissions updated successfully' });
  } catch (error) {
    console.error('Error updating permissions:', error);
    res.status(500).json({ message: 'Server error saving permissions changes' });
  }
};
