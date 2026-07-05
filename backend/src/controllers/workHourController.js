import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Get company work hours (creates default if none exists)
export const getWorkHour = async (req, res) => {
  try {
    let workHour = await prisma.companyWorkHour.findFirst();
    if (!workHour) {
      workHour = await prisma.companyWorkHour.create({
        data: {
          shift1Start: '08:00',
          shift1End: '12:00',
          shift2Start: '13:00',
          shift2End: '17:00'
        }
      });
    }
    res.json(workHour);
  } catch (error) {
    console.error('Error fetching company work hours:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update company work hours
export const updateWorkHour = async (req, res) => {
  const { shift1Start, shift1End, shift2Start, shift2End } = req.body;

  if (!shift1Start || !shift1End || !shift2Start || !shift2End) {
    return res.status(400).json({ message: 'All shift times are required' });
  }

  try {
    let workHour = await prisma.companyWorkHour.findFirst();
    if (workHour) {
      workHour = await prisma.companyWorkHour.update({
        where: { id: workHour.id },
        data: {
          shift1Start,
          shift1End,
          shift2Start,
          shift2End
        }
      });
    } else {
      workHour = await prisma.companyWorkHour.create({
        data: {
          shift1Start,
          shift1End,
          shift2Start,
          shift2End
        }
      });
    }
    res.json({ message: 'Company work hours updated successfully', data: workHour });
  } catch (error) {
    console.error('Error updating company work hours:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
