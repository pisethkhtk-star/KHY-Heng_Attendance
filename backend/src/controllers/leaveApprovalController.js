import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Get all rules
export const getAllRules = async (req, res) => {
  try {
    const rules = await prisma.leaveApprovalRule.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const enrichedRules = await Promise.all(rules.map(async (rule) => {
      const approver = await prisma.employee.findUnique({
        where: { staffId: rule.approverId },
        select: { nameEn: true, nameKh: true, staffId: true }
      });

      let targetDept = null;
      if (rule.scope === 'Department' && rule.targetDeptId) {
        targetDept = await prisma.department.findUnique({
          where: { id: rule.targetDeptId },
          select: { nameEn: true, nameKh: true }
        });
      }

      let targetEmployee = null;
      if (rule.scope === 'Employee' && rule.targetStaffId) {
        targetEmployee = await prisma.employee.findUnique({
          where: { staffId: rule.targetStaffId },
          select: { nameEn: true, nameKh: true, staffId: true }
        });
      }

      return {
        ...rule,
        approver,
        targetDept,
        targetEmployee
      };
    }));

    res.json(enrichedRules);
  } catch (error) {
    console.error('Error fetching approval rules:', error);
    res.status(500).json({ message: 'Error fetching approval rules' });
  }
};

// Create a new rule
export const createRule = async (req, res) => {
  const { approverId, scope, targetDeptId, targetStaffId, targetStaffIds } = req.body;

  if (!approverId || !scope) {
    return res.status(400).json({ message: 'Approver and Scope are required' });
  }

  try {
    const approver = await prisma.employee.findUnique({
      where: { staffId: approverId }
    });

    if (!approver) {
      return res.status(404).json({ message: 'Approver employee not found' });
    }

    if (approver.role === 'Employee') {
      return res.status(400).json({ message: 'Normal employees cannot be leave approvers' });
    }

    if (scope === 'Department') {
      if (!targetDeptId) return res.status(400).json({ message: 'Department is required for Department scope' });
      const existing = await prisma.leaveApprovalRule.findFirst({
        where: { approverId, scope: 'Department', targetDeptId }
      });
      if (existing) {
        return res.status(400).json({ message: 'This approval rule already exists for this department' });
      }

      const rule = await prisma.leaveApprovalRule.create({
        data: {
          approverId,
          scope,
          targetDeptId
        }
      });
      return res.status(201).json(rule);
    } else {
      const staffIds = targetStaffIds || (targetStaffId ? [targetStaffId] : []);
      if (staffIds.length === 0) {
        return res.status(400).json({ message: 'At least one target employee is required' });
      }

      const createdRules = [];
      const skippedIds = [];

      for (const tId of staffIds) {
        const existing = await prisma.leaveApprovalRule.findFirst({
          where: { approverId, scope: 'Employee', targetStaffId: tId }
        });
        if (existing) {
          skippedIds.push(tId);
          continue;
        }

        const rule = await prisma.leaveApprovalRule.create({
          data: {
            approverId,
            scope,
            targetStaffId: tId
          }
        });
        createdRules.push(rule);
      }

      if (createdRules.length === 0 && skippedIds.length > 0) {
        return res.status(400).json({ message: 'All selected employees already have this approval rule set.' });
      }

      return res.status(201).json({
        message: `Successfully created rules for ${createdRules.length} employees.`,
        createdCount: createdRules.length,
        skippedCount: skippedIds.length,
        data: createdRules[0] // return first for compatibility
      });
    }
  } catch (error) {
    console.error('Error creating approval rule:', error);
    res.status(500).json({ message: 'Error creating approval rule' });
  }
};

// Delete a rule
export const deleteRule = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.leaveApprovalRule.delete({
      where: { id }
    });
    res.json({ message: 'Approval rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting approval rule:', error);
    res.status(500).json({ message: 'Error deleting approval rule' });
  }
};

// Update a rule
export const updateRule = async (req, res) => {
  const { id } = req.params;
  const { approverId, scope, targetDeptId, targetStaffId } = req.body;

  if (!approverId || !scope) {
    return res.status(400).json({ message: 'Approver and Scope are required' });
  }

  try {
    const approver = await prisma.employee.findUnique({
      where: { staffId: approverId }
    });

    if (!approver) {
      return res.status(404).json({ message: 'Approver employee not found' });
    }

    if (approver.role === 'Employee') {
      return res.status(400).json({ message: 'Normal employees cannot be leave approvers' });
    }

    const rule = await prisma.leaveApprovalRule.findUnique({
      where: { id }
    });

    if (!rule) {
      return res.status(404).json({ message: 'Approval rule not found' });
    }

    if (scope === 'Department') {
      if (!targetDeptId) return res.status(400).json({ message: 'Department is required for Department scope' });
      const existing = await prisma.leaveApprovalRule.findFirst({
        where: { 
          approverId, 
          scope: 'Department', 
          targetDeptId,
          NOT: { id }
        }
      });
      if (existing) {
        return res.status(400).json({ message: 'This approval rule already exists for this department' });
      }

      const updated = await prisma.leaveApprovalRule.update({
        where: { id },
        data: {
          approverId,
          scope,
          targetDeptId,
          targetStaffId: null
        }
      });
      return res.json(updated);
    } else {
      if (!targetStaffId) {
        return res.status(400).json({ message: 'Target employee is required' });
      }
      const existing = await prisma.leaveApprovalRule.findFirst({
        where: { 
          approverId, 
          scope: 'Employee', 
          targetStaffId,
          NOT: { id }
        }
      });
      if (existing) {
        return res.status(400).json({ message: 'This approval rule already exists for this employee' });
      }

      const updated = await prisma.leaveApprovalRule.update({
        where: { id },
        data: {
          approverId,
          scope,
          targetStaffId,
          targetDeptId: null
        }
      });
      return res.json(updated);
    }
  } catch (error) {
    console.error('Error updating approval rule:', error);
    res.status(500).json({ message: 'Error updating approval rule' });
  }
};

