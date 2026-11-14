import prisma from '../config/db';
import { validateAndCheckIn, manualOverrideCheckIn } from '../services/validationService';
import { getEventAnalytics } from '../services/analyticsService';
import { issueTicketForRegistration } from '../services/ticketService';
import { revokeTicket } from '../services/ticketService';

async function runAcceptanceTests() {
  console.log('================================================================');
  console.log('   PGDI 720 ACCEPTANCE & CONCURRENCY VERIFICATION SUITE');
  console.log('================================================================\n');

  // Find our seeded event
  const event = await prisma.event.findFirst({
    where: { title: { contains: 'PGDI 720' } },
    include: { gates: true, ticketTypes: true },
  });

  if (!event) {
    throw new Error('Test event not found. Did you run the seed script?');
  }

  const wrongEvent = await prisma.event.findFirst({
    where: { title: { contains: 'West Africa' } },
  });

  const gateA = event.gates[0];
  const gateB = event.gates[1];

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ✓ ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ✗ ${testName}`);
      failed++;
    }
  }

  // TEST 1: Fresh Registration & Valid QR Admission (FR-06, FR-07)
  console.log('--- Test 1: Fresh Registration & Valid Admission ---');
  const attendee1 = await prisma.attendee.create({
    data: {
      fullName: 'Test Attendee Acceptance 1',
      email: `test1_${Date.now()}@test.iconic.edu.ng`,
      privacyConsent: true,
    },
  });
  const reg1 = await prisma.registration.create({
    data: {
      eventId: event.id,
      attendeeId: attendee1.id,
      ticketTypeId: event.ticketTypes[0].id,
      status: 'approved',
      reference: `REG-TEST-1-${Date.now()}`,
    },
  });
  const { plainToken: token1, ticket: ticket1 } = await issueTicketForRegistration(reg1.id);

  const res1 = await validateAndCheckIn({
    token: token1,
    eventId: event.id,
    gateId: gateA.id,
  });
  assert(res1.outcome === 'admit', 'Valid ticket returns "admit" outcome');

  // Verify DB state
  const checkIn1 = await prisma.checkIn.findUnique({ where: { ticketId: ticket1.id } });
  assert(checkIn1 !== null, 'CheckIn record created in database');
  const updatedTkt1 = await prisma.ticket.findUnique({ where: { id: ticket1.id } });
  assert(updatedTkt1?.status === 'used', 'Ticket status transitioned to "used"');

  // TEST 2: Replay Attack Prevention (Same QR presented a second time)
  console.log('\n--- Test 2: Replay Attack Prevention ---');
  const res2 = await validateAndCheckIn({
    token: token1,
    eventId: event.id,
    gateId: gateB.id,
  });
  assert(res2.outcome === 'already_used', 'Repeated presentation returns "already_used" outcome');
  const checkInCount1 = await prisma.checkIn.count({ where: { ticketId: ticket1.id } });
  assert(checkInCount1 === 1, 'Exactly one check-in committed, no duplicate admission allowed');

  // TEST 3: Concurrent Presentation at Two Gates (Race condition test)
  console.log('\n--- Test 3: Concurrency Admission Control (Two Gates Simultanous Scan) ---');
  const attendee3 = await prisma.attendee.create({
    data: {
      fullName: 'Concurrent Scan Test Attendee',
      email: `test_concurrency_${Date.now()}@test.iconic.edu.ng`,
      privacyConsent: true,
    },
  });
  const reg3 = await prisma.registration.create({
    data: {
      eventId: event.id,
      attendeeId: attendee3.id,
      ticketTypeId: event.ticketTypes[0].id,
      status: 'approved',
      reference: `REG-CONC-${Date.now()}`,
    },
  });
  const { plainToken: tokenConc, ticket: ticketConc } = await issueTicketForRegistration(reg3.id);

  // Fire two concurrent scans against Gate A and Gate B at the exact same millisecond
  const [concRes1, concRes2] = await Promise.all([
    validateAndCheckIn({ token: tokenConc, eventId: event.id, gateId: gateA.id }).catch((e) => ({
      outcome: 'error',
      message: e.message,
    })),
    validateAndCheckIn({ token: tokenConc, eventId: event.id, gateId: gateB.id }).catch((e) => ({
      outcome: 'error',
      message: e.message,
    })),
  ]);

  const admits = [concRes1, concRes2].filter((r) => r.outcome === 'admit').length;
  const alreadyUsed = [concRes1, concRes2].filter(
    (r) => r.outcome === 'already_used' || r.outcome === 'error'
  ).length;

  assert(admits === 1, 'Under concurrent requests, exactly ONE transaction succeeds with "admit"');
  assert(alreadyUsed === 1, 'The competing concurrent request is rejected');
  const totalConcCheckIns = await prisma.checkIn.count({ where: { ticketId: ticketConc.id } });
  assert(totalConcCheckIns === 1, 'Database uniqueness constraint guarantees 1 single admission');

  // TEST 4: Wrong Event Rejection
  console.log('\n--- Test 4: Cross-Event Validation Rejection ---');
  if (wrongEvent) {
    const resWrong = await validateAndCheckIn({
      token: token1,
      eventId: wrongEvent.id, // presenting event 1 ticket at wrongEvent gate
    });
    assert(resWrong.outcome === 'wrong_event', 'Ticket for different event returns "wrong_event" rejection');
  }

  // TEST 5: Revoked Ticket Rejection
  console.log('\n--- Test 5: Revoked Ticket Rejection ---');
  const attendee5 = await prisma.attendee.create({
    data: {
      fullName: 'Revoked Test Attendee',
      email: `test_revoked_${Date.now()}@test.iconic.edu.ng`,
      privacyConsent: true,
    },
  });
  const reg5 = await prisma.registration.create({
    data: {
      eventId: event.id,
      attendeeId: attendee5.id,
      ticketTypeId: event.ticketTypes[0].id,
      status: 'approved',
      reference: `REG-REV-${Date.now()}`,
    },
  });
  const { plainToken: tokenRev, ticket: ticketRev } = await issueTicketForRegistration(reg5.id);
  await revokeTicket(ticketRev.id, 'Payment chargeback dispute or administrative cancellation');

  const resRev = await validateAndCheckIn({
    token: tokenRev,
    eventId: event.id,
    gateId: gateA.id,
  });
  assert(resRev.outcome === 'revoked', 'Revoked ticket returns "revoked" outcome');

  // TEST 6: Supervisor Manual Override (FR-08)
  console.log('\n--- Test 6: Gate Supervisor Manual Override ---');
  const attendee6 = await prisma.attendee.create({
    data: {
      fullName: 'Supervisor Override Attendee',
      email: `test_sup_${Date.now()}@test.iconic.edu.ng`,
      privacyConsent: true,
    },
  });
  const reg6 = await prisma.registration.create({
    data: {
      eventId: event.id,
      attendeeId: attendee6.id,
      ticketTypeId: event.ticketTypes[0].id,
      status: 'approved',
      reference: `REG-SUP-${Date.now()}`,
    },
  });
  const { ticket: ticketSup } = await issueTicketForRegistration(reg6.id);

  const supervisor = await prisma.userAccount.findFirst({
    where: { email: 'supervisor@iconic.edu.ng' },
  });

  const resSup = await manualOverrideCheckIn({
    ticketId: ticketSup.id,
    eventId: event.id,
    supervisorId: supervisor!.id,
    gateId: gateA.id,
    reason: 'Attendee presented national e-ID card; physical phone battery depleted.',
  });
  assert(resSup.outcome === 'admit', 'Supervisor override commits admission');
  const overrideCheckIn = await prisma.checkIn.findUnique({ where: { ticketId: ticketSup.id } });
  assert(overrideCheckIn?.isManualOverride === true, 'CheckIn marked as manual override');
  assert(
    overrideCheckIn?.overrideReason?.includes('national e-ID') === true,
    'Override reason captured in database'
  );

  // TEST 7: Analytics Reconciliation (Table 13, Chapter 7)
  console.log('\n--- Test 7: Attendance Analytics Calculation Reconciliation ---');
  const analytics = await getEventAnalytics(event.id);
  const actualRegCount = await prisma.registration.count({ where: { eventId: event.id, status: 'approved' } });
  const actualCheckInCount = await prisma.checkIn.count({ where: { eventId: event.id } });

  assert(
    analytics.summary.approvedRegistrations === actualRegCount,
    'Dashboard approved registrations matches DB record count'
  );
  assert(
    analytics.summary.checkedInAttendees === actualCheckInCount,
    'Dashboard checked-in volume matches authoritative DB check-in records'
  );

  const calculatedRate = Number(((actualCheckInCount / actualRegCount) * 100).toFixed(1));
  assert(
    analytics.summary.attendanceRate === calculatedRate,
    `Attendance rate accurately calculated as ${calculatedRate}%`
  );

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');
}

runAcceptanceTests()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
