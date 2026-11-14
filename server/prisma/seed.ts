import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateSeedToken() {
  const plainToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
  return { plainToken, tokenHash };
}

async function main() {
  console.log('--- Starting Seed: Integrated E-Ticketing Platform (PGDI 720) ---');

  // 1. Clean existing records
  await prisma.checkIn.deleteMany();
  await prisma.scanAttempt.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.attendee.deleteMany();
  await prisma.ticketType.deleteMany();
  await prisma.gate.deleteMany();
  await prisma.roleAssignment.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.event.deleteMany();
  await prisma.userAccount.deleteMany();

  // 2. Create Users
  const passwordHash = await bcrypt.hash('Password@123', 10);

  const admin = await prisma.userAccount.create({
    data: {
      email: 'admin@iconic.edu.ng',
      displayName: 'Kizito Nwaodu',
      passwordHash,
      status: 'active',
      roleAssignments: {
        create: [{ role: 'admin' }],
      },
    },
  });

  const organiser = await prisma.userAccount.create({
    data: {
      email: 'organiser@iconic.edu.ng',
      displayName: 'Akinshola Babajide',
      passwordHash,
      status: 'active',
      roleAssignments: {
        create: [{ role: 'organiser' }],
      },
    },
  });

  const supervisor = await prisma.userAccount.create({
    data: {
      email: 'supervisor@iconic.edu.ng',
      displayName: 'Meshach Sinyada',
      passwordHash,
      status: 'active',
      roleAssignments: {
        create: [{ role: 'supervisor' }],
      },
    },
  });

  const scanner = await prisma.userAccount.create({
    data: {
      email: 'scanner@iconic.edu.ng',
      displayName: 'Lawal Muhammad',
      passwordHash,
      status: 'active',
      roleAssignments: {
        create: [{ role: 'scanner_operator' }],
      },
    },
  });

  const auditor = await prisma.userAccount.create({
    data: {
      email: 'auditor@iconic.edu.ng',
      displayName: 'Ibinabo Sokari Boma',
      passwordHash,
      status: 'active',
      roleAssignments: {
        create: [{ role: 'auditor' }],
      },
    },
  });

  console.log('Created 5 staff role-based user accounts.');

  // 3. Create Featured Event
  const now = new Date();
  const eventStart = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago (live event)
  const eventEnd = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours from now

  const event = await prisma.event.create({
    data: {
      title: 'Iconic Open University Postgraduate Research & Innovation Symposium 2026',
      description: 'Annual symposium showcasing postgraduate research projects, technology exhibitions and faculty presentations.',
      venue: 'Main University Amphitheatre, Iconic Open University Campus, Abuja',
      startAt: eventStart,
      endAt: eventEnd,
      capacity: 500,
      status: 'published',
      gates: {
        create: [
          { name: 'North Main Gate A', status: 'open' },
          { name: 'South Gate B', status: 'open' },
          { name: 'Faculty Entrance Gate C', status: 'open' },
        ],
      },
      ticketTypes: {
        create: [
          { name: 'Standard Attendee', price: 0, capacity: 350 },
          { name: 'Faculty & Staff', price: 0, capacity: 50 },
          { name: 'Student Delegate', price: 0, capacity: 100 },
        ],
      },
    },
    include: {
      gates: true,
      ticketTypes: true,
    },
  });

  console.log(`Created Event: ${event.title}`);

  // Create a second event (for testing "Wrong Event" validation rejection!)
  const wrongEvent = await prisma.event.create({
    data: {
      title: 'Faculty of Computing & Information Technology Annual Lecture',
      description: 'Public lecture and panel discussion on emerging technologies in African higher education.',
      venue: 'University Auditorium, Main Campus, Abuja',
      startAt: new Date(now.getTime() + 86400000),
      endAt: new Date(now.getTime() + 172800000),
      capacity: 250,
      status: 'published',
      gates: {
        create: [{ name: 'Main Entrance Gate 1', status: 'open' }],
      },
      ticketTypes: {
        create: [{ name: 'General Admission', price: 0, capacity: 250 }],
      },
    },
    include: { ticketTypes: true },
  });

  const gateA = event.gates[0];
  const gateB = event.gates[1];
  const standardType = event.ticketTypes[0];
  const vipType = event.ticketTypes[1];

  // 4. Create Attendees & Sample Tickets
  const sampleAttendees = [
    { name: 'Dr. Zayyanu Bala', email: 'zayyanu.bala@iconic.edu.ng', phone: '+2348030000001', type: vipType },
    { name: 'Emeka Chukwu', email: 'emeka.chukwu@example.com', phone: '+2348021112233', type: standardType },
    { name: 'Amina Bello', email: 'amina.bello@example.com', phone: '+2348053334455', type: standardType },
    { name: 'Fatima Abdullahi', email: 'fatima.a@example.com', phone: '+2348075556677', type: standardType },
    { name: 'Chinedu Eze', email: 'chinedu.eze@example.com', phone: '+2348097778899', type: standardType },
    { name: 'Olumide Bakare', email: 'olumide.b@example.com', phone: '+2348101234567', type: standardType },
    { name: 'Ngozi Okonjo', email: 'ngozi.o@example.com', phone: '+2348123456789', type: standardType },
    { name: 'Tunde Adeyemi', email: 'tunde.a@example.com', phone: '+2348145678901', type: standardType },
    { name: 'Grace Danjuma', email: 'grace.d@example.com', phone: '+2348167890123', type: standardType },
    { name: 'Ibrahim Musa', email: 'ibrahim.m@example.com', phone: '+2348189012345', type: standardType },
  ];

  const generatedSeedTickets: any[] = [];

  for (let i = 0; i < sampleAttendees.length; i++) {
    const data = sampleAttendees[i];
    const attendee = await prisma.attendee.create({
      data: {
        fullName: data.name,
        email: data.email,
        phone: data.phone,
        privacyConsent: true,
      },
    });

    const reg = await prisma.registration.create({
      data: {
        eventId: event.id,
        attendeeId: attendee.id,
        ticketTypeId: data.type.id,
        status: 'approved',
        reference: `REG-2026-00${i + 1}`,
      },
    });

    const { plainToken, tokenHash } = generateSeedToken();
    const ticket = await prisma.ticket.create({
      data: {
        registrationId: reg.id,
        ticketNumber: `TKT-2026-00${i + 1}`,
        token: plainToken,
        tokenHash,
        status: 'active',
        validFrom: eventStart,
        validTo: eventEnd,
      },
    });

    generatedSeedTickets.push({
      ticket,
      plainToken,
      attendeeName: data.name,
      email: data.email,
    });
  }

  // 5. Pre-simulate real-world test scenarios:
  // Scenario A: First 4 tickets already checked in through Gate A (for testing Already Used replay detection)
  for (let j = 0; j < 4; j++) {
    const item = generatedSeedTickets[j];
    const checkInTime = new Date(now.getTime() - (30 - j * 5) * 60 * 1000);

    await prisma.checkIn.create({
      data: {
        ticketId: item.ticket.id,
        eventId: event.id,
        gateId: gateA.id,
        operatorId: scanner.id,
        checkedInAt: checkInTime,
        isManualOverride: false,
      },
    });

    await prisma.ticket.update({
      where: { id: item.ticket.id },
      data: { status: 'used' },
    });

    await prisma.scanAttempt.create({
      data: {
        ticketId: item.ticket.id,
        eventId: event.id,
        gateId: gateA.id,
        operatorId: scanner.id,
        tokenHashPresented: item.ticket.tokenHash,
        outcome: 'admit',
        scannedAt: checkInTime,
        notes: 'Admitted successfully',
      },
    });
  }

  // Scenario B: Ticket 5 was revoked by organiser (for testing Revoked rejection)
  const revokedItem = generatedSeedTickets[4];
  await prisma.ticket.update({
    where: { id: revokedItem.ticket.id },
    data: {
      status: 'revoked',
      revocationReason: 'Duplicate reservation identified by organiser',
    },
  });

  // Scenario C: Create a Ticket for Wrong Event (for testing Wrong Event rejection)
  const wrongAttendee = await prisma.attendee.create({
    data: {
      fullName: 'Foreign Event Guest',
      email: 'foreign.guest@example.com',
      privacyConsent: true,
    },
  });
  const wrongReg = await prisma.registration.create({
    data: {
      eventId: wrongEvent.id,
      attendeeId: wrongAttendee.id,
      ticketTypeId: wrongEvent.ticketTypes[0].id,
      status: 'approved',
      reference: 'REG-FOREIGN-01',
    },
  });
  const { plainToken: wrongPlainToken, tokenHash: wrongTokenHash } = generateSeedToken();
  const wrongTicket = await prisma.ticket.create({
    data: {
      registrationId: wrongReg.id,
      ticketNumber: 'TKT-FOREIGN-999',
      token: wrongPlainToken,
      tokenHash: wrongTokenHash,
      status: 'active',
      validFrom: eventStart,
      validTo: eventEnd,
    },
  });

  // Record initial audit log
  await prisma.auditLog.create({
    data: {
      action: 'SYSTEM_SEEDED',
      targetType: 'System',
      targetId: 'root',
      actorId: admin.id,
      metadata: JSON.stringify({
        eventCount: 2,
        attendeeCount: sampleAttendees.length,
        seededAt: new Date().toISOString(),
      }),
    },
  });

  console.log('\n--- SEED SUMMARY ---');
  console.log('Event ID:', event.id);
  console.log('Active Tickets ready to scan:');
  console.log(`- Attendee: ${generatedSeedTickets[5].attendeeName} (Ticket: ${generatedSeedTickets[5].ticket.ticketNumber})`);
  console.log(`  Plain Token: ${generatedSeedTickets[5].plainToken}`);
  console.log(`- Attendee: ${generatedSeedTickets[6].attendeeName} (Ticket: ${generatedSeedTickets[6].ticket.ticketNumber})`);
  console.log(`  Plain Token: ${generatedSeedTickets[6].plainToken}`);
  console.log(`- Revoked Ticket Attendee: ${revokedItem.attendeeName} (Ticket: ${revokedItem.ticket.ticketNumber})`);
  console.log(`  Plain Token: ${revokedItem.plainToken}`);
  console.log(`- Wrong Event Ticket Plain Token: ${wrongPlainToken}`);
  console.log('--- Seed Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
