import prisma from './db.js';
import { scanBranchQRCode } from '../controllers/qrController.js';

async function test() {
  console.log('--- RUNNING FINAL QR SCAN TEST ---');
  const branch = await prisma.kioskSetting.findFirst({
    where: { name: 'takeo' }
  });
  const employee = await prisma.employee.findFirst({
    where: { status: 'Active' }
  });

  const req = {
    user: {
      staffId: employee.staffId,
      role: employee.role
    },
    body: {
      qrToken: `branch_qr:${branch.id}`,
      deviceInfo: 'Test Script',
      location: 'Test Geofence',
      latitude: branch.latitude,
      longitude: branch.longitude
    }
  };

  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      console.log('Response status:', this.statusCode);
      console.log('Response body:', JSON.stringify(data, null, 2));
    }
  };

  try {
    await scanBranchQRCode(req, res);
  } catch (err) {
    console.error('Crash error:', err);
  }
}

test().catch(console.error);
